import logging
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.models.barter import (
    TradeOffer,
    TradeOfferCreate,
    TradeOfferStatus,
    TradeOfferWithAgent,
    Trade,
    TradeCreate,
    TradeStatus,
    TradeWithDetails,
)
from app.models.agent import AgentSpecialty
from app.services.database import DatabaseService
from app.services.agent_service import AgentService
from app.config import get_settings

logger = logging.getLogger(__name__)


class BarterService:
    """Service for managing barter trades between agents."""

    def __init__(self, db: DatabaseService):
        self.db = db
        self.settings = get_settings()
        self.offers_table = db.table("trade_offers")
        self.trades_table = db.table("trades")
        self.agent_service = AgentService(db)

    # ==================== Trade Offer Methods ====================

    async def create_offer(self, offer_data: TradeOfferCreate) -> TradeOffer:
        """Create a new trade offer."""
        # Validate agent exists and can trade
        agent = await self.agent_service.get_by_id(offer_data.agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if not agent.is_active:
            raise ValueError("Agent is not active")
        if agent.is_at_capacity:
            raise ValueError("Agent is at maximum job capacity (5/5)")

        # Check agent doesn't already have an open offer
        existing = await self.get_agent_open_offers(offer_data.agent_id)
        if existing:
            raise ValueError("Agent already has an open trade offer")

        now = datetime.now(timezone.utc)
        data = {
            "agent_id": str(offer_data.agent_id),
            "offer_specialty": offer_data.offer_specialty.value,
            "want_specialty": offer_data.want_specialty.value,
            "status": TradeOfferStatus.OPEN.value,
            "matched_with_offer_id": None,
            "trade_id": None,
            "created_at": now.isoformat(),
            "expires_at": None,
        }

        result = self.offers_table.insert(data).execute()
        offer = self._to_trade_offer(result.data[0])

        # Try to find a match immediately
        matched_trade = await self.try_match_offer(offer.id)
        if matched_trade:
            # Refresh the offer to get updated status
            offer = await self.get_offer_by_id(offer.id)

        return offer

    async def get_offer_by_id(self, offer_id: UUID) -> TradeOffer | None:
        """Get a trade offer by ID."""
        result = self.offers_table.select("*").eq("id", str(offer_id)).execute()
        if not result.data:
            return None
        return self._to_trade_offer(result.data[0])

    async def get_offer_with_agent(self, offer_id: UUID) -> TradeOfferWithAgent | None:
        """Get a trade offer with agent details."""
        offer = await self.get_offer_by_id(offer_id)
        if not offer:
            return None

        agent = await self.agent_service.get_by_id(offer.agent_id)
        if not agent:
            return None

        return TradeOfferWithAgent(
            **offer.model_dump(),
            agent_name=agent.name,
            agent_credits=agent.credits,
            agent_current_jobs=agent.current_jobs,
        )

    async def get_open_offers(
        self,
        offer_specialty: AgentSpecialty | None = None,
        want_specialty: AgentSpecialty | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TradeOfferWithAgent]:
        """Get all open trade offers, optionally filtered."""
        query = self.offers_table.select("*").eq("status", TradeOfferStatus.OPEN.value)

        if offer_specialty:
            query = query.eq("offer_specialty", offer_specialty.value)
        if want_specialty:
            query = query.eq("want_specialty", want_specialty.value)

        result = query.order("created_at", desc=False).range(offset, offset + limit - 1).execute()

        offers_with_agents = []
        for row in result.data:
            offer = self._to_trade_offer(row)
            agent = await self.agent_service.get_by_id(offer.agent_id)
            if agent:
                offers_with_agents.append(
                    TradeOfferWithAgent(
                        **offer.model_dump(),
                        agent_name=agent.name,
                        agent_credits=agent.credits,
                        agent_current_jobs=agent.current_jobs,
                    )
                )

        return offers_with_agents

    async def get_agent_open_offers(self, agent_id: UUID) -> list[TradeOffer]:
        """Get all open offers for a specific agent."""
        result = self.offers_table.select("*").eq(
            "agent_id", str(agent_id)
        ).eq("status", TradeOfferStatus.OPEN.value).execute()
        return [self._to_trade_offer(row) for row in result.data]

    async def cancel_offer(self, offer_id: UUID) -> TradeOffer | None:
        """Cancel an open trade offer."""
        offer = await self.get_offer_by_id(offer_id)
        if not offer:
            return None
        if offer.status != TradeOfferStatus.OPEN:
            raise ValueError(f"Cannot cancel offer with status: {offer.status}")

        result = self.offers_table.update({
            "status": TradeOfferStatus.CANCELLED.value,
        }).eq("id", str(offer_id)).execute()

        if not result.data:
            return None
        return self._to_trade_offer(result.data[0])

    # ==================== Auto-Matching Logic ====================

    async def try_match_offer(self, offer_id: UUID) -> Trade | None:
        """
        Try to find a matching offer and create a trade.

        Matching logic:
        - Offer A: offers X, wants Y
        - Offer B: offers Y, wants X
        = Perfect match!
        """
        offer = await self.get_offer_by_id(offer_id)
        if not offer or offer.status != TradeOfferStatus.OPEN:
            return None

        # Find a complementary offer:
        # - Their offer_specialty = our want_specialty
        # - Their want_specialty = our offer_specialty
        result = self.offers_table.select("*").eq(
            "status", TradeOfferStatus.OPEN.value
        ).eq(
            "offer_specialty", offer.want_specialty.value
        ).eq(
            "want_specialty", offer.offer_specialty.value
        ).neq(
            "agent_id", str(offer.agent_id)  # Can't match with yourself
        ).order("created_at").limit(1).execute()

        if not result.data:
            return None

        matching_offer = self._to_trade_offer(result.data[0])

        # Verify both agents still have capacity
        agent_a = await self.agent_service.get_by_id(offer.agent_id)
        agent_b = await self.agent_service.get_by_id(matching_offer.agent_id)

        if not agent_a or not agent_b:
            return None
        if agent_a.is_at_capacity or agent_b.is_at_capacity:
            return None

        # Create the trade
        trade = await self._create_trade_from_offers(offer, matching_offer)
        return trade

    async def find_matches_for_all_open_offers(self) -> list[Trade]:
        """Scan all open offers and create matches. Called periodically."""
        result = self.offers_table.select("*").eq(
            "status", TradeOfferStatus.OPEN.value
        ).order("created_at").execute()

        trades_created = []
        processed_offer_ids = set()

        for row in result.data:
            offer = self._to_trade_offer(row)
            if offer.id in processed_offer_ids:
                continue

            trade = await self.try_match_offer(offer.id)
            if trade:
                trades_created.append(trade)
                # Mark both offers as processed
                processed_offer_ids.add(offer.id)
                # Get the matched offer ID from the trade
                if trade.offer_a_id != offer.id:
                    processed_offer_ids.add(trade.offer_a_id)
                else:
                    processed_offer_ids.add(trade.offer_b_id)

        return trades_created

    # ==================== Trade Methods ====================

    async def _create_trade_from_offers(
        self,
        offer_a: TradeOffer,
        offer_b: TradeOffer,
    ) -> Trade:
        """Create a trade from two matched offers."""
        now = datetime.now(timezone.utc)

        # Create the trade
        trade_data = {
            "offer_a_id": str(offer_a.id),
            "offer_b_id": str(offer_b.id),
            "agent_a_id": str(offer_a.agent_id),
            "agent_b_id": str(offer_b.agent_id),
            "job_a_specialty": offer_a.offer_specialty.value,  # What A does for B
            "job_b_specialty": offer_b.offer_specialty.value,  # What B does for A
            "status": TradeStatus.PENDING.value,
            "job_a_completed": False,
            "job_b_completed": False,
            "created_at": now.isoformat(),
            "started_at": None,
            "completed_at": None,
        }

        result = self.trades_table.insert(trade_data).execute()
        trade = self._to_trade(result.data[0])

        # Update both offers to matched status
        self.offers_table.update({
            "status": TradeOfferStatus.MATCHED.value,
            "matched_with_offer_id": str(offer_b.id),
            "trade_id": str(trade.id),
        }).eq("id", str(offer_a.id)).execute()

        self.offers_table.update({
            "status": TradeOfferStatus.MATCHED.value,
            "matched_with_offer_id": str(offer_a.id),
            "trade_id": str(trade.id),
        }).eq("id", str(offer_b.id)).execute()

        logger.info(
            f"Trade created: Agent {offer_a.agent_id} <-> Agent {offer_b.agent_id} "
            f"({offer_a.offer_specialty.value} <-> {offer_b.offer_specialty.value})"
        )

        return trade

    async def get_trade_by_id(self, trade_id: UUID) -> Trade | None:
        """Get a trade by ID."""
        result = self.trades_table.select("*").eq("id", str(trade_id)).execute()
        if not result.data:
            return None
        return self._to_trade(result.data[0])

    async def get_trade_with_details(self, trade_id: UUID) -> TradeWithDetails | None:
        """Get a trade with full agent details."""
        trade = await self.get_trade_by_id(trade_id)
        if not trade:
            return None

        agent_a = await self.agent_service.get_by_id(trade.agent_a_id)
        agent_b = await self.agent_service.get_by_id(trade.agent_b_id)

        if not agent_a or not agent_b:
            return None

        return TradeWithDetails(
            **trade.model_dump(),
            agent_a_name=agent_a.name,
            agent_b_name=agent_b.name,
            job_a_description=f"{agent_a.name} provides {trade.job_a_specialty.value} service",
            job_b_description=f"{agent_b.name} provides {trade.job_b_specialty.value} service",
        )

    async def get_agent_trades(
        self,
        agent_id: UUID,
        status: TradeStatus | None = None,
    ) -> list[Trade]:
        """Get all trades involving a specific agent."""
        # Need to check both agent_a_id and agent_b_id
        query_a = self.trades_table.select("*").eq("agent_a_id", str(agent_id))
        query_b = self.trades_table.select("*").eq("agent_b_id", str(agent_id))

        if status:
            query_a = query_a.eq("status", status.value)
            query_b = query_b.eq("status", status.value)

        result_a = query_a.execute()
        result_b = query_b.execute()

        # Combine and deduplicate
        trades = {}
        for row in result_a.data + result_b.data:
            trade = self._to_trade(row)
            trades[trade.id] = trade

        return sorted(trades.values(), key=lambda t: t.created_at, reverse=True)

    async def get_pending_trades(self) -> list[Trade]:
        """Get all pending trades ready to start."""
        result = self.trades_table.select("*").eq(
            "status", TradeStatus.PENDING.value
        ).execute()
        return [self._to_trade(row) for row in result.data]

    async def get_in_progress_trades(self) -> list[Trade]:
        """Get all trades currently in progress."""
        result = self.trades_table.select("*").eq(
            "status", TradeStatus.IN_PROGRESS.value
        ).execute()
        return [self._to_trade(row) for row in result.data]

    async def start_trade(self, trade_id: UUID) -> Trade | None:
        """Start a pending trade - both agents begin working."""
        trade = await self.get_trade_by_id(trade_id)
        if not trade:
            return None
        if trade.status != TradeStatus.PENDING:
            raise ValueError(f"Trade is not pending (status: {trade.status})")

        # Verify both agents still have capacity
        agent_a = await self.agent_service.get_by_id(trade.agent_a_id)
        agent_b = await self.agent_service.get_by_id(trade.agent_b_id)

        if not agent_a or not agent_b:
            raise ValueError("One or both agents not found")
        if agent_a.is_at_capacity:
            raise ValueError(f"Agent {agent_a.name} is at capacity")
        if agent_b.is_at_capacity:
            raise ValueError(f"Agent {agent_b.name} is at capacity")

        # Increment job counts for both agents
        await self.agent_service.increment_jobs(trade.agent_a_id)
        await self.agent_service.increment_jobs(trade.agent_b_id)

        now = datetime.now(timezone.utc)
        result = self.trades_table.update({
            "status": TradeStatus.IN_PROGRESS.value,
            "started_at": now.isoformat(),
        }).eq("id", str(trade_id)).execute()

        if not result.data:
            return None

        logger.info(f"Trade {trade_id} started")
        return self._to_trade(result.data[0])

    async def complete_trade(self, trade_id: UUID) -> Trade | None:
        """Complete a trade - both jobs finished."""
        trade = await self.get_trade_by_id(trade_id)
        if not trade:
            return None
        if trade.status != TradeStatus.IN_PROGRESS:
            raise ValueError(f"Trade is not in progress (status: {trade.status})")

        # Decrement job counts for both agents
        await self.agent_service.decrement_jobs(trade.agent_a_id)
        await self.agent_service.decrement_jobs(trade.agent_b_id)

        now = datetime.now(timezone.utc)
        result = self.trades_table.update({
            "status": TradeStatus.COMPLETED.value,
            "job_a_completed": True,
            "job_b_completed": True,
            "completed_at": now.isoformat(),
        }).eq("id", str(trade_id)).execute()

        if not result.data:
            return None

        logger.info(f"Trade {trade_id} completed")
        return self._to_trade(result.data[0])

    async def get_trades_ready_for_completion(self) -> list[Trade]:
        """
        Get trades that have been in progress long enough to complete.
        Uses the same job_completion_duration_seconds as auctions.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=self.settings.job_completion_duration_seconds
        )

        result = self.trades_table.select("*").eq(
            "status", TradeStatus.IN_PROGRESS.value
        ).lt("started_at", cutoff.isoformat()).execute()

        return [self._to_trade(row) for row in result.data]

    # ==================== Helper Methods ====================

    def _to_trade_offer(self, data: dict) -> TradeOffer:
        return TradeOffer(
            id=data["id"],
            agent_id=data["agent_id"],
            offer_specialty=AgentSpecialty(data["offer_specialty"]),
            want_specialty=AgentSpecialty(data["want_specialty"]),
            status=TradeOfferStatus(data["status"]),
            matched_with_offer_id=data.get("matched_with_offer_id"),
            trade_id=data.get("trade_id"),
            created_at=data["created_at"],
            expires_at=data.get("expires_at"),
        )

    def _to_trade(self, data: dict) -> Trade:
        return Trade(
            id=data["id"],
            offer_a_id=data["offer_a_id"],
            offer_b_id=data["offer_b_id"],
            agent_a_id=data["agent_a_id"],
            agent_b_id=data["agent_b_id"],
            job_a_specialty=AgentSpecialty(data["job_a_specialty"]),
            job_b_specialty=AgentSpecialty(data["job_b_specialty"]),
            status=TradeStatus(data["status"]),
            job_a_completed=data.get("job_a_completed", False),
            job_b_completed=data.get("job_b_completed", False),
            created_at=data["created_at"],
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
        )

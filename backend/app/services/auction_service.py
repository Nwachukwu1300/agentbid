import random
from postgrest.exceptions import APIError
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.models.auction import (
    Auction,
    AuctionCreate,
    AuctionStatus,
    AuctionWithJob,
    AuctionResult,
    Bid,
    BidCreate,
)
from app.models.job import Job, JobStatus, JobUpdate
from app.models.agent import AgentSpecialty, Agent
from app.services.database import DatabaseService
from app.services.job_service import JobService
from app.services.agent_service import AgentService
from app.services.event_manager import get_event_manager
from app.config import get_settings


class AuctionService:
    def __init__(self, db: DatabaseService):
        self.db = db
        self.auctions_table = db.table("auctions")
        self.bids_table = db.table("bids")
        self.settings = get_settings()
        self.job_service = JobService(db)
        self.agent_service = AgentService(db)

    async def create_auction(self, auction_data: AuctionCreate) -> Auction:
        """Create a new auction for a job."""
        # Verify job exists and is in pending status
        job = await self.job_service.get_by_id(auction_data.job_id)
        if not job:
            raise ValueError("Job not found")
        if job.status != JobStatus.PENDING:
            raise ValueError(f"Job is not available for auction (status: {job.status})")

        # Determine auction duration (random 90-120 seconds if not specified)
        if auction_data.duration_seconds:
            duration = auction_data.duration_seconds
        else:
            duration = random.randint(
                self.settings.auction_min_duration_seconds,
                self.settings.auction_max_duration_seconds,
            )

        now = datetime.now(timezone.utc)
        ends_at = now + timedelta(seconds=duration)

        data = {
            "job_id": str(auction_data.job_id),
            "duration_seconds": duration,
            "status": AuctionStatus.ACTIVE.value,
            "winning_bid_id": None,
            "winning_agent_id": None,
            "winning_amount": None,
            "started_at": now.isoformat(),
            "ends_at": ends_at.isoformat(),
            "closed_at": None,
        }

        result = self.auctions_table.insert(data).execute()
        auction = self._to_auction(result.data[0])

        # Update job status to in_auction
        await self.job_service.start_auction(auction_data.job_id)

        await get_event_manager().publish_auction_created(
            auction.id, job.title, job.specialty.value, job.base_price, auction.ends_at.isoformat()
        )
        return auction

    async def get_by_id(self, auction_id: UUID) -> Auction | None:
        result = self.auctions_table.select("*").eq("id", str(auction_id)).execute()
        if not result.data:
            return None
        return self._to_auction(result.data[0])

    async def get_auction_with_job(self, auction_id: UUID) -> AuctionWithJob | None:
        """Get auction with associated job details and bid statistics."""
        auction = await self.get_by_id(auction_id)
        if not auction:
            return None

        job = await self.job_service.get_by_id(auction.job_id)
        if not job:
            return None

        winner = (
            await self.agent_service.get_by_id(auction.winning_agent_id)
            if auction.winning_agent_id else None
        )

        # Get bid stats (sorted lowest first, earliest on ties, so bids[0] is leading)
        bids = await self.get_auction_bids(auction_id)
        bid_count = len(bids)
        lowest_bid = bids[0].amount if bids else None

        return AuctionWithJob(
            id=auction.id,
            job_id=auction.job_id,
            duration_seconds=auction.duration_seconds,
            status=auction.status,
            winning_bid_id=auction.winning_bid_id,
            winning_agent_id=auction.winning_agent_id,
            winning_amount=auction.winning_amount,
            started_at=auction.started_at,
            ends_at=auction.ends_at,
            closed_at=auction.closed_at,
            job_title=job.title,
            job_description=job.description,
            job_specialty=job.specialty,
            job_base_price=job.base_price,
            bid_count=bid_count,
            lowest_bid=lowest_bid,
            leading_agent_id=bids[0].agent_id if bids else None,
            winning_agent_name=winner.name if winner else None,
        )

    async def get_active_auctions(
        self,
        specialty: AgentSpecialty | None = None,
        limit: int = 50,
        offset: int = 0,
        status: AuctionStatus = AuctionStatus.ACTIVE,
    ) -> list[AuctionWithJob]:
        """Auctions with job details: active ones ending soonest first, closed ones most recent first."""
        query = self.auctions_table.select("id").eq("status", status.value)
        if status == AuctionStatus.ACTIVE:
            query = query.order("ends_at")
        else:
            query = query.order("closed_at", desc=True)
        result = query.range(offset, offset + limit - 1).execute()

        auctions_with_jobs = []
        for row in result.data:
            auction = await self.get_auction_with_job(row["id"])
            if auction and (specialty is None or auction.job_specialty == specialty):
                auctions_with_jobs.append(auction)
        return auctions_with_jobs

    async def get_expired_auctions(self) -> list[Auction]:
        """Get all auctions that have passed their end time but are still active."""
        now = datetime.now(timezone.utc).isoformat()
        result = self.auctions_table.select("*").eq(
            "status", AuctionStatus.ACTIVE.value
        ).lt("ends_at", now).execute()

        return [self._to_auction(row) for row in result.data]

    async def place_bid(self, bid_data: BidCreate) -> Bid:
        """Place a bid on an auction."""
        # Validate auction exists and is active
        auction = await self.get_by_id(bid_data.auction_id)
        if not auction:
            raise ValueError("Auction not found")
        if auction.status != AuctionStatus.ACTIVE:
            raise ValueError("Auction is not active")
        if datetime.now(timezone.utc) >= auction.ends_at:
            raise ValueError("Auction has ended")

        # Validate agent exists and can bid
        agent = await self.agent_service.get_by_id(bid_data.agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if not agent.is_active:
            raise ValueError("Agent is not active")
        if agent.is_at_capacity:
            raise ValueError("Agent is at maximum job capacity (5/5)")
        if agent.is_bankrupt:
            raise ValueError("Agent is bankrupt until the next season")

        # Validate bid amount: positive and within the job budget.
        # Winners are paid their bid, so an uncapped bid would mint credits.
        if bid_data.amount <= 0:
            raise ValueError("Bid amount must be positive")
        job = await self.job_service.get_by_id(auction.job_id)
        if not job:
            raise ValueError("Associated job not found")
        if bid_data.amount > job.base_price:
            raise ValueError(f"Bid exceeds the job budget ({job.base_price})")
        already = self.bids_table.select("id").eq("auction_id", str(bid_data.auction_id)).eq(
            "agent_id", str(bid_data.agent_id)
        ).execute().data
        if already:
            raise ValueError("Sealed auction: one bid per agent")

        # Create the bid, recording what the job would cost this agent at its current workload
        now = datetime.now(timezone.utc).isoformat()
        data = {
            "auction_id": str(bid_data.auction_id),
            "agent_id": str(bid_data.agent_id),
            "amount": bid_data.amount,
            "work_cost": self.settings.work_cost(job.base_price, agent.current_jobs),
            "created_at": now,
            "is_winning": False,
        }

        try:
            result = self.bids_table.insert(data).execute()
        except APIError as e:
            if e.code == "23505":  # unique index: a concurrent second bid slipped past the check above
                raise ValueError("Sealed auction: one bid per agent") from e
            raise
        bid = self._to_bid(result.data[0])
        # Sealed: the event says who bid, never how much
        await get_event_manager().publish_bid_placed(
            bid.auction_id, bid.id, agent.id, agent.name, agent.specialty.value
        )
        return bid

    async def get_auction_bids(
        self,
        auction_id: UUID,
        limit: int = 100,
    ) -> list[Bid]:
        """Get all bids for an auction, ordered by amount (lowest first), then by time (earliest first)."""
        result = self.bids_table.select("*").eq(
            "auction_id", str(auction_id)
        ).order("amount").order("created_at").range(0, limit - 1).execute()

        return [self._to_bid(row) for row in result.data]

    async def close_auction(self, auction_id: UUID) -> AuctionResult:
        """Close an auction, determine winner, transfer credits, assign job."""
        auction = await self.get_by_id(auction_id)
        if not auction:
            raise ValueError("Auction not found")
        if auction.status != AuctionStatus.ACTIVE:
            raise ValueError("Auction is not active")

        job = await self.job_service.get_by_id(auction.job_id)
        if not job:
            raise ValueError("Associated job not found")

        # Get all bids
        bids = await self.get_auction_bids(auction_id)
        total_bids = len(bids)

        # Determine winner: bids are sorted lowest first, earliest on ties.
        # Skip agents that filled up (won other jobs) or were deactivated since bidding.
        winning_bid = None
        winner_agent = None
        for bid in bids:
            agent = await self.agent_service.get_by_id(bid.agent_id)
            if agent and agent.is_active and not agent.is_at_capacity:
                winning_bid, winner_agent = bid, agent
                break

        now = datetime.now(timezone.utc).isoformat()

        if winning_bid:
            # Mark the winning bid
            self.bids_table.update({"is_winning": True}).eq(
                "id", str(winning_bid.id)
            ).execute()

            winner_agent_name = winner_agent.name

            # No credits move here: the winner is paid its bid when the job completes
            await self.agent_service.increment_jobs(winning_bid.agent_id)

            # Assign job to winner
            await self.job_service.assign_to_agent(
                auction.job_id, winning_bid.agent_id, winning_bid.amount, winning_bid.work_cost
            )

            # Update auction with winner info
            self.auctions_table.update({
                "status": AuctionStatus.CLOSED.value,
                "winning_bid_id": str(winning_bid.id),
                "winning_agent_id": str(winning_bid.agent_id),
                "winning_amount": winning_bid.amount,
                "closed_at": now,
            }).eq("id", str(auction_id)).execute()

            result = AuctionResult(
                auction_id=auction_id,
                job_id=auction.job_id,
                winner_agent_id=winning_bid.agent_id,
                winner_agent_name=winner_agent_name,
                winning_bid=winning_bid.amount,
                total_bids=total_bids,
                status=AuctionStatus.CLOSED,
            )
        else:
            # No bids - cancel the auction
            self.auctions_table.update({
                "status": AuctionStatus.CANCELLED.value,
                "closed_at": now,
            }).eq("id", str(auction_id)).execute()

            # Reset job status to pending
            await self.job_service.update(
                auction.job_id,
                JobUpdate(status=JobStatus.PENDING),
            )

            result = AuctionResult(
                auction_id=auction_id,
                job_id=auction.job_id,
                winner_agent_id=None,
                winner_agent_name=None,
                winning_bid=None,
                total_bids=total_bids,
                status=AuctionStatus.CANCELLED,
            )

        await get_event_manager().publish_auction_closed(
            auction_id, auction.job_id, job.title, result.winner_agent_id,
            result.winner_agent_name, result.winning_bid, total_bids, result.status.value,
        )
        return result

    async def get_close_times(self, job_ids: list[UUID]) -> dict[UUID, datetime]:
        """When each job's auction closed (= when work on it started)."""
        if not job_ids:
            return {}
        result = self.auctions_table.select("job_id, closed_at").in_(
            "job_id", [str(j) for j in job_ids]
        ).eq("status", AuctionStatus.CLOSED.value).execute()
        return {
            UUID(row["job_id"]): datetime.fromisoformat(row["closed_at"])
            for row in result.data
            if row["closed_at"]
        }

    def _to_auction(self, data: dict) -> Auction:
        return Auction(
            id=data["id"],
            job_id=data["job_id"],
            duration_seconds=data["duration_seconds"],
            status=AuctionStatus(data["status"]),
            winning_bid_id=data.get("winning_bid_id"),
            winning_agent_id=data.get("winning_agent_id"),
            winning_amount=data.get("winning_amount"),
            started_at=data["started_at"],
            ends_at=data["ends_at"],
            closed_at=data.get("closed_at"),
        )

    def _to_bid(self, data: dict) -> Bid:
        return Bid(
            id=data["id"],
            auction_id=data["auction_id"],
            agent_id=data["agent_id"],
            amount=data["amount"],
            created_at=data["created_at"],
            is_winning=data.get("is_winning", False),
            work_cost=data.get("work_cost"),
        )

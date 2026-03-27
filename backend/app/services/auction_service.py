import random
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
from app.models.job import Job, JobStatus
from app.models.agent import AgentSpecialty, Agent
from app.services.database import DatabaseService
from app.services.job_service import JobService
from app.services.agent_service import AgentService
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

        # Get bid stats
        bids = await self.get_auction_bids(auction_id)
        bid_count = len(bids)
        lowest_bid = min(b.amount for b in bids) if bids else None

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
        )

    async def get_active_auctions(
        self,
        specialty: AgentSpecialty | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuctionWithJob]:
        """Get all active auctions with job details."""
        query = self.auctions_table.select("*").eq("status", AuctionStatus.ACTIVE.value)
        result = query.order("ends_at", desc=False).range(offset, offset + limit - 1).execute()

        auctions_with_jobs = []
        for row in result.data:
            auction = self._to_auction(row)
            job = await self.job_service.get_by_id(auction.job_id)
            if not job:
                continue

            # Filter by specialty if specified
            if specialty and job.specialty != specialty:
                continue

            bids = await self.get_auction_bids(auction.id)
            bid_count = len(bids)
            lowest_bid = min(b.amount for b in bids) if bids else None

            auctions_with_jobs.append(
                AuctionWithJob(
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
                )
            )

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

        # Validate bid amount is positive
        if bid_data.amount <= 0:
            raise ValueError("Bid amount must be positive")

        # Create the bid
        now = datetime.now(timezone.utc).isoformat()
        data = {
            "auction_id": str(bid_data.auction_id),
            "agent_id": str(bid_data.agent_id),
            "amount": bid_data.amount,
            "created_at": now,
            "is_winning": False,
        }

        result = self.bids_table.insert(data).execute()
        return self._to_bid(result.data[0])

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

    async def get_winning_bid(self, auction_id: UUID) -> Bid | None:
        """Determine the winning bid (lowest amount, earliest if tie)."""
        bids = await self.get_auction_bids(auction_id)
        if not bids:
            return None

        # Find the lowest bid
        lowest_amount = min(b.amount for b in bids)
        lowest_bids = [b for b in bids if b.amount == lowest_amount]

        # If tie, return the first one (earliest by created_at)
        # The query already orders by created_at after amount
        return lowest_bids[0]

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

        # Determine winner
        winning_bid = await self.get_winning_bid(auction_id)

        now = datetime.now(timezone.utc).isoformat()

        if winning_bid:
            # Mark the winning bid
            self.bids_table.update({"is_winning": True}).eq(
                "id", str(winning_bid.id)
            ).execute()

            # Get winner agent info
            winner_agent = await self.agent_service.get_by_id(winning_bid.agent_id)
            winner_agent_name = winner_agent.name if winner_agent else None

            # Transfer credits: winner pays the bid amount
            await self.agent_service.update_credits(
                winning_bid.agent_id, -winning_bid.amount
            )

            # Increment winner's job count
            await self.agent_service.increment_jobs(winning_bid.agent_id)

            # Assign job to winner
            await self.job_service.assign_to_agent(
                auction.job_id, winning_bid.agent_id, winning_bid.amount
            )

            # Update auction with winner info
            self.auctions_table.update({
                "status": AuctionStatus.CLOSED.value,
                "winning_bid_id": str(winning_bid.id),
                "winning_agent_id": str(winning_bid.agent_id),
                "winning_amount": winning_bid.amount,
                "closed_at": now,
            }).eq("id", str(auction_id)).execute()

            return AuctionResult(
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
                type("JobUpdate", (), {"status": JobStatus.PENDING})(),
            )

            return AuctionResult(
                auction_id=auction_id,
                job_id=auction.job_id,
                winner_agent_id=None,
                winner_agent_name=None,
                winning_bid=None,
                total_bids=0,
                status=AuctionStatus.CANCELLED,
            )

    async def get_agent_bids(
        self,
        agent_id: UUID,
        auction_id: UUID | None = None,
    ) -> list[Bid]:
        """Get all bids placed by an agent."""
        query = self.bids_table.select("*").eq("agent_id", str(agent_id))
        if auction_id:
            query = query.eq("auction_id", str(auction_id))
        result = query.order("created_at", desc=True).execute()
        return [self._to_bid(row) for row in result.data]

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
        )

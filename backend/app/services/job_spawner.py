import asyncio
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from app.services.database import get_database_service
from app.services.job_service import JobService
from app.services.auction_service import AuctionService
from app.services.agent_service import AgentService
from app.services.agent_intelligence import AgentIntelligenceService
from app.services.job_templates import generate_job
from app.models.job import JobCreate
from app.models.auction import AuctionCreate
from app.config import get_settings

logger = logging.getLogger(__name__)


class JobSpawner:
    """Background service that spawns jobs and manages auction lifecycle."""

    def __init__(self):
        self.settings = get_settings()
        self._running = False
        self._spawn_task: asyncio.Task | None = None
        self._close_task: asyncio.Task | None = None
        self._complete_task: asyncio.Task | None = None
        self._bidding_task: asyncio.Task | None = None

    async def start(self):
        """Start all background tasks."""
        if self._running:
            return

        self._running = True
        logger.info("Starting JobSpawner background tasks")

        self._spawn_task = asyncio.create_task(self._job_spawn_loop())
        self._close_task = asyncio.create_task(self._auction_close_loop())
        self._complete_task = asyncio.create_task(self._job_completion_loop())
        self._bidding_task = asyncio.create_task(self._agent_bidding_loop())

    async def stop(self):
        """Stop all background tasks."""
        self._running = False
        logger.info("Stopping JobSpawner background tasks")

        tasks = [self._spawn_task, self._close_task, self._complete_task, self._bidding_task]
        for task in tasks:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    async def _job_spawn_loop(self):
        """Spawn a new job every 30 seconds and start an auction."""
        while self._running:
            try:
                await self._spawn_job_and_auction()
            except Exception as e:
                logger.error(f"Error spawning job: {e}")

            await asyncio.sleep(self.settings.job_spawn_interval_seconds)

    async def _spawn_job_and_auction(self):
        """Create a new job from template and start its auction."""
        db = get_database_service()
        job_service = JobService(db)
        auction_service = AuctionService(db)

        # Generate random job from templates
        job_data = generate_job()
        job_create = JobCreate(
            title=job_data["title"],
            description=job_data["description"],
            specialty=job_data["specialty"],
            base_price=job_data["base_price"],
        )

        # Create the job
        job = await job_service.create(job_create)
        logger.info(f"Spawned new job: {job.title} ({job.specialty.value}) - ${job.base_price}")

        # Start auction for the job
        auction_create = AuctionCreate(job_id=job.id)
        auction = await auction_service.create_auction(auction_create)
        logger.info(f"Started auction {auction.id} for job {job.id}, ends at {auction.ends_at}")

        return auction

    async def _auction_close_loop(self):
        """Check for and close expired auctions every 5 seconds."""
        while self._running:
            try:
                await self._close_expired_auctions()
            except Exception as e:
                logger.error(f"Error closing auctions: {e}")

            await asyncio.sleep(5)

    async def _close_expired_auctions(self):
        """Find and close all auctions that have passed their end time."""
        db = get_database_service()
        auction_service = AuctionService(db)

        expired = await auction_service.get_expired_auctions()
        for auction in expired:
            try:
                result = await auction_service.close_auction(auction.id)
                if result.winner_agent_id:
                    logger.info(
                        f"Auction {auction.id} closed: winner {result.winner_agent_name} "
                        f"with bid ${result.winning_bid}"
                    )
                else:
                    logger.info(f"Auction {auction.id} cancelled: no bids")
            except Exception as e:
                logger.error(f"Error closing auction {auction.id}: {e}")

    async def _job_completion_loop(self):
        """Check for and complete jobs after their duration expires."""
        while self._running:
            try:
                await self._complete_expired_jobs()
            except Exception as e:
                logger.error(f"Error completing jobs: {e}")

            await asyncio.sleep(10)

    async def _complete_expired_jobs(self):
        """Complete jobs that have been in progress long enough."""
        db = get_database_service()
        job_service = JobService(db)
        agent_service = AgentService(db)

        # Get all in-progress jobs
        from app.models.job import JobStatus
        jobs = await job_service.get_all(status=JobStatus.IN_PROGRESS, limit=500)

        now = datetime.now(timezone.utc)
        completion_duration = self.settings.job_completion_duration_seconds

        for job in jobs:
            # Check if job has been in progress long enough
            # We use created_at + duration since we don't track when job started
            job_created = job.created_at
            if hasattr(job_created, 'tzinfo') and job_created.tzinfo is None:
                job_created = job_created.replace(tzinfo=timezone.utc)

            elapsed = (now - job_created).total_seconds()

            if elapsed >= completion_duration:
                try:
                    # Complete the job
                    completed_job = await job_service.complete_job(job.id)
                    if completed_job and completed_job.assigned_agent_id:
                        # Credit the agent with the winning bid amount
                        await agent_service.update_credits(
                            completed_job.assigned_agent_id,
                            completed_job.winning_bid or 0,
                        )
                        # Free up agent capacity
                        await agent_service.decrement_jobs(completed_job.assigned_agent_id)
                        logger.info(
                            f"Job {job.id} completed, agent earned ${completed_job.winning_bid}"
                        )
                except Exception as e:
                    logger.error(f"Error completing job {job.id}: {e}")


    async def _agent_bidding_loop(self):
        """Trigger agents to bid on active auctions every 10 seconds."""
        while self._running:
            try:
                await self._trigger_agent_bids()
            except Exception as e:
                logger.error(f"Error in agent bidding loop: {e}")

            await asyncio.sleep(10)  # Check every 10 seconds

    async def _trigger_agent_bids(self):
        """Trigger all eligible agents to bid on all active auctions."""
        db = get_database_service()
        auction_service = AuctionService(db)
        intelligence_service = AgentIntelligenceService(db)

        # Get all active auctions
        active_auctions = await auction_service.get_active_auctions(limit=20)

        for auction in active_auctions:
            # Only trigger bidding if auction has more than 15 seconds remaining
            if auction.time_remaining_seconds < 15:
                continue

            try:
                # Trigger agents matching the job specialty to make decisions
                decisions = await intelligence_service.trigger_all_agents_for_auction(
                    auction.id,
                    specialty_match_only=True,
                )
                bid_count = sum(1 for d in decisions if d.decision_type.value == "BID")
                if bid_count > 0:
                    logger.info(
                        f"Auction {auction.id} ({auction.job_title}): "
                        f"{bid_count}/{len(decisions)} agents placed bids"
                    )
            except Exception as e:
                logger.error(f"Error triggering bids for auction {auction.id}: {e}")


# Global spawner instance
_spawner: JobSpawner | None = None


def get_job_spawner() -> JobSpawner:
    global _spawner
    if _spawner is None:
        _spawner = JobSpawner()
    return _spawner


@asynccontextmanager
async def lifespan_job_spawner():
    """Context manager for FastAPI lifespan to manage job spawner."""
    spawner = get_job_spawner()
    await spawner.start()
    try:
        yield
    finally:
        await spawner.stop()

"""
API routes for marketplace analytics.

Provides real market data for the analytics dashboard.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.database import DatabaseService, get_database_service
from app.models.agent import AgentSpecialty
from app.services.season_service import SeasonService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class MarketStats(BaseModel):
    """Overall marketplace statistics."""
    total_volume: int
    avg_winning_bid: float
    active_agents: int
    jobs_completed: int
    active_auctions: int


class SpecialtyShare(BaseModel):
    """Market share by specialty."""
    specialty: str
    value: int
    percentage: float


class TrendPoint(BaseModel):
    """A point on a trend chart."""
    date: str
    value: float


class LeaderboardEntry(BaseModel):
    """Live season standing (ranked by credits)."""
    rank: int
    agent_id: str
    agent_name: str
    specialty: str
    credits: int
    profit: int
    jobs_won: int
    win_rate: float
    bankrupt: bool


class AnalyticsResponse(BaseModel):
    """Complete analytics response."""
    market_stats: MarketStats
    specialty_share: list[SpecialtyShare]
    bid_trend: list[TrendPoint]
    volume_trend: list[TrendPoint]
    leaderboard: list[LeaderboardEntry]


@router.get("/market-stats", response_model=MarketStats)
async def get_market_stats(
    db: DatabaseService = Depends(get_database_service),
) -> MarketStats:
    """Get overall marketplace statistics."""
    # Count active agents
    agents_result = db.table("agents").select("id", count="exact").eq("is_active", True).execute()
    active_agents = agents_result.count or 0

    # Count active auctions
    auctions_result = db.table("auctions").select("id", count="exact").eq("status", "active").execute()
    active_auctions = auctions_result.count or 0

    # Get completed auctions with winning amounts
    completed_result = db.table("auctions").select("winning_amount").eq("status", "closed").not_.is_("winning_amount", "null").execute()
    completed_auctions = completed_result.data or []

    jobs_completed = len(completed_auctions)
    total_volume = sum(a.get("winning_amount", 0) or 0 for a in completed_auctions)
    avg_winning_bid = total_volume / jobs_completed if jobs_completed > 0 else 0

    return MarketStats(
        total_volume=total_volume,
        avg_winning_bid=round(avg_winning_bid, 2),
        active_agents=active_agents,
        jobs_completed=jobs_completed,
        active_auctions=active_auctions,
    )


@router.get("/specialty-share", response_model=list[SpecialtyShare])
async def get_specialty_share(
    db: DatabaseService = Depends(get_database_service),
) -> list[SpecialtyShare]:
    """Get market share by specialty (based on completed auctions)."""
    # Get all completed auctions with job specialty
    auctions_result = db.table("auctions").select("job_id").eq("status", "closed").execute()

    if not auctions_result.data:
        # Return default distribution if no data
        specialties = ["coder", "designer", "writer", "data_analyst", "tester"]
        return [SpecialtyShare(specialty=s, value=0, percentage=20.0) for s in specialties]

    # Count by specialty
    specialty_counts: dict[str, int] = {}
    for auction in auctions_result.data:
        job_result = db.table("jobs").select("specialty").eq("id", auction["job_id"]).execute()
        if job_result.data:
            specialty = job_result.data[0]["specialty"]
            specialty_counts[specialty] = specialty_counts.get(specialty, 0) + 1

    total = sum(specialty_counts.values())
    if total == 0:
        total = 1

    # Build response
    result = []
    for specialty in ["coder", "designer", "writer", "data_analyst", "tester"]:
        count = specialty_counts.get(specialty, 0)
        result.append(SpecialtyShare(
            specialty=specialty,
            value=count,
            percentage=round(count / total * 100, 1),
        ))

    return result


@router.get("/bid-trend", response_model=list[TrendPoint])
async def get_bid_trend(
    days: int = 14,
    db: DatabaseService = Depends(get_database_service),
) -> list[TrendPoint]:
    """Get average winning bid trend over time."""
    result = []
    now = datetime.now(timezone.utc)

    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Get auctions closed on this day
        auctions = db.table("auctions").select("winning_amount").eq(
            "status", "closed"
        ).gte("closed_at", day_start.isoformat()).lt("closed_at", day_end.isoformat()).execute()

        amounts = [a.get("winning_amount", 0) or 0 for a in auctions.data or [] if a.get("winning_amount")]
        avg = sum(amounts) / len(amounts) if amounts else 0

        result.append(TrendPoint(
            date=day.strftime("%b %d"),
            value=round(avg, 2),
        ))

    return result


@router.get("/volume-trend", response_model=list[TrendPoint])
async def get_volume_trend(
    days: int = 14,
    db: DatabaseService = Depends(get_database_service),
) -> list[TrendPoint]:
    """Get job volume trend over time."""
    result = []
    now = datetime.now(timezone.utc)

    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Count jobs created on this day
        jobs = db.table("jobs").select("id", count="exact").gte(
            "created_at", day_start.isoformat()
        ).lt("created_at", day_end.isoformat()).execute()

        result.append(TrendPoint(
            date=day.strftime("%b %d"),
            value=jobs.count or 0,
        ))

    return result


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 10,
    db: DatabaseService = Depends(get_database_service),
) -> list[LeaderboardEntry]:
    """Current season standings: most credits first."""
    seasons = SeasonService(db)
    current = await seasons.get_current()
    standings = await seasons.standings(current["started_at"] if current else None)
    return [LeaderboardEntry(**s) for s in standings[:limit]]


@router.get("/all", response_model=AnalyticsResponse)
async def get_all_analytics(
    db: DatabaseService = Depends(get_database_service),
) -> AnalyticsResponse:
    """Get all analytics data in one request."""
    market_stats = await get_market_stats(db)
    specialty_share = await get_specialty_share(db)
    bid_trend = await get_bid_trend(14, db)
    volume_trend = await get_volume_trend(14, db)
    leaderboard = await get_leaderboard(10, db)

    return AnalyticsResponse(
        market_stats=market_stats,
        specialty_share=specialty_share,
        bid_trend=bid_trend,
        volume_trend=volume_trend,
        leaderboard=leaderboard,
    )

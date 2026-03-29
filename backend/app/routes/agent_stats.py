"""
API routes for agent statistics and performance metrics.

Provides real stats for the user dashboard.
"""

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from pydantic import BaseModel

from app.services.database import DatabaseService, get_database_service

router = APIRouter(prefix="/api/agents", tags=["agent-stats"])


class AgentStats(BaseModel):
    """Statistics for a single agent."""
    agent_id: str
    total_earnings: int
    jobs_won: int
    jobs_completed: int
    win_rate: float
    active_bids: int
    active_trades: int
    total_bids: int
    avg_bid_amount: float


class AgentFullStats(AgentStats):
    """Extended statistics including recent activity."""
    recent_wins: list[dict]
    recent_bids: list[dict]
    specialty_breakdown: dict


class UserDashboardStats(BaseModel):
    """Aggregate statistics for user dashboard."""
    total_agents: int
    active_agents: int
    total_earnings: int
    total_jobs_won: int
    avg_win_rate: float
    total_active_bids: int


@router.get("/{agent_id}/stats", response_model=AgentStats)
async def get_agent_stats(
    agent_id: UUID,
    db: DatabaseService = Depends(get_database_service),
) -> AgentStats:
    """Get statistics for a specific agent."""
    agent_id_str = str(agent_id)

    # Get agent to verify it exists
    agent_result = db.table("agents").select("*").eq("id", agent_id_str).execute()
    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_result.data[0]

    # Count total bids placed by this agent
    bids_result = db.table("bids").select("id, amount", count="exact").eq("agent_id", agent_id_str).execute()
    total_bids = bids_result.count or 0
    bid_amounts = [b["amount"] for b in bids_result.data] if bids_result.data else []
    avg_bid = sum(bid_amounts) / len(bid_amounts) if bid_amounts else 0

    # Count winning bids (where agent won the auction)
    winning_auctions = db.table("auctions").select("id, winning_amount", count="exact").eq("winning_agent_id", agent_id_str).eq("status", "closed").execute()
    jobs_won = winning_auctions.count or 0
    total_earnings = sum(a.get("winning_amount", 0) or 0 for a in winning_auctions.data) if winning_auctions.data else 0

    # Count completed jobs assigned to this agent
    completed_jobs = db.table("jobs").select("id", count="exact").eq("assigned_agent_id", agent_id_str).eq("status", "completed").execute()
    jobs_completed = completed_jobs.count or 0

    # Calculate win rate
    win_rate = (jobs_won / total_bids * 100) if total_bids > 0 else 0

    # Count active bids (bids on active auctions)
    # First get active auction IDs
    active_auctions = db.table("auctions").select("id").eq("status", "active").execute()
    active_auction_ids = [a["id"] for a in active_auctions.data] if active_auctions.data else []

    active_bids = 0
    if active_auction_ids:
        for auction_id in active_auction_ids:
            bid_check = db.table("bids").select("id", count="exact").eq("agent_id", agent_id_str).eq("auction_id", auction_id).execute()
            if bid_check.count and bid_check.count > 0:
                active_bids += 1

    # Count active trades
    active_trades_result = db.table("trades").select("id", count="exact").or_(
        f"agent_a_id.eq.{agent_id_str},agent_b_id.eq.{agent_id_str}"
    ).eq("status", "in_progress").execute()
    active_trades = active_trades_result.count or 0

    return AgentStats(
        agent_id=agent_id_str,
        total_earnings=total_earnings,
        jobs_won=jobs_won,
        jobs_completed=jobs_completed,
        win_rate=round(win_rate, 1),
        active_bids=active_bids,
        active_trades=active_trades,
        total_bids=total_bids,
        avg_bid_amount=round(avg_bid, 2),
    )


@router.get("/{agent_id}/full-stats", response_model=AgentFullStats)
async def get_agent_full_stats(
    agent_id: UUID,
    db: DatabaseService = Depends(get_database_service),
) -> AgentFullStats:
    """Get extended statistics including recent activity."""
    # Get basic stats
    basic_stats = await get_agent_stats(agent_id, db)
    agent_id_str = str(agent_id)

    # Get recent winning auctions with job details
    recent_wins_result = db.table("auctions").select(
        "id, winning_amount, closed_at, job_id"
    ).eq("winning_agent_id", agent_id_str).eq("status", "closed").order(
        "closed_at", desc=True
    ).limit(5).execute()

    recent_wins = []
    for auction in recent_wins_result.data or []:
        # Get job details
        job_result = db.table("jobs").select("title, specialty").eq("id", auction["job_id"]).execute()
        job = job_result.data[0] if job_result.data else {}
        recent_wins.append({
            "auction_id": auction["id"],
            "amount": auction["winning_amount"],
            "closed_at": auction["closed_at"],
            "job_title": job.get("title", "Unknown"),
            "specialty": job.get("specialty", "unknown"),
        })

    # Get recent bids
    recent_bids_result = db.table("bids").select(
        "id, amount, auction_id, created_at, is_winning"
    ).eq("agent_id", agent_id_str).order("created_at", desc=True).limit(10).execute()

    recent_bids = []
    for bid in recent_bids_result.data or []:
        recent_bids.append({
            "bid_id": bid["id"],
            "amount": bid["amount"],
            "auction_id": bid["auction_id"],
            "created_at": bid["created_at"],
            "is_winning": bid["is_winning"],
        })

    # Get specialty breakdown of won jobs
    specialty_breakdown = {}
    if recent_wins_result.data:
        for win in recent_wins_result.data:
            job_result = db.table("jobs").select("specialty").eq("id", win["job_id"]).execute()
            if job_result.data:
                spec = job_result.data[0]["specialty"]
                specialty_breakdown[spec] = specialty_breakdown.get(spec, 0) + 1

    return AgentFullStats(
        **basic_stats.model_dump(),
        recent_wins=recent_wins,
        recent_bids=recent_bids,
        specialty_breakdown=specialty_breakdown,
    )


@router.get("/user/{user_id}/dashboard-stats", response_model=UserDashboardStats)
async def get_user_dashboard_stats(
    user_id: UUID,
    db: DatabaseService = Depends(get_database_service),
) -> UserDashboardStats:
    """Get aggregate statistics for a user's dashboard."""
    user_id_str = str(user_id)

    # Get all agents for this user
    agents_result = db.table("agents").select("id, is_active").eq("user_id", user_id_str).execute()
    agents = agents_result.data or []

    total_agents = len(agents)
    active_agents = sum(1 for a in agents if a["is_active"])

    if not agents:
        return UserDashboardStats(
            total_agents=0,
            active_agents=0,
            total_earnings=0,
            total_jobs_won=0,
            avg_win_rate=0,
            total_active_bids=0,
        )

    agent_ids = [a["id"] for a in agents]

    # Aggregate stats across all agents
    total_earnings = 0
    total_jobs_won = 0
    total_bids = 0
    total_active_bids = 0

    for agent_id in agent_ids:
        # Earnings from won auctions
        auctions = db.table("auctions").select("winning_amount", count="exact").eq(
            "winning_agent_id", agent_id
        ).eq("status", "closed").execute()
        total_jobs_won += auctions.count or 0
        total_earnings += sum(a.get("winning_amount", 0) or 0 for a in auctions.data or [])

        # Total bids
        bids = db.table("bids").select("id", count="exact").eq("agent_id", agent_id).execute()
        total_bids += bids.count or 0

        # Active bids
        active_auctions = db.table("auctions").select("id").eq("status", "active").execute()
        for auction in active_auctions.data or []:
            bid_check = db.table("bids").select("id", count="exact").eq(
                "agent_id", agent_id
            ).eq("auction_id", auction["id"]).execute()
            if bid_check.count and bid_check.count > 0:
                total_active_bids += 1

    avg_win_rate = (total_jobs_won / total_bids * 100) if total_bids > 0 else 0

    return UserDashboardStats(
        total_agents=total_agents,
        active_agents=active_agents,
        total_earnings=total_earnings,
        total_jobs_won=total_jobs_won,
        avg_win_rate=round(avg_win_rate, 1),
        total_active_bids=total_active_bids,
    )

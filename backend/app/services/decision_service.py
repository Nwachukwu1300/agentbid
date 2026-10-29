"""Read-only views of agent decisions: why each agent won or lost an auction."""

from uuid import UUID

from app.config import get_settings
from app.models.auction import AuctionStatus, AuctionWithJob
from app.services.auction_service import AuctionService
from app.services.database import DatabaseService


def explain(
    status: AuctionStatus,
    is_winner: bool,
    is_leader: bool,
    best_bid: int | None,
    winning_amount: int | None,
    lead: int | None,
    work_cost: int,
) -> tuple[str, str]:
    """(outcome, one-line explanation) for one agent in one auction."""
    if best_bid is None:
        return "passed", "Never bid."
    if status == AuctionStatus.CANCELLED:
        return "no_winner", f"Bid {best_bid}, but the auction closed without a winner."
    if status == AuctionStatus.ACTIVE:
        if is_leader or lead is None:
            return "leading", f"Leading at {best_bid}."
        if best_bid == lead:
            return "behind", f"Bid {lead}, same as the lead but later. Ties go to the earlier bid."
        return "behind", f"Best bid {best_bid}, {best_bid - lead} above the current lead of {lead}."
    if is_winner:
        profit = best_bid - work_cost
        if profit < 0:
            return "won", f"Won at {best_bid}, below the work cost of {work_cost}: a loss of {-profit}."
        return "won", f"Won at {best_bid}. Profit after work cost: {profit}."
    if winning_amount is None:
        return "lost", f"Best bid {best_bid}."
    if best_bid > winning_amount:
        return "lost", f"Best bid {best_bid}, {best_bid - winning_amount} above the winning {winning_amount}."
    if best_bid == winning_amount:
        return "lost", f"Bid {winning_amount}, same as the winner but later. Ties go to the earlier bid."
    return "lost", (
        f"Had the lowest bid ({best_bid}) but was full or out of credits at closing time, "
        "so the job went to the next bidder."
    )


class DecisionService:
    def __init__(self, db: DatabaseService):
        self.db = db
        self.decisions = db.table("agent_decisions")
        self.auction_service = AuctionService(db)
        self.settings = get_settings()

    def _agents_by_id(self, agent_ids: set[str]) -> dict[str, dict]:
        if not agent_ids:
            return {}
        rows = self.db.table("agents").select("id, name, specialty").in_("id", list(agent_ids)).execute().data
        return {row["id"]: row for row in rows}

    async def for_auction(self, auction_id: UUID) -> list[dict]:
        """Every stored decision on an auction, oldest first, with the agent's name."""
        rows = self.decisions.select("*").eq("auction_id", str(auction_id)).order("created_at").execute().data
        agents = self._agents_by_id({row["agent_id"] for row in rows})
        return [
            {
                **row,
                "agent_name": agents.get(row["agent_id"], {}).get("name", "Unknown agent"),
                "agent_specialty": agents.get(row["agent_id"], {}).get("specialty"),
            }
            for row in rows
        ]

    async def auction_breakdown(self, auction_id: UUID) -> dict | None:
        """The auction, its decision timeline, and why each agent won or lost."""
        auction: AuctionWithJob | None = await self.auction_service.get_auction_with_job(auction_id)
        if not auction:
            return None
        work_cost = self.settings.work_cost(auction.job_base_price)
        decisions = await self.for_auction(auction_id)

        # Best bid per agent from the bids table (decisions can include failed bids)
        best: dict[str, int] = {}
        for bid in await self.auction_service.get_auction_bids(auction_id):
            best.setdefault(str(bid.agent_id), bid.amount)  # bids are sorted lowest first

        last_reasoning = {d["agent_id"]: d["reasoning"] for d in decisions}  # oldest first, so last wins
        agent_ids = set(best) | set(last_reasoning)
        agents = self._agents_by_id(agent_ids)
        winner_id = str(auction.winning_agent_id) if auction.winning_agent_id else None
        leader_id = str(auction.leading_agent_id) if auction.leading_agent_id else None

        summaries = []
        for agent_id in agent_ids:
            outcome, explanation = explain(
                auction.status, agent_id == winner_id, agent_id == leader_id, best.get(agent_id),
                auction.winning_amount, auction.lowest_bid, work_cost,
            )
            summaries.append({
                "agent_id": agent_id,
                "agent_name": agents.get(agent_id, {}).get("name", "Unknown agent"),
                "specialty": agents.get(agent_id, {}).get("specialty"),
                "best_bid": best.get(agent_id),
                "last_reasoning": last_reasoning.get(agent_id),
                "outcome": outcome,
                "explanation": explanation,
            })
        # Winner first, then lowest bid; agents who never bid last
        summaries.sort(key=lambda s: (s["outcome"] != "won", s["best_bid"] is None, s["best_bid"] or 0))

        return {
            "auction": auction.model_dump(mode="json"),
            "work_cost": work_cost,
            "decisions": decisions,
            "agents": summaries,
        }

    async def for_agent(self, agent_id: UUID, limit: int = 20) -> list[dict]:
        """An agent's latest decisions with the job and how the auction turned out."""
        rows = self.decisions.select("*").eq("agent_id", str(agent_id)).order(
            "created_at", desc=True
        ).range(0, limit - 1).execute().data
        auction_ids = list({row["auction_id"] for row in rows})
        auctions = {
            row["id"]: row
            for row in (
                self.db.table("auctions").select("id, job_id, status, winning_agent_id, winning_amount")
                .in_("id", auction_ids).execute().data if auction_ids else []
            )
        }
        job_ids = list({a["job_id"] for a in auctions.values()})
        jobs = {
            row["id"]: row
            for row in (
                self.db.table("jobs").select("id, title, specialty").in_("id", job_ids).execute().data
                if job_ids else []
            )
        }

        history = []
        for row in rows:
            auction = auctions.get(row["auction_id"], {})
            job = jobs.get(auction.get("job_id"), {})
            status = auction.get("status")
            if status == AuctionStatus.ACTIVE.value:
                outcome = "open"
            elif status == AuctionStatus.CLOSED.value:
                outcome = "won" if auction.get("winning_agent_id") == str(agent_id) else "lost"
            else:
                outcome = "no_winner"
            history.append({
                **row,
                "job_title": job.get("title", "Unknown job"),
                "job_specialty": job.get("specialty"),
                "auction_status": status,
                "winning_amount": auction.get("winning_amount"),
                "outcome": outcome,
            })
        return history

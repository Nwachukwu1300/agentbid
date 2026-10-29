"""Auction lifecycle, arena economy and season checks against an in-memory fake of the Supabase client.

Run from backend/:  ./venv/bin/python -m tests.test_auction_lifecycle
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, patch

for key in ("SUPABASE_URL", "SUPABASE_KEY", "OPENAI_API_KEY"):
    os.environ.setdefault(key, "test")

from app.models.agent import AgentSpecialty  # noqa: E402
from app.models.auction import AuctionCreate, BidCreate  # noqa: E402
from app.models.job import JobCreate, JobStatus  # noqa: E402
from app.services.agent_service import AgentService  # noqa: E402
from app.services.auction_service import AuctionService  # noqa: E402
from app.services.database import DatabaseService  # noqa: E402
from app.services.event_manager import get_event_manager  # noqa: E402
from app.services.job_service import JobService  # noqa: E402
from app.services.job_spawner import JobSpawner  # noqa: E402
from app.services.agent_intelligence import AgentIntelligenceService  # noqa: E402
from app.models.agent_decision import DecisionType, AgentState, AuctionContext  # noqa: E402
from app.services.season_service import SeasonService  # noqa: E402
from app.services.decision_service import DecisionService, explain  # noqa: E402
from app.models.auction import AuctionStatus  # noqa: E402
from app.models.agent_decision import AgentDecisionResponse  # noqa: E402


class FakeQuery:
    """Supports the subset of the supabase-py query builder these services use."""

    def __init__(self, rows: list[dict], action: str, payload: dict | list[dict]):
        self.rows, self.action, self.payload = rows, action, payload
        self.filters, self.orders, self.bounds = [], [], None

    def eq(self, col, val):
        self.filters.append(lambda r: str(r.get(col)) == str(val))
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r[col] >= val)
        return self

    def lt(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r[col] < val)
        return self

    def in_(self, col, vals):
        vals = {str(v) for v in vals}
        self.filters.append(lambda r: str(r.get(col)) in vals)
        return self

    def order(self, col, desc=False):
        self.orders.append((col, desc))
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    async def execute(self):  # the real client is async
        if self.action == "insert":
            payload = self.payload if isinstance(self.payload, list) else [self.payload]
            new_rows = [{"id": str(uuid.uuid4()), **row} for row in payload]
            self.rows.extend(new_rows)
            return SimpleNamespace(data=new_rows, count=len(new_rows))
        matched = [r for r in self.rows if all(f(r) for f in self.filters)]
        if self.action == "update":
            for r in matched:
                r.update(self.payload)
            return SimpleNamespace(data=matched, count=len(matched))
        for col, desc in reversed(self.orders):  # stable sort: last key first
            matched.sort(key=lambda r: r[col], reverse=desc)
        if self.bounds:
            matched = matched[self.bounds[0] : self.bounds[1] + 1]
        return SimpleNamespace(data=[dict(r) for r in matched], count=len(matched))


class FakeTable:
    """Like supabase-py, each select/insert/update starts a fresh query."""

    def __init__(self, rows: list[dict]):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return FakeQuery(self.rows, "select", {})

    def insert(self, data: dict | list[dict]):
        return FakeQuery(self.rows, "insert", data)

    def update(self, data: dict):
        return FakeQuery(self.rows, "update", data)


class FakeRPC:
    def __init__(self, result):
        self.result = result

    async def execute(self):
        return SimpleNamespace(data=self.result)


class FakeDB:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.ai_usage: dict[tuple[str, str], int] = {}

    def table(self, name):
        return FakeTable(self.tables.setdefault(name, []))

    def rpc(self, fn, params):
        assert fn == "spend_ai_call"
        key = (params["p_day"], params["p_key"])
        if params["p_limit"] <= 0 or self.ai_usage.get(key, 0) >= params["p_limit"]:
            return FakeRPC(False)
        self.ai_usage[key] = self.ai_usage.get(key, 0) + 1
        return FakeRPC(True)


async def main():
    db = cast(DatabaseService, FakeDB())
    fake = cast(FakeDB, db)
    agents, jobs, auctions = AgentService(db), JobService(db), AuctionService(db)
    events: asyncio.Queue = asyncio.Queue()
    await get_event_manager().subscribe(events)

    def new_agent(name, current_jobs=0):
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": str(uuid.uuid4()), "user_id": str(uuid.uuid4()), "name": name,
               "specialty": "coder", "auction_instructions": "x", "credits": 1000,
               "current_jobs": current_jobs, "is_active": True, "created_at": now, "updated_at": now}
        fake.tables.setdefault("agents", []).append(row)
        return uuid.UUID(row["id"])

    cheap = new_agent("Cheap", current_jobs=4)
    early = new_agent("Early")
    late = new_agent("Late")

    job = await jobs.create(JobCreate(title="Build API", description="d",
                                      specialty=AgentSpecialty.CODER, base_price=200))
    # Old job: proves the completion timer runs from auction close, not job creation
    fake.tables["jobs"][0]["created_at"] = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    auction = await auctions.create_auction(AuctionCreate(job_id=job.id))

    try:
        await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=late, amount=201))
        raise AssertionError("bid above the 200 budget must be rejected")
    except ValueError:
        pass

    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=cheap, amount=90))
    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=early, amount=150))
    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=late, amount=150))

    # Sealed: one bid per agent per auction, and nobody can see the lead while it is live
    try:
        await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=early, amount=140))
        raise AssertionError("second bid from the same agent must be rejected")
    except ValueError as e:
        assert "one bid per agent" in str(e)
    live = await auctions.get_auction_with_job(auction.id)
    assert live and live.lowest_bid == 90 and live.public_view().lowest_bid is None
    assert live.public_view().leading_agent_id is None
    costs = {b["agent_id"]: b["work_cost"] for b in fake.tables["bids"]}
    assert costs[str(cheap)] == 140 and costs[str(early)] == 100, "cost = 100 base +10% per running job (Cheap had 4)"

    # Cheap fills up before the auction closes, so it can't take the job
    await agents.increment_jobs(cheap)

    result = await auctions.close_auction(auction.id)
    assert result.winner_agent_id == early, "lowest bid from an agent with room wins; ties go to the earliest"
    assert result.winning_bid == 150 and result.total_bids == 3

    winner = await agents.get_by_id(early)
    assert winner and winner.credits == 1000, "winner is not charged at close"
    assert winner.current_jobs == 1
    assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.IN_PROGRESS, "won job starts immediately"

    await asyncio.sleep(0)  # events are handed to this loop as scheduled callbacks
    seen = [events.get_nowait() for _ in range(events.qsize())]
    assert [e["type"] for e in seen] == ["auction_created", "bid_placed", "bid_placed", "bid_placed", "auction_closed"]
    assert "amount" not in seen[1]["data"] and "reasoning" not in seen[1]["data"], "bid events stay sealed"

    spawner = JobSpawner()
    with patch("app.services.job_spawner.get_database_service", new=AsyncMock(return_value=db)):
        await spawner._complete_expired_jobs()
        assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.IN_PROGRESS, "not done right after winning"

        closed_long_ago = datetime.now(timezone.utc) - timedelta(seconds=spawner.settings.job_completion_duration_seconds + 1)
        fake.tables["auctions"][0]["closed_at"] = closed_long_ago.isoformat()
        await spawner._complete_expired_jobs()

    assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.COMPLETED
    winner = await agents.get_by_id(early)
    assert winner and winner.credits == 1050, "winner earns bid minus work cost (150 - 100)"
    assert winner.current_jobs == 0
    print("auction lifecycle: all checks passed")

    # The game loop publishes from its own thread; events still reach this loop's subscribers
    import threading
    def publish_from_game_thread():
        asyncio.run(get_event_manager().publish("season_ended", {"season_number": 99}))
    worker = threading.Thread(target=publish_from_game_thread)
    worker.start(); worker.join()
    await asyncio.sleep(0)
    assert events.get_nowait()["data"]["season_number"] == 99, "cross-thread event delivered"
    while not events.empty():
        events.get_nowait()

    # Public agent views hide the strategy from everyone but the owner
    from app.routes.agents import for_viewer
    owner_view = await agents.get_by_id(early)
    assert owner_view and for_viewer(owner_view, owner_view.user_id).auction_instructions == "x"
    assert for_viewer(owner_view, None).auction_instructions is None
    assert for_viewer(owner_view, uuid.uuid4()).auction_instructions is None

    api_surface(db)
    await ai_caps(db)
    await why_did_i_lose(db, fake, auction.id, cheap, early, late)
    await workload_cost(db, fake, spawner)
    await losses_and_bankruptcy(db, fake, spawner)
    await season_rollover(db, fake, spawner)


def api_surface(db):
    """Locked-down endpoints, login on paid AI calls, and the static builder prompt (no network)."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.database import get_database_service
    app.dependency_overrides[get_database_service] = lambda: db
    client = TestClient(app)  # no "with": the game loop does not start
    try:
        agent_id = str(uuid.uuid4())
        gone = [("post", f"/api/agents/{agent_id}/credits"), ("post", "/api/auctions"),
                ("post", f"/api/auctions/{agent_id}/close"), ("post", "/api/events/test/x"), ("post", "/api/jobs"),
                ("post", "/api/agent-decisions/execute"), ("get", f"/api/agents/user/{agent_id}"),
                ("get", f"/api/auctions/{agent_id}/bids")]
        for method, path in gone:
            assert getattr(client, method)(path).status_code in (404, 405), f"{method} {path} should be gone"
        r = client.post("/api/agent-builder/chat", json={"messages": [], "specialty": "coder"})
        assert r.status_code == 401, f"builder without login must be 401, got {r.status_code}"
        r = client.get("/api/agent-builder/initial-prompt/coder")
        assert r.status_code == 200 and r.json()["message"]
    finally:
        app.dependency_overrides.clear()
    print("API surface: all checks passed")


async def ai_caps(db):
    from app.config import get_settings
    from app.services import ai_budget
    os.environ["AI_DAILY_AGENT_CALLS"] = "2"
    os.environ["AI_DAILY_BUILDER_CALLS_PER_USER"] = "1"
    get_settings.cache_clear()
    try:
        assert [await ai_budget.try_agent_call(db, "2026-01-01") for _ in range(3)] == [True, True, False]
        assert await ai_budget.try_agent_call(db, "2026-01-02"), "new day, fresh budget"
        assert await ai_budget.try_builder_call(db, "u1", "2026-01-02")
        assert not await ai_budget.try_builder_call(db, "u1", "2026-01-02")
        assert await ai_budget.try_builder_call(db, "u2", "2026-01-02"), "builder cap is per user"

        class BrokenDB:
            def rpc(self, *_):
                raise ConnectionError("database down")
        assert not await ai_budget.try_agent_call(BrokenDB()), "fails closed when usage can't be counted"
    finally:
        del os.environ["AI_DAILY_AGENT_CALLS"], os.environ["AI_DAILY_BUILDER_CALLS_PER_USER"]
        get_settings.cache_clear()
    print("AI caps: all checks passed")


async def why_did_i_lose(db, fake, auction_id, cheap, early, late):
    """Breakdown of the first auction: Cheap had the lowest bid but filled up, Early won, Late tied later."""
    start = datetime.now(timezone.utc) - timedelta(minutes=5)
    for i, (agent, kind, amount, why) in enumerate([
        (cheap, "bid", 90, "undercut hard"),
        (early, "bid", 150, "fair price"),
        (late, "pass", None, "too complex"),
        (late, "bid", 150, "match the lead"),
    ]):
        fake.tables.setdefault("agent_decisions", []).append({
            "id": str(uuid.uuid4()), "agent_id": str(agent), "auction_id": str(auction_id),
            "decision_type": kind, "bid_amount": amount, "reasoning": why,
            "created_at": (start + timedelta(seconds=i)).isoformat(),
        })

    breakdown = await DecisionService(db).auction_breakdown(auction_id)
    assert breakdown and breakdown["work_cost"] == 100
    assert [d["reasoning"] for d in breakdown["decisions"]] == ["undercut hard", "fair price", "too complex", "match the lead"]
    by_name = {a["agent_name"]: a for a in breakdown["agents"]}
    assert breakdown["agents"][0]["agent_name"] == "Early", "winner listed first"
    assert by_name["Early"]["explanation"] == "Won at 150 with a work cost of 100 (idle): profit 50."
    assert by_name["Early"]["work_cost"] == 100 and by_name["Cheap"]["work_cost"] == 140
    assert "same as the winner but later" in by_name["Late"]["explanation"]
    assert by_name["Late"]["last_reasoning"] == "match the lead"
    assert "lowest bid (90) but was full" in by_name["Cheap"]["explanation"]

    assert explain(AuctionStatus.CLOSED, True, 70, 70, "78 (idle)", "78 (idle)", 78)[1] == "Won at 70 with a work cost of 78 (idle): a loss of 8."
    assert explain(AuctionStatus.CLOSED, False, 92, 84, "86 (1 job running)", "78 (idle)")[1] == \
        "Bid 92 with a work cost of 86 (1 job running). The winner bid 84, 8 lower with a work cost of 78 (idle)."
    assert explain(AuctionStatus.ACTIVE, False, 120, None, None, None)[0] == "sealed"

    # Sealed prompt: own cost at current workload (157 job, 2 jobs running), rival cost range, no lead
    state = AgentState(agent_name="A", specialty="designer", auction_instructions="x", current_jobs=2, credits=1000)
    prompt = AgentIntelligenceService(db)._build_system_prompt(state, AuctionContext(
        job_title="t", job_description="d", job_specialty="designer", market_average_price=157,
        rival_count=1, time_remaining_seconds=60, total_bids=1))
    assert "Your work cost: 94 credits" in prompt and "Minimum profitable bid: 95" in prompt
    assert "between 78 (idle) and 110 (4 jobs running)" in prompt and "SEALED AUCTION" in prompt
    assert "leading" not in prompt.lower()

    history = await DecisionService(db).for_agent(early)
    assert history[0]["outcome"] == "won" and history[0]["job_title"] == "Build API"
    assert (await DecisionService(db).for_agent(late))[0]["outcome"] == "lost"

    # A bid the model chose but that failed is stored with its failure note
    intelligence = AgentIntelligenceService(db)

    async def model_bids_too_high(agent_id, auction_id):
        return AgentDecisionResponse(agent_id=agent_id, agent_name="Late", auction_id=auction_id,
                                     decision_type=DecisionType.BID, bid_amount=999, reasoning="go big",
                                     created_at=datetime.now(timezone.utc), from_model=True)
    intelligence.get_agent_decision = model_bids_too_high
    jobs, auctions = JobService(db), AuctionService(db)
    job = await jobs.create(JobCreate(title="J", description="d", specialty=AgentSpecialty.CODER, base_price=200))
    open_auction = await auctions.create_auction(AuctionCreate(job_id=job.id))
    await intelligence.execute_decision(late, open_auction.id)

    # Public stats must not reveal a sealed bid through the average
    from app.routes.agent_stats import get_agent_stats
    before = await get_agent_stats(early, db)
    await auctions.place_bid(BidCreate(auction_id=open_auction.id, agent_id=early, amount=120))
    after = await get_agent_stats(early, db)
    assert after.avg_bid_amount == before.avg_bid_amount == 150, "live bid kept out of the average"
    assert after.total_bids == before.total_bids + 1 and after.active_bids == 1
    stored = [d for d in fake.tables["agent_decisions"] if d["auction_id"] == str(open_auction.id)]
    assert len(stored) == 1 and "[Bid failed: Bid exceeds the job budget" in stored[0]["reasoning"]
    assert "from_model" not in stored[0], "internal flag is not written to the database"
    again = await AgentIntelligenceService(db).get_agent_decision(late, open_auction.id)
    assert again.decision_type == DecisionType.PASS and "one sealed decision" in again.reasoning
    assert (await DecisionService(db).for_agent(late))[0]["bid_amount"] is None, "open auctions stay sealed"
    await auctions.close_auction(open_auction.id)
    print("why did I lose: all checks passed")


async def win_job(db, fake, agent_id, bid, base_price=200):
    """Run one auction that `agent_id` wins with `bid`; returns the job id."""
    jobs, auctions = JobService(db), AuctionService(db)
    job = await jobs.create(JobCreate(title="Job", description="d", specialty=AgentSpecialty.CODER, base_price=base_price))
    auction = await auctions.create_auction(AuctionCreate(job_id=job.id))
    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=agent_id, amount=bid))
    await auctions.close_auction(auction.id)
    return job.id


async def workload_cost(db, fake, spawner):
    agents = AgentService(db)
    busy = (await agents.get_all())[-1].id
    for row in fake.tables["agents"]:
        if row["id"] == str(busy):
            row["current_jobs"], row["credits"] = 2, 1000
    job_id = await win_job(db, fake, busy, bid=150)  # 200 job, 2 jobs running: cost 120
    assert getattr(await JobService(db).get_by_id(job_id), "work_cost", None) == 120
    with patch("app.services.job_spawner.get_database_service", new=AsyncMock(return_value=db)):
        await spawner._complete_expired_jobs(settle_all=True)
    after = await agents.get_by_id(busy)
    assert after and after.credits == 1030, "paid 150 minus the 120 cost locked in when it bid"
    for row in fake.tables["agents"]:
        row["current_jobs"] = 0
    print("workload cost: all checks passed")


async def losses_and_bankruptcy(db, fake, spawner):
    agents = AgentService(db)
    gambler = (await agents.get_all())[0].id
    await agents.update_credits(gambler, 30 - (await agents.get_by_id(gambler)).credits)

    await win_job(db, fake, gambler, bid=60)  # work cost 100: a 40-credit loss
    with patch("app.services.job_spawner.get_database_service", new=AsyncMock(return_value=db)):
        await spawner._complete_expired_jobs(settle_all=True)
    broke = await agents.get_by_id(gambler)
    assert broke and broke.credits == -10 and broke.is_bankrupt, "bidding below work cost loses credits"

    auctions = AuctionService(db)
    job = await JobService(db).create(JobCreate(title="J", description="d", specialty=AgentSpecialty.CODER, base_price=200))
    auction = await auctions.create_auction(AuctionCreate(job_id=job.id))
    try:
        await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=gambler, amount=150))
        raise AssertionError("bankrupt agent must not bid")
    except ValueError:
        pass
    await auctions.close_auction(auction.id)
    print("losses and bankruptcy: all checks passed")


async def season_rollover(db, fake, spawner):
    agents, seasons = AgentService(db), SeasonService(db)
    roster = await agents.get_all()
    with patch("app.services.job_spawner.get_database_service", new=AsyncMock(return_value=db)):
        await spawner._check_season()  # no season yet: starts season 1 and resets credits
        season1 = await seasons.get_current()
        assert season1 and season1["number"] == 1
        assert all(a.credits == 1000 for a in await agents.get_all()), "season start resets credits"

        star = roster[1].id
        job_id = await win_job(db, fake, star, bid=180)  # profit 80, still running at season end
        await spawner._check_season()
        assert (await seasons.get_current())["number"] == 1, "season still running"

        fake.tables["seasons"][0]["ends_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        await spawner._check_season()

    assert getattr(await JobService(db).get_by_id(job_id), "status", None) == JobStatus.COMPLETED, "running work is paid out"
    results = await seasons.get_results(season1["id"])
    assert results[0]["agent_id"] == str(star) and results[0]["final_credits"] == 1080 and results[0]["profit"] == 80
    assert results[0]["rank"] == 1 and results[0]["jobs_won"] == 1 and len(results) == len(roster)
    assert results[0]["win_rate"] == 100.0, "1 win out of 1 auction entered this season"
    assert fake.tables["seasons"][0]["status"] == "finished"
    season2 = await seasons.get_current()
    assert season2 and season2["number"] == 2
    assert all(a.credits == 1000 for a in await agents.get_all()), "new season resets credits"
    print("season rollover: all checks passed")


if __name__ == "__main__":
    asyncio.run(main())

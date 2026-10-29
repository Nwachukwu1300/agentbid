"""Auction lifecycle check against an in-memory fake of the Supabase client.

Run from backend/:  ./venv/bin/python -m tests.test_auction_lifecycle
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import cast
from unittest.mock import patch

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


class FakeQuery:
    """Supports the subset of the supabase-py query builder these services use."""

    def __init__(self, rows: list[dict], action: str, payload: dict):
        self.rows, self.action, self.payload = rows, action, payload
        self.filters, self.orders, self.bounds = [], [], None

    def eq(self, col, val):
        self.filters.append(lambda r: str(r.get(col)) == str(val))
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

    def execute(self):
        if self.action == "insert":
            row = {"id": str(uuid.uuid4()), **self.payload}
            self.rows.append(row)
            return SimpleNamespace(data=[row], count=1)
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

    def insert(self, data: dict):
        return FakeQuery(self.rows, "insert", data)

    def update(self, data: dict):
        return FakeQuery(self.rows, "update", data)


class FakeDB:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}

    def table(self, name):
        return FakeTable(self.tables.setdefault(name, []))


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

    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=cheap, amount=90), "lowest")
    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=early, amount=100))
    await auctions.place_bid(BidCreate(auction_id=auction.id, agent_id=late, amount=100))

    # Cheap fills up before the auction closes, so it can't take the job
    await agents.increment_jobs(cheap)

    result = await auctions.close_auction(auction.id)
    assert result.winner_agent_id == early, "lowest bid from an agent with room wins; ties go to the earliest"
    assert result.winning_bid == 100 and result.total_bids == 3

    winner = await agents.get_by_id(early)
    assert winner and winner.credits == 1000, "winner is not charged at close"
    assert winner.current_jobs == 1
    assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.IN_PROGRESS, "won job starts immediately"

    seen = [events.get_nowait() for _ in range(events.qsize())]
    assert [e["type"] for e in seen] == ["auction_created", "bid_placed", "bid_placed", "bid_placed", "auction_closed"]
    assert seen[1]["data"]["reasoning"] == "lowest"

    spawner = JobSpawner()
    with patch("app.services.job_spawner.get_database_service", return_value=db):
        await spawner._complete_expired_jobs()
        assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.IN_PROGRESS, "not done right after winning"

        closed_long_ago = datetime.now(timezone.utc) - timedelta(seconds=spawner.settings.job_completion_duration_seconds + 1)
        fake.tables["auctions"][0]["closed_at"] = closed_long_ago.isoformat()
        await spawner._complete_expired_jobs()

    assert getattr(await jobs.get_by_id(job.id), "status", None) == JobStatus.COMPLETED
    winner = await agents.get_by_id(early)
    assert winner and winner.credits == 1100, "winner earns its bid on completion"
    assert winner.current_jobs == 0
    print("auction lifecycle: all checks passed")


if __name__ == "__main__":
    asyncio.run(main())

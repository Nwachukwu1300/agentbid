from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum

from .agent import AgentSpecialty


class AuctionStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuctionBase(BaseModel):
    job_id: UUID
    duration_seconds: int = Field(..., ge=90, le=120)


class AuctionCreate(BaseModel):
    job_id: UUID
    duration_seconds: int | None = None  # If None, random between 90-120


class Auction(AuctionBase):
    id: UUID
    status: AuctionStatus = AuctionStatus.ACTIVE
    winning_bid_id: UUID | None = None
    winning_agent_id: UUID | None = None
    winning_amount: int | None = None
    started_at: datetime
    ends_at: datetime
    closed_at: datetime | None = None

    class Config:
        from_attributes = True

    @property
    def is_active(self) -> bool:
        return self.status == AuctionStatus.ACTIVE

    @property
    def time_remaining_seconds(self) -> float:
        if self.status != AuctionStatus.ACTIVE:
            return 0
        remaining = (self.ends_at - datetime.now(self.ends_at.tzinfo)).total_seconds()
        return max(0, remaining)


class AuctionWithJob(Auction):
    job_title: str
    job_description: str
    job_specialty: AgentSpecialty
    job_base_price: int
    bid_count: int = 0
    lowest_bid: int | None = None


class BidBase(BaseModel):
    auction_id: UUID
    agent_id: UUID
    amount: int = Field(..., gt=0)


class BidCreate(BidBase):
    pass


class Bid(BidBase):
    id: UUID
    created_at: datetime
    is_winning: bool = False

    class Config:
        from_attributes = True


class BidWithAgent(Bid):
    agent_name: str
    agent_specialty: AgentSpecialty


class AuctionResult(BaseModel):
    auction_id: UUID
    job_id: UUID
    winner_agent_id: UUID | None
    winner_agent_name: str | None
    winning_bid: int | None
    total_bids: int
    status: AuctionStatus

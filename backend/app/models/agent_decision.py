from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from enum import Enum


class DecisionType(str, Enum):
    BID = "bid"
    PASS = "pass"


class AgentDecision(BaseModel):
    """Base model for agent auction decisions."""
    decision_type: DecisionType
    reasoning: str = Field(..., min_length=1)


class BidDecision(AgentDecision):
    """Agent decides to place a bid."""
    decision_type: DecisionType = DecisionType.BID
    bid_amount: int = Field(..., gt=0)


class PassDecision(AgentDecision):
    """Agent decides to pass on the auction."""
    decision_type: DecisionType = DecisionType.PASS


class AgentDecisionRequest(BaseModel):
    """Request to get an agent's decision for an auction."""
    agent_id: UUID
    auction_id: UUID


class AgentDecisionResponse(BaseModel):
    """Full response from agent decision-making process."""
    agent_id: UUID
    agent_name: str
    auction_id: UUID
    decision_type: DecisionType
    bid_amount: int | None = None
    reasoning: str
    raw_response: str | None = None  # For debugging
    created_at: datetime

    class Config:
        from_attributes = True


class AuctionContext(BaseModel):
    """Context provided to agent for decision-making."""
    job_title: str
    job_description: str
    job_specialty: str
    market_average_price: int  # Base price for the job type
    current_leading_bid: int | None  # None if no bids yet
    time_remaining_seconds: float
    total_bids: int


class AgentState(BaseModel):
    """Current state of the agent."""
    agent_name: str
    specialty: str
    auction_instructions: str
    current_jobs: int
    max_capacity: int = 5
    credits: int

    @property
    def is_at_capacity(self) -> bool:
        return self.current_jobs >= self.max_capacity

    @property
    def workload_display(self) -> str:
        return f"{self.current_jobs}/{self.max_capacity}"

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum

from .agent import AgentSpecialty


class TradeOfferStatus(str, Enum):
    OPEN = "open"  # Available for matching
    MATCHED = "matched"  # Found a partner, trade created
    CANCELLED = "cancelled"  # Withdrawn by agent
    EXPIRED = "expired"  # Timed out without match


class TradeStatus(str, Enum):
    PENDING = "pending"  # Trade created, waiting to start
    IN_PROGRESS = "in_progress"  # Both agents working on jobs
    COMPLETED = "completed"  # Both jobs finished
    FAILED = "failed"  # Something went wrong


class TradeOfferBase(BaseModel):
    """Base model for a trade offer posted by an agent."""
    agent_id: UUID
    offer_specialty: AgentSpecialty  # What the agent is offering to do
    want_specialty: AgentSpecialty  # What the agent wants in return


class TradeOfferCreate(TradeOfferBase):
    """Create a new trade offer."""
    pass


class TradeOffer(TradeOfferBase):
    """A trade offer in the system."""
    id: UUID
    status: TradeOfferStatus = TradeOfferStatus.OPEN
    matched_with_offer_id: UUID | None = None  # The offer this was matched with
    trade_id: UUID | None = None  # The resulting trade
    created_at: datetime
    expires_at: datetime | None = None  # Optional expiration

    class Config:
        from_attributes = True


class TradeOfferWithAgent(TradeOffer):
    """Trade offer with agent details for display."""
    agent_name: str
    agent_credits: int
    agent_current_jobs: int


class TradeBase(BaseModel):
    """A matched trade between two agents."""
    offer_a_id: UUID  # First trade offer
    offer_b_id: UUID  # Second trade offer (the match)
    agent_a_id: UUID  # Agent A (from offer_a)
    agent_b_id: UUID  # Agent B (from offer_b)


class TradeCreate(TradeBase):
    """Create a new trade from matched offers."""
    pass


class Trade(TradeBase):
    """An active or completed trade."""
    id: UUID
    status: TradeStatus = TradeStatus.PENDING
    # What Agent A does for Agent B (Agent A's offer_specialty)
    job_a_specialty: AgentSpecialty
    # What Agent B does for Agent A (Agent B's offer_specialty)
    job_b_specialty: AgentSpecialty
    # Tracking completion
    job_a_completed: bool = False
    job_b_completed: bool = False
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class TradeWithDetails(Trade):
    """Trade with full agent and offer details."""
    agent_a_name: str
    agent_b_name: str
    # Descriptions generated for the jobs
    job_a_description: str | None = None
    job_b_description: str | None = None


class BarterDecisionType(str, Enum):
    ACCEPT = "accept"
    POST_OFFER = "post_offer"
    DECLINE = "decline"


class BarterDecision(BaseModel):
    """Agent's decision about a barter opportunity."""
    decision_type: BarterDecisionType
    reasoning: str = Field(..., min_length=1)
    # If posting an offer, what they want
    offer_specialty: AgentSpecialty | None = None
    want_specialty: AgentSpecialty | None = None


class BarterDecisionRequest(BaseModel):
    """Request for agent to evaluate a trade offer."""
    agent_id: UUID
    trade_offer_id: UUID  # The offer to evaluate


class BarterDecisionResponse(BaseModel):
    """Response from agent's barter decision."""
    agent_id: UUID
    agent_name: str
    trade_offer_id: UUID | None = None
    decision_type: BarterDecisionType
    reasoning: str
    # If they decided to post their own offer
    new_offer_id: UUID | None = None
    # If they accepted and a trade was created
    trade_id: UUID | None = None
    raw_response: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BarterContext(BaseModel):
    """Context for barter decision-making."""
    offered_service: str  # What's being offered to the agent
    wanted_service: str  # What the offerer wants in return
    offerer_name: str
    offerer_specialty: str


class BarterAgentState(BaseModel):
    """Agent state for barter decisions."""
    agent_name: str
    specialty: str
    barter_instructions: str
    current_jobs: int
    max_capacity: int = 5
    credits: int

    @property
    def is_at_capacity(self) -> bool:
        return self.current_jobs >= self.max_capacity

    @property
    def workload_display(self) -> str:
        return f"{self.current_jobs}/{self.max_capacity}"

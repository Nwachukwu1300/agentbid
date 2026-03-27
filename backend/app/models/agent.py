from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


class AgentSpecialty(str, Enum):
    DESIGNER = "designer"
    CODER = "coder"
    WRITER = "writer"
    DATA_ANALYST = "data_analyst"
    TESTER = "tester"


# Base price ranges by specialty
SPECIALTY_PRICE_RANGES = {
    AgentSpecialty.DESIGNER: (100, 200),
    AgentSpecialty.CODER: (150, 300),
    AgentSpecialty.WRITER: (80, 180),
    AgentSpecialty.DATA_ANALYST: (120, 250),
    AgentSpecialty.TESTER: (90, 200),
}


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    specialty: AgentSpecialty
    auction_instructions: str = Field(..., min_length=1)
    barter_instructions: str = Field(..., min_length=1)


class AgentCreate(AgentBase):
    user_id: UUID


class AgentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    auction_instructions: str | None = Field(None, min_length=1)
    barter_instructions: str | None = Field(None, min_length=1)
    is_active: bool | None = None


class Agent(AgentBase):
    id: UUID
    user_id: UUID
    credits: int = Field(default=1000)
    current_jobs: int = Field(default=0, ge=0, le=5)
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @property
    def is_at_capacity(self) -> bool:
        return self.current_jobs >= 5

    @property
    def available_capacity(self) -> int:
        return 5 - self.current_jobs


class AgentInDB(Agent):
    pass


class AgentStats(BaseModel):
    total_earnings: int = 0
    jobs_won: int = 0
    win_rate: float = 0.0
    active_bids: int = 0

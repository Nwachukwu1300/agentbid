"""
API routes for LLM-assisted agent creation.

This powers the "wow" feature - the chat-based agent creation flow.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

from app.models.agent import AgentSpecialty, AgentCreate, Agent
from app.services.agent_builder import (
    AgentBuilderService,
    get_agent_builder,
    ConversationMessage,
    GeneratedInstructions,
)
from app.services.database import DatabaseService, get_database_service
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/agent-builder", tags=["agent-builder"])


class ChatRequest(BaseModel):
    """Request for chat endpoint."""
    messages: list[ConversationMessage]
    specialty: Optional[AgentSpecialty] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    message: str
    ready_to_generate: bool = False


class GenerateRequest(BaseModel):
    """Request to generate instructions from conversation."""
    messages: list[ConversationMessage]
    specialty: AgentSpecialty


class QuickGenerateRequest(BaseModel):
    """Request for quick generation without conversation."""
    description: str = Field(..., min_length=10, max_length=1000)
    specialty: AgentSpecialty


class RefineRequest(BaseModel):
    """Request to refine generated instructions."""
    current: GeneratedInstructions
    feedback: str = Field(..., min_length=5, max_length=500)
    specialty: AgentSpecialty


class CreateAgentRequest(BaseModel):
    """Request to create an agent with generated instructions."""
    user_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    specialty: AgentSpecialty
    auction_instructions: str = Field(..., min_length=1)
    barter_instructions: str = Field(..., min_length=1)


def get_builder() -> AgentBuilderService:
    return get_agent_builder()


def get_agent_service(db: DatabaseService = Depends(get_database_service)) -> AgentService:
    return AgentService(db)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_builder(
    request: ChatRequest,
    builder: AgentBuilderService = Depends(get_builder),
) -> ChatResponse:
    """
    Continue the agent creation conversation.

    Send the conversation history and get the assistant's next response.
    The response includes a flag indicating if enough information has been
    gathered to generate instructions.
    """
    try:
        response = await builder.chat(request.messages, request.specialty)

        # Check if the assistant indicates readiness to generate
        ready_indicators = [
            "let me create",
            "i'll generate",
            "ready to create",
            "create your agent",
            "generate your",
            "let me generate",
            "i think i understand",
            "i've got a good sense",
        ]
        ready = any(indicator in response.lower() for indicator in ready_indicators)

        return ChatResponse(message=response, ready_to_generate=ready)

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=GeneratedInstructions)
async def generate_instructions(
    request: GenerateRequest,
    builder: AgentBuilderService = Depends(get_builder),
) -> GeneratedInstructions:
    """
    Generate comprehensive agent instructions from the conversation.

    Call this after the chat indicates ready_to_generate=true.
    Returns detailed auction and barter instructions plus a suggested name.
    """
    try:
        return await builder.generate_instructions(
            request.messages,
            request.specialty,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-generate", response_model=GeneratedInstructions)
async def quick_generate(
    request: QuickGenerateRequest,
    builder: AgentBuilderService = Depends(get_builder),
) -> GeneratedInstructions:
    """
    Quick generation without conversation.

    For users who want to skip the chat and directly describe their agent.
    Still generates rich, detailed instructions.
    """
    try:
        return await builder.quick_generate(
            request.description,
            request.specialty,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refine", response_model=GeneratedInstructions)
async def refine_instructions(
    request: RefineRequest,
    builder: AgentBuilderService = Depends(get_builder),
) -> GeneratedInstructions:
    """
    Refine generated instructions based on user feedback.

    Call this when the user wants to adjust the generated instructions.
    """
    try:
        return await builder.refine_instructions(
            request.current,
            request.feedback,
            request.specialty,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-agent", response_model=Agent, status_code=201)
async def create_agent_from_builder(
    request: CreateAgentRequest,
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    """
    Create an agent with the finalized instructions.

    This is the final step of the agent creation flow.
    The agent will be immediately active and ready to compete.
    """
    agent_data = AgentCreate(
        user_id=request.user_id,
        name=request.name,
        specialty=request.specialty,
        auction_instructions=request.auction_instructions,
        barter_instructions=request.barter_instructions,
    )

    return await service.create(agent_data)


# Initial prompt to start the conversation
INITIAL_PROMPTS = {
    AgentSpecialty.DESIGNER: "Tell me about the design agent you want to create! What kind of design jobs are you most interested in - logos, web design, UI/UX, branding? And what's your ideal bidding style - do you want to compete aggressively on price, or position yourself as a premium option?",
    AgentSpecialty.CODER: "Let's create your coding agent! What types of development work do you want to focus on - APIs, web apps, bug fixes, scripts? And how do you want your agent to compete - aggressive pricing to win lots of jobs, or selective bidding on high-value work?",
    AgentSpecialty.WRITER: "I'm excited to help create your writing agent! What kind of content interests you most - blog posts, marketing copy, technical docs, creative writing? And what's your competitive strategy - high volume at lower prices, or premium positioning?",
    AgentSpecialty.DATA_ANALYST: "Let's build your data analysis agent! What areas fascinate you - visualization, ML/AI, business intelligence, statistics? How should your agent approach the market - take on many projects or be selective about complex, high-value work?",
    AgentSpecialty.TESTER: "Great choice! Let's create your testing agent! What testing focus appeals to you - automation, manual QA, security testing, performance? And what's your bidding philosophy - win many jobs with competitive pricing, or focus on premium testing services?",
}


@router.get("/initial-prompt/{specialty}")
async def get_initial_prompt(specialty: AgentSpecialty) -> dict[str, str]:
    """Get the initial conversation prompt for a specialty."""
    return {"message": INITIAL_PROMPTS[specialty]}

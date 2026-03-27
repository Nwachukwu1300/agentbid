from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID

from app.models.agent_decision import (
    AgentDecisionRequest,
    AgentDecisionResponse,
)
from app.services.database import DatabaseService, get_database_service
from app.services.agent_intelligence import AgentIntelligenceService

router = APIRouter(prefix="/api/agent-decisions", tags=["agent-decisions"])


def get_intelligence_service(
    db: DatabaseService = Depends(get_database_service),
) -> AgentIntelligenceService:
    return AgentIntelligenceService(db)


@router.post("/decide", response_model=AgentDecisionResponse)
async def get_agent_decision(
    request: AgentDecisionRequest,
    service: AgentIntelligenceService = Depends(get_intelligence_service),
) -> AgentDecisionResponse:
    """
    Get an AI-powered decision from an agent for a specific auction.

    The agent will analyze the auction context and return either:
    - A bid decision with amount and reasoning
    - A PASS decision with reasoning

    Note: This only returns the decision, it does NOT place the bid.
    Use /execute to get decision AND place bid automatically.
    """
    try:
        return await service.get_agent_decision(
            agent_id=request.agent_id,
            auction_id=request.auction_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/execute", response_model=AgentDecisionResponse)
async def execute_agent_decision(
    request: AgentDecisionRequest,
    service: AgentIntelligenceService = Depends(get_intelligence_service),
) -> AgentDecisionResponse:
    """
    Get an AI-powered decision from an agent AND execute it.

    If the agent decides to bid, the bid is automatically placed.
    If the agent decides to PASS, no action is taken.

    Returns the decision with reasoning.
    """
    try:
        return await service.execute_decision(
            agent_id=request.agent_id,
            auction_id=request.auction_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auction/{auction_id}/trigger-all", response_model=list[AgentDecisionResponse])
async def trigger_all_agents(
    auction_id: UUID,
    specialty_match_only: bool = Query(True, description="Only trigger agents matching job specialty"),
    service: AgentIntelligenceService = Depends(get_intelligence_service),
) -> list[AgentDecisionResponse]:
    """
    Trigger ALL eligible agents to make decisions for an auction.

    This simulates a round of bidding where all agents evaluate the auction
    and decide whether to bid or pass.

    Args:
        auction_id: The auction to evaluate
        specialty_match_only: If True, only agents matching the job specialty participate

    Returns:
        List of all agent decisions (bids and passes)
    """
    try:
        return await service.trigger_all_agents_for_auction(
            auction_id=auction_id,
            specialty_match_only=specialty_match_only,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

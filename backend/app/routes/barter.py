from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID

from app.models.barter import (
    TradeOffer,
    TradeOfferCreate,
    TradeOfferWithAgent,
    Trade,
    TradeStatus,
    TradeWithDetails,
    BarterDecisionRequest,
    BarterDecisionResponse,
)
from app.models.agent import AgentSpecialty
from app.services.database import DatabaseService, get_database_service
from app.services.barter_service import BarterService
from app.services.barter_intelligence import BarterIntelligenceService

router = APIRouter(prefix="/api/barter", tags=["barter"])


def get_barter_service(
    db: DatabaseService = Depends(get_database_service),
) -> BarterService:
    return BarterService(db)


def get_barter_intelligence_service(
    db: DatabaseService = Depends(get_database_service),
) -> BarterIntelligenceService:
    return BarterIntelligenceService(db)


# ==================== Trade Offer Endpoints ====================

@router.post("/offers", response_model=TradeOffer, status_code=201)
async def create_trade_offer(
    offer_data: TradeOfferCreate,
    service: BarterService = Depends(get_barter_service),
) -> TradeOffer:
    """
    Create a new trade offer.

    The system will automatically try to match it with existing offers.
    If a match is found, a trade is created immediately.
    """
    try:
        return await service.create_offer(offer_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/offers", response_model=list[TradeOfferWithAgent])
async def list_open_offers(
    offer_specialty: AgentSpecialty | None = Query(None, description="Filter by what's being offered"),
    want_specialty: AgentSpecialty | None = Query(None, description="Filter by what's wanted"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: BarterService = Depends(get_barter_service),
) -> list[TradeOfferWithAgent]:
    """Get all open trade offers on the barter board."""
    return await service.get_open_offers(
        offer_specialty=offer_specialty,
        want_specialty=want_specialty,
        limit=limit,
        offset=offset,
    )


@router.get("/offers/{offer_id}", response_model=TradeOfferWithAgent)
async def get_trade_offer(
    offer_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> TradeOfferWithAgent:
    """Get a specific trade offer with agent details."""
    offer = await service.get_offer_with_agent(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Trade offer not found")
    return offer


@router.delete("/offers/{offer_id}", response_model=TradeOffer)
async def cancel_trade_offer(
    offer_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> TradeOffer:
    """Cancel an open trade offer."""
    try:
        offer = await service.cancel_offer(offer_id)
        if not offer:
            raise HTTPException(status_code=404, detail="Trade offer not found")
        return offer
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/offers/agent/{agent_id}", response_model=list[TradeOffer])
async def get_agent_offers(
    agent_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> list[TradeOffer]:
    """Get all open offers for a specific agent."""
    return await service.get_agent_open_offers(agent_id)


# ==================== Trade Endpoints ====================

@router.get("/trades", response_model=list[Trade])
async def list_trades(
    status: TradeStatus | None = Query(None),
    service: BarterService = Depends(get_barter_service),
) -> list[Trade]:
    """Get trades filtered by status."""
    if status == TradeStatus.PENDING:
        return await service.get_pending_trades()
    elif status == TradeStatus.IN_PROGRESS:
        return await service.get_in_progress_trades()
    else:
        # Get all (limited implementation - would need full query)
        pending = await service.get_pending_trades()
        in_progress = await service.get_in_progress_trades()
        return pending + in_progress


@router.get("/trades/{trade_id}", response_model=TradeWithDetails)
async def get_trade(
    trade_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> TradeWithDetails:
    """Get a specific trade with full details."""
    trade = await service.get_trade_with_details(trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade


@router.get("/trades/agent/{agent_id}", response_model=list[Trade])
async def get_agent_trades(
    agent_id: UUID,
    status: TradeStatus | None = Query(None),
    service: BarterService = Depends(get_barter_service),
) -> list[Trade]:
    """Get all trades involving a specific agent."""
    return await service.get_agent_trades(agent_id, status)


@router.post("/trades/{trade_id}/start", response_model=Trade)
async def start_trade(
    trade_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> Trade:
    """
    Start a pending trade.

    Both agents begin working on their respective jobs.
    This increments the job count for both agents.
    """
    try:
        trade = await service.start_trade(trade_id)
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        return trade
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trades/{trade_id}/complete", response_model=Trade)
async def complete_trade(
    trade_id: UUID,
    service: BarterService = Depends(get_barter_service),
) -> Trade:
    """
    Complete a trade.

    Both jobs are marked as completed.
    This decrements the job count for both agents.
    """
    try:
        trade = await service.complete_trade(trade_id)
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        return trade
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Auto-Matching Endpoints ====================

@router.post("/match-all", response_model=list[Trade])
async def trigger_matching(
    service: BarterService = Depends(get_barter_service),
) -> list[Trade]:
    """
    Trigger the auto-matching algorithm for all open offers.

    Scans all open offers and creates trades for any compatible pairs.
    Returns a list of newly created trades.
    """
    return await service.find_matches_for_all_open_offers()


# ==================== AI Decision Endpoints ====================

@router.post("/decisions/evaluate", response_model=BarterDecisionResponse)
async def evaluate_trade_offer_ai(
    request: BarterDecisionRequest,
    service: BarterIntelligenceService = Depends(get_barter_intelligence_service),
) -> BarterDecisionResponse:
    """
    Have an agent evaluate a trade offer using AI.

    Uses the agent's barter_instructions personality.
    Returns ACCEPT, DECLINE, or POST_OFFER decision.
    """
    try:
        return await service.evaluate_trade_offer(
            agent_id=request.agent_id,
            trade_offer_id=request.trade_offer_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/decisions/proactive/{agent_id}", response_model=BarterDecisionResponse)
async def get_proactive_offer_decision(
    agent_id: UUID,
    service: BarterIntelligenceService = Depends(get_barter_intelligence_service),
) -> BarterDecisionResponse:
    """
    Have an agent decide whether to post a trade offer.

    Uses the agent's barter_instructions personality.
    Agent will decide if/what to offer based on their strategy.
    """
    try:
        return await service.get_proactive_offer_decision(agent_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/decisions/execute", response_model=BarterDecisionResponse)
async def execute_barter_decision(
    agent_id: UUID = Query(...),
    trade_offer_id: UUID | None = Query(None),
    service: BarterIntelligenceService = Depends(get_barter_intelligence_service),
) -> BarterDecisionResponse:
    """
    Get agent's barter decision AND execute it.

    If trade_offer_id is provided:
    - Agent evaluates that offer
    - If ACCEPT, creates counter-offer to trigger match

    If trade_offer_id is NOT provided:
    - Agent decides whether to post their own offer
    - If POST_OFFER, creates the offer
    """
    try:
        return await service.execute_barter_decision(
            agent_id=agent_id,
            trade_offer_id=trade_offer_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/decisions/trigger-round", response_model=list[BarterDecisionResponse])
async def trigger_barter_round(
    agent_ids: list[UUID] | None = None,
    service: BarterIntelligenceService = Depends(get_barter_intelligence_service),
) -> list[BarterDecisionResponse]:
    """
    Trigger a barter round for multiple agents.

    Each agent will decide whether to post a trade offer.
    If agent_ids is not provided, triggers all active agents.
    """
    try:
        return await service.trigger_agents_for_barter_round(agent_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

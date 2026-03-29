from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID

from app.models.auction import (
    Auction,
    AuctionCreate,
    AuctionWithJob,
    AuctionResult,
    Bid,
    BidCreate,
    BidWithAgent,
)
from app.models.agent import AgentSpecialty
from app.services.database import DatabaseService, get_database_service
from app.services.auction_service import AuctionService

router = APIRouter(prefix="/api/auctions", tags=["auctions"])


def get_auction_service(
    db: DatabaseService = Depends(get_database_service),
) -> AuctionService:
    return AuctionService(db)


@router.post("", response_model=Auction, status_code=201)
async def create_auction(
    auction_data: AuctionCreate,
    service: AuctionService = Depends(get_auction_service),
) -> Auction:
    """Create a new auction for a job."""
    try:
        return await service.create_auction(auction_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[AuctionWithJob])
async def list_active_auctions(
    specialty: AgentSpecialty | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: AuctionService = Depends(get_auction_service),
) -> list[AuctionWithJob]:
    """Get all active auctions with job details."""
    return await service.get_active_auctions(
        specialty=specialty,
        limit=limit,
        offset=offset,
    )


@router.get("/{auction_id}", response_model=AuctionWithJob)
async def get_auction(
    auction_id: UUID,
    service: AuctionService = Depends(get_auction_service),
) -> AuctionWithJob:
    """Get auction details including job info and bid stats."""
    auction = await service.get_auction_with_job(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return auction


@router.get("/{auction_id}/bids", response_model=list[Bid])
async def get_auction_bids(
    auction_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    service: AuctionService = Depends(get_auction_service),
) -> list[Bid]:
    """Get all bids for an auction, ordered by amount (lowest first)."""
    auction = await service.get_by_id(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return await service.get_auction_bids(auction_id, limit=limit)


@router.get("/{auction_id}/bids/history", response_model=list[BidWithAgent])
async def get_auction_bid_history(
    auction_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    service: AuctionService = Depends(get_auction_service),
) -> list[BidWithAgent]:
    """Get bid history for an auction with agent details, ordered by time (most recent first)."""
    auction = await service.get_by_id(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return await service.get_auction_bids_with_agents(auction_id, limit=limit)


@router.post("/{auction_id}/bids", response_model=Bid, status_code=201)
async def place_bid(
    auction_id: UUID,
    agent_id: UUID = Query(...),
    amount: int = Query(..., gt=0),
    service: AuctionService = Depends(get_auction_service),
) -> Bid:
    """Place a bid on an auction."""
    bid_data = BidCreate(
        auction_id=auction_id,
        agent_id=agent_id,
        amount=amount,
    )
    try:
        return await service.place_bid(bid_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{auction_id}/close", response_model=AuctionResult)
async def close_auction(
    auction_id: UUID,
    service: AuctionService = Depends(get_auction_service),
) -> AuctionResult:
    """
    Close an auction manually.
    Determines winner (lowest bid, tie=first), transfers credits, assigns job.
    """
    try:
        return await service.close_auction(auction_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/agent/{agent_id}/bids", response_model=list[Bid])
async def get_agent_bids(
    agent_id: UUID,
    auction_id: UUID | None = Query(None),
    service: AuctionService = Depends(get_auction_service),
) -> list[Bid]:
    """Get all bids placed by an agent."""
    return await service.get_agent_bids(agent_id, auction_id)

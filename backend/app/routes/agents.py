from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID

from app.models.agent import Agent, AgentCreate, AgentUpdate, AgentSpecialty
from app.services.database import DatabaseService, get_database_service
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/agents", tags=["agents"])


def get_agent_service(db: DatabaseService = Depends(get_database_service)) -> AgentService:
    return AgentService(db)


@router.post("", response_model=Agent, status_code=201)
async def create_agent(
    agent_data: AgentCreate,
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    return await service.create(agent_data)


@router.get("", response_model=list[Agent])
async def list_agents(
    specialty: AgentSpecialty | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: AgentService = Depends(get_agent_service),
) -> list[Agent]:
    return await service.get_all(
        specialty=specialty,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(
    agent_id: UUID,
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    agent = await service.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("/user/{user_id}", response_model=list[Agent])
async def get_user_agents(
    user_id: UUID,
    service: AgentService = Depends(get_agent_service),
) -> list[Agent]:
    return await service.get_by_user_id(user_id)


@router.put("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    agent = await service.update(agent_id, agent_data)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: UUID,
    service: AgentService = Depends(get_agent_service),
) -> None:
    deleted = await service.delete(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/credits", response_model=Agent)
async def update_agent_credits(
    agent_id: UUID,
    amount: int = Query(..., description="Amount to add (positive) or subtract (negative)"),
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    agent = await service.update_credits(agent_id, amount)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

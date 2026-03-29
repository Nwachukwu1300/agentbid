from fastapi import APIRouter, HTTPException, Depends, Query
from uuid import UUID

from app.models.agent import Agent, AgentCreate, AgentUpdate, AgentSpecialty
from app.services.database import DatabaseService, get_database_service
from app.services.agent_service import AgentService
from app.auth import get_current_user_id, get_optional_user_id

router = APIRouter(prefix="/api/agents", tags=["agents"])


def get_agent_service(db: DatabaseService = Depends(get_database_service)) -> AgentService:
    return AgentService(db)


# =============================================================================
# PUBLIC ENDPOINTS (No authentication required)
# =============================================================================

@router.get("", response_model=list[Agent])
async def list_agents(
    specialty: AgentSpecialty | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: AgentService = Depends(get_agent_service),
) -> list[Agent]:
    """
    List all agents in the marketplace (public endpoint).
    Used for the main auction/barter views where all agents are visible.
    """
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
    """Get a single agent by ID (public endpoint)."""
    agent = await service.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# =============================================================================
# AUTHENTICATED ENDPOINTS (Require valid JWT token)
# =============================================================================

@router.get("/my/agents", response_model=list[Agent])
async def get_my_agents(
    include_inactive: bool = Query(False, description="Include paused/inactive agents"),
    service: AgentService = Depends(get_agent_service),
    current_user_id: UUID = Depends(get_current_user_id),
) -> list[Agent]:
    """
    Get current user's agents only (authenticated endpoint).
    Used for the user's personal dashboard.
    """
    agents = await service.get_by_user_id(current_user_id)
    if not include_inactive:
        agents = [a for a in agents if a.is_active]
    return agents


@router.post("", response_model=Agent, status_code=201)
async def create_agent(
    agent_data: AgentCreate,
    service: AgentService = Depends(get_agent_service),
    current_user_id: UUID = Depends(get_current_user_id),
) -> Agent:
    """
    Create a new agent for the current user (authenticated endpoint).
    The user_id is automatically set to the authenticated user.
    """
    # Override user_id with authenticated user (ignore any user_id in request)
    agent_data_dict = agent_data.model_dump()
    agent_data_dict["user_id"] = current_user_id

    # Recreate with correct user_id
    secured_agent_data = AgentCreate(**agent_data_dict)
    return await service.create(secured_agent_data)


@router.put("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: UUID,
    agent_data: AgentUpdate,
    service: AgentService = Depends(get_agent_service),
    current_user_id: UUID = Depends(get_current_user_id),
) -> Agent:
    """
    Update an agent (authenticated endpoint).
    Users can only update their own agents.
    """
    # Check ownership
    agent = await service.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this agent")

    updated_agent = await service.update(agent_id, agent_data)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return updated_agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: UUID,
    service: AgentService = Depends(get_agent_service),
    current_user_id: UUID = Depends(get_current_user_id),
) -> None:
    """
    Delete an agent (authenticated endpoint).
    Users can only delete their own agents.
    """
    # Check ownership
    agent = await service.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this agent")

    deleted = await service.delete(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/toggle-active", response_model=Agent)
async def toggle_agent_active(
    agent_id: UUID,
    service: AgentService = Depends(get_agent_service),
    current_user_id: UUID = Depends(get_current_user_id),
) -> Agent:
    """
    Toggle an agent's active status (pause/resume).
    Users can only toggle their own agents.
    """
    agent = await service.get_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to modify this agent")

    update_data = AgentUpdate(is_active=not agent.is_active)
    updated_agent = await service.update(agent_id, update_data)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return updated_agent


# =============================================================================
# ADMIN/INTERNAL ENDPOINTS (Should be protected in production)
# =============================================================================

@router.post("/{agent_id}/credits", response_model=Agent)
async def update_agent_credits(
    agent_id: UUID,
    amount: int = Query(..., description="Amount to add (positive) or subtract (negative)"),
    service: AgentService = Depends(get_agent_service),
) -> Agent:
    """
    Update agent credits (internal endpoint for auction system).
    Note: In production, this should be restricted to service-to-service calls.
    """
    agent = await service.update_credits(agent_id, amount)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# =============================================================================
# LEGACY ENDPOINT (Kept for backwards compatibility, consider deprecating)
# =============================================================================

@router.get("/user/{user_id}", response_model=list[Agent])
async def get_user_agents(
    user_id: UUID,
    service: AgentService = Depends(get_agent_service),
) -> list[Agent]:
    """
    Get agents by user ID (legacy endpoint).
    Prefer using GET /api/agents/my/agents for authenticated access.
    """
    return await service.get_by_user_id(user_id)

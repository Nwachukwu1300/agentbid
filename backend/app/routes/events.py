import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.services.database import DatabaseService, get_database_service
from app.services.event_manager import EventManager, get_event_manager

router = APIRouter(prefix="/api/events", tags=["events"])


async def event_generator(
    event_manager: EventManager,
) -> AsyncGenerator[str, None]:
    """Generate SSE events from the event queue."""
    queue: asyncio.Queue = asyncio.Queue()

    # Subscribe to all events
    await event_manager.subscribe(queue)

    try:
        # Send initial connection event
        yield format_sse_event("connected", {"status": "connected", "timestamp": datetime.now(timezone.utc).isoformat()})

        while True:
            try:
                # Wait for events with timeout to send keepalive
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield format_sse_event(event["type"], event["data"])
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        await event_manager.unsubscribe(queue)


def format_sse_event(event_type: str, data: dict) -> str:
    """Format an event for SSE."""
    json_data = json.dumps(data, default=str)
    return f"event: {event_type}\ndata: {json_data}\n\n"


@router.get("/stream")
async def event_stream(
    event_manager: EventManager = Depends(get_event_manager),
):
    """
    Server-Sent Events endpoint for real-time updates.

    Events include:
    - auction_created: New auction started
    - bid_placed: Agent placed a bid (includes reasoning)
    - auction_closed: Auction ended with results
    - trade_created: New barter trade matched
    - trade_completed: Barter trade finished
    - agent_decision: Agent made a decision
    """
    return StreamingResponse(
        event_generator(event_manager),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable buffering for nginx
        },
    )


@router.post("/test/{event_type}")
async def send_test_event(
    event_type: str,
    event_manager: EventManager = Depends(get_event_manager),
):
    """Send a test event (for development)."""
    test_data = {
        "test": True,
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await event_manager.publish(event_type, test_data)
    return {"status": "sent", "event_type": event_type}

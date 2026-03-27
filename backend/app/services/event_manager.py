import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID


class EventManager:
    """Manages SSE event broadcasting to connected clients."""

    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self, queue: asyncio.Queue) -> None:
        """Add a subscriber queue."""
        async with self._lock:
            self._subscribers.add(queue)

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue."""
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, event_type: str, data: dict) -> None:
        """Publish an event to all subscribers."""
        event = {
            "type": event_type,
            "data": {
                **data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }

        async with self._lock:
            for queue in self._subscribers:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    # Skip if queue is full (client not consuming fast enough)
                    pass

    async def publish_auction_created(
        self,
        auction_id: UUID,
        job_title: str,
        job_specialty: str,
        job_base_price: int,
        ends_at: str,
    ) -> None:
        """Publish auction created event."""
        await self.publish("auction_created", {
            "auction_id": str(auction_id),
            "job_title": job_title,
            "job_specialty": job_specialty,
            "job_base_price": job_base_price,
            "ends_at": ends_at,
        })

    async def publish_bid_placed(
        self,
        auction_id: UUID,
        bid_id: UUID,
        agent_id: UUID,
        agent_name: str,
        agent_specialty: str,
        amount: int,
        reasoning: str | None = None,
    ) -> None:
        """Publish bid placed event."""
        await self.publish("bid_placed", {
            "auction_id": str(auction_id),
            "bid_id": str(bid_id),
            "agent_id": str(agent_id),
            "agent_name": agent_name,
            "agent_specialty": agent_specialty,
            "amount": amount,
            "reasoning": reasoning,
        })

    async def publish_auction_closed(
        self,
        auction_id: UUID,
        job_id: UUID,
        job_title: str,
        winner_agent_id: UUID | None,
        winner_agent_name: str | None,
        winning_bid: int | None,
        total_bids: int,
        status: str,
    ) -> None:
        """Publish auction closed event."""
        await self.publish("auction_closed", {
            "auction_id": str(auction_id),
            "job_id": str(job_id),
            "job_title": job_title,
            "winner_agent_id": str(winner_agent_id) if winner_agent_id else None,
            "winner_agent_name": winner_agent_name,
            "winning_bid": winning_bid,
            "total_bids": total_bids,
            "status": status,
        })

    async def publish_trade_created(
        self,
        trade_id: UUID,
        agent_a_name: str,
        agent_b_name: str,
        job_a_specialty: str,
        job_b_specialty: str,
    ) -> None:
        """Publish trade created event."""
        await self.publish("trade_created", {
            "trade_id": str(trade_id),
            "agent_a_name": agent_a_name,
            "agent_b_name": agent_b_name,
            "job_a_specialty": job_a_specialty,
            "job_b_specialty": job_b_specialty,
        })

    async def publish_trade_completed(
        self,
        trade_id: UUID,
        agent_a_name: str,
        agent_b_name: str,
    ) -> None:
        """Publish trade completed event."""
        await self.publish("trade_completed", {
            "trade_id": str(trade_id),
            "agent_a_name": agent_a_name,
            "agent_b_name": agent_b_name,
        })

    async def publish_agent_decision(
        self,
        agent_id: UUID,
        agent_name: str,
        agent_specialty: str,
        decision_type: str,
        context: str,
        reasoning: str,
    ) -> None:
        """Publish agent decision event."""
        await self.publish("agent_decision", {
            "agent_id": str(agent_id),
            "agent_name": agent_name,
            "agent_specialty": agent_specialty,
            "decision_type": decision_type,
            "context": context,
            "reasoning": reasoning,
        })

    @property
    def subscriber_count(self) -> int:
        """Get the number of active subscribers."""
        return len(self._subscribers)


# Singleton instance
_event_manager: EventManager | None = None


def get_event_manager() -> EventManager:
    """Get the singleton event manager instance."""
    global _event_manager
    if _event_manager is None:
        _event_manager = EventManager()
    return _event_manager

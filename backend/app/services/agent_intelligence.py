import json
import logging
from uuid import UUID
from datetime import datetime, timezone
from openai import OpenAI

from app.models.agent import Agent
from app.models.agent_decision import (
    AgentDecision,
    BidDecision,
    PassDecision,
    DecisionType,
    AgentDecisionResponse,
    AuctionContext,
    AgentState,
)
from app.models.auction import AuctionWithJob
from app.services.database import DatabaseService
from app.services.agent_service import AgentService
from app.services.auction_service import AuctionService
from app.config import get_settings

logger = logging.getLogger(__name__)


class AgentIntelligenceService:
    """Service for AI-powered agent decision-making in auctions."""

    SYSTEM_PROMPT_TEMPLATE = """You are {agent_name}, a {specialty} agent in a competitive auction marketplace.

Your personality and bidding strategy:
{auction_instructions}

Current state:
- Workload: {workload} jobs
- Credits: {credits}

Job available:
{job_description}
Type: {job_specialty}
Market average price: {market_average}
Current leading bid: {leading_bid}
Time remaining: {time_remaining}s

IMPORTANT RULES:
1. Your personality and strategy instructions above are the MOST IMPORTANT factor in your decision
2. You can bid any positive amount - lower bids win the auction
3. Consider your workload, credits, and competitive position
4. You may bid multiple times per auction if needed

Respond with ONLY a valid JSON object in one of these formats:

To place a bid:
{{"bid": <amount>, "reasoning": "<your reasoning>"}}

To pass on this auction:
{{"action": "PASS", "reasoning": "<your reasoning>"}}

Do not include any other text, markdown formatting, or explanation outside the JSON object."""

    def __init__(self, db: DatabaseService):
        self.db = db
        self.settings = get_settings()
        self.client = OpenAI(api_key=self.settings.openai_api_key)
        self.agent_service = AgentService(db)
        self.auction_service = AuctionService(db)
        self.decisions_table = db.table("agent_decisions")

    def _build_system_prompt(
        self,
        agent_state: AgentState,
        auction_context: AuctionContext,
    ) -> str:
        """Build the system prompt with agent and auction context."""
        leading_bid_display = (
            f"{auction_context.current_leading_bid} credits"
            if auction_context.current_leading_bid
            else "No bids yet"
        )

        return self.SYSTEM_PROMPT_TEMPLATE.format(
            agent_name=agent_state.agent_name,
            specialty=agent_state.specialty,
            auction_instructions=agent_state.auction_instructions,
            workload=agent_state.workload_display,
            credits=agent_state.credits,
            job_description=f"{auction_context.job_title}\n{auction_context.job_description}",
            job_specialty=auction_context.job_specialty,
            market_average=auction_context.market_average_price,
            leading_bid=leading_bid_display,
            time_remaining=int(auction_context.time_remaining_seconds),
        )

    def _parse_decision(self, response_text: str) -> AgentDecision:
        """Parse the LLM response into an AgentDecision."""
        # Clean up response - remove markdown code blocks if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            # Remove markdown code block
            lines = cleaned.split("\n")
            # Remove first line (```json or ```)
            lines = lines[1:]
            # Remove last line if it's ``
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse agent response as JSON: {response_text}")
            raise ValueError(f"Invalid JSON response from agent: {e}")

        # Check if it's a PASS decision
        if data.get("action") == "PASS":
            reasoning = data.get("reasoning", "No reasoning provided")
            return PassDecision(reasoning=reasoning)

        # Check if it's a BID decision
        if "bid" in data:
            bid_amount = data["bid"]
            if not isinstance(bid_amount, (int, float)) or bid_amount <= 0:
                raise ValueError(f"Invalid bid amount: {bid_amount}")
            reasoning = data.get("reasoning", "No reasoning provided")
            return BidDecision(bid_amount=int(bid_amount), reasoning=reasoning)

        raise ValueError(f"Response must contain 'bid' or 'action': {data}")

    async def get_agent_decision(
        self,
        agent_id: UUID,
        auction_id: UUID,
    ) -> AgentDecisionResponse:
        """Get an AI-powered decision from an agent for a specific auction."""
        # Fetch agent
        agent = await self.agent_service.get_by_id(agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if not agent.is_active:
            raise ValueError("Agent is not active")

        # Fetch auction with job details
        auction = await self.auction_service.get_auction_with_job(auction_id)
        if not auction:
            raise ValueError("Auction not found")
        if not auction.is_active:
            raise ValueError("Auction is not active")

        # Check capacity - automatic PASS if at capacity
        if agent.is_at_capacity:
            logger.info(f"Agent {agent.name} at capacity, auto-passing auction {auction_id}")
            return AgentDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                auction_id=auction_id,
                decision_type=DecisionType.PASS,
                bid_amount=None,
                reasoning=f"At capacity ({agent.current_jobs}/5 jobs). Cannot take on more work.",
                raw_response=None,
                created_at=datetime.now(timezone.utc),
            )

        # Build context for the agent
        agent_state = AgentState(
            agent_name=agent.name,
            specialty=agent.specialty.value,
            auction_instructions=agent.auction_instructions,
            current_jobs=agent.current_jobs,
            credits=agent.credits,
        )

        auction_context = AuctionContext(
            job_title=auction.job_title,
            job_description=auction.job_description,
            job_specialty=auction.job_specialty.value,
            market_average_price=auction.job_base_price,
            current_leading_bid=auction.lowest_bid,
            time_remaining_seconds=auction.time_remaining_seconds,
            total_bids=auction.bid_count,
        )

        # Build the prompt
        system_prompt = self._build_system_prompt(agent_state, auction_context)

        # Call OpenAI
        try:
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Make your decision now."},
                ],
                max_tokens=self.settings.openai_max_tokens,
                temperature=self.settings.openai_temperature,
            )
            raw_response = response.choices[0].message.content
            logger.debug(f"Agent {agent.name} raw response: {raw_response}")
        except Exception as e:
            logger.error(f"OpenAI API error for agent {agent.name}: {e}")
            raise ValueError(f"Failed to get AI decision: {e}")

        # Parse the decision
        try:
            decision = self._parse_decision(raw_response)
        except ValueError as e:
            logger.error(f"Failed to parse decision for agent {agent.name}: {e}")
            # Default to PASS on parse failure
            return AgentDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                auction_id=auction_id,
                decision_type=DecisionType.PASS,
                bid_amount=None,
                reasoning=f"Decision error: {e}",
                raw_response=raw_response,
                created_at=datetime.now(timezone.utc),
            )

        # Build response
        decision_response = AgentDecisionResponse(
            agent_id=agent_id,
            agent_name=agent.name,
            auction_id=auction_id,
            decision_type=decision.decision_type,
            bid_amount=decision.bid_amount if isinstance(decision, BidDecision) else None,
            reasoning=decision.reasoning,
            raw_response=raw_response if self.settings.debug else None,
            created_at=datetime.now(timezone.utc),
        )

        # Store the decision for analytics
        await self._store_decision(decision_response)

        return decision_response

    async def _store_decision(self, decision: AgentDecisionResponse) -> None:
        """Store the agent decision in the database for analytics."""
        try:
            data = {
                "agent_id": str(decision.agent_id),
                "auction_id": str(decision.auction_id),
                "decision_type": decision.decision_type.value,
                "bid_amount": decision.bid_amount,
                "reasoning": decision.reasoning,
                "created_at": decision.created_at.isoformat(),
            }
            self.decisions_table.insert(data).execute()
        except Exception as e:
            # Don't fail the decision if storage fails
            logger.error(f"Failed to store agent decision: {e}")

    async def execute_decision(
        self,
        agent_id: UUID,
        auction_id: UUID,
    ) -> AgentDecisionResponse:
        """Get agent's decision and execute it (place bid if decided to bid)."""
        decision = await self.get_agent_decision(agent_id, auction_id)

        if decision.decision_type == DecisionType.BID and decision.bid_amount:
            # Place the bid
            from app.models.auction import BidCreate
            bid_data = BidCreate(
                auction_id=auction_id,
                agent_id=agent_id,
                amount=decision.bid_amount,
            )
            try:
                await self.auction_service.place_bid(bid_data)
                logger.info(
                    f"Agent {decision.agent_name} placed bid of {decision.bid_amount} "
                    f"on auction {auction_id}"
                )
            except ValueError as e:
                logger.error(f"Failed to place bid for agent {decision.agent_name}: {e}")
                # Update decision to reflect failed bid
                decision.reasoning = f"{decision.reasoning} [Bid failed: {e}]"

        return decision

    async def trigger_all_agents_for_auction(
        self,
        auction_id: UUID,
        specialty_match_only: bool = True,
    ) -> list[AgentDecisionResponse]:
        """Trigger all eligible agents to make decisions for an auction."""
        # Get auction details
        auction = await self.auction_service.get_auction_with_job(auction_id)
        if not auction or not auction.is_active:
            raise ValueError("Auction not found or not active")

        # Get all active agents
        agents = await self.agent_service.get_all(is_active=True)

        # Filter by specialty if requested
        if specialty_match_only:
            agents = [a for a in agents if a.specialty == auction.job_specialty]

        decisions = []
        for agent in agents:
            try:
                decision = await self.execute_decision(agent.id, auction_id)
                decisions.append(decision)
            except Exception as e:
                logger.error(f"Error getting decision from agent {agent.name}: {e}")
                # Create error response
                decisions.append(
                    AgentDecisionResponse(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        auction_id=auction_id,
                        decision_type=DecisionType.PASS,
                        bid_amount=None,
                        reasoning=f"Error: {e}",
                        raw_response=None,
                        created_at=datetime.now(timezone.utc),
                    )
                )

        return decisions

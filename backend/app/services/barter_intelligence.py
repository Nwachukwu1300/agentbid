import json
import logging
from uuid import UUID
from datetime import datetime, timezone
from openai import OpenAI

from app.models.agent import Agent
from app.models.barter import (
    TradeOffer,
    TradeOfferCreate,
    BarterDecision,
    BarterDecisionType,
    BarterDecisionRequest,
    BarterDecisionResponse,
    BarterContext,
    BarterAgentState,
)
from app.models.agent import AgentSpecialty
from app.services.database import DatabaseService
from app.services.agent_service import AgentService
from app.services.barter_service import BarterService
from app.config import get_settings

logger = logging.getLogger(__name__)


class BarterIntelligenceService:
    """Service for AI-powered agent decision-making in barter trades."""

    BARTER_PROMPT_TEMPLATE = """You are {agent_name}, a {specialty} agent in a marketplace where agents can barter services.

Your barter strategy and preferences:
{barter_instructions}

Current state:
- Workload: {workload} jobs
- Credits: {credits}

Available trade offer from {offerer_name}:
- They OFFER: {offered_service} work
- They WANT: {wanted_service} work in return

This is a direct trade - no credits involved. If you accept, you'll do {wanted_service} work for them, and they'll do {offered_service} work for you.

IMPORTANT:
1. Your barter strategy above is the MOST IMPORTANT factor in your decision
2. Consider if this trade benefits you based on your current needs and workload
3. Value is SUBJECTIVE - decide based on what YOU need, not market prices
4. Both jobs happen simultaneously and take the same time to complete
5. This counts toward your 5-job capacity limit

Respond with ONLY a valid JSON object in one of these formats:

To ACCEPT this trade:
{{"action": "ACCEPT", "reasoning": "<why this trade benefits you>"}}

To DECLINE this trade:
{{"action": "DECLINE", "reasoning": "<why this trade doesn't work for you>"}}

To POST YOUR OWN OFFER instead:
{{"action": "POST_OFFER", "offer": "<specialty you offer>", "want": "<specialty you want>", "reasoning": "<your strategy>"}}
Valid specialties: designer, coder, writer, data_analyst, tester

Do not include any other text, markdown formatting, or explanation outside the JSON object."""

    PROACTIVE_BARTER_PROMPT = """You are {agent_name}, a {specialty} agent in a marketplace where agents can barter services.

Your barter strategy and preferences:
{barter_instructions}

Current state:
- Workload: {workload} jobs
- Credits: {credits}

You have an opportunity to post a trade offer on the barter board. Other agents will see your offer and may accept it.

IMPORTANT:
1. Your barter strategy above guides what trades you should seek
2. Consider your current workload and what services would benefit you
3. You can only have ONE open offer at a time
4. Think about what services are valuable to you and what you can offer in return

Respond with ONLY a valid JSON object in one of these formats:

To POST an offer:
{{"action": "POST_OFFER", "offer": "<specialty you offer>", "want": "<specialty you want>", "reasoning": "<your strategy>"}}
Valid specialties: designer, coder, writer, data_analyst, tester

To PASS (not post any offer right now):
{{"action": "PASS", "reasoning": "<why you don't want to barter now>"}}

Do not include any other text, markdown formatting, or explanation outside the JSON object."""

    def __init__(self, db: DatabaseService):
        self.db = db
        self.settings = get_settings()
        self.client = OpenAI(api_key=self.settings.openai_api_key)
        self.agent_service = AgentService(db)
        self.barter_service = BarterService(db)
        self.decisions_table = db.table("barter_decisions")

    def _build_barter_prompt(
        self,
        agent_state: BarterAgentState,
        barter_context: BarterContext,
    ) -> str:
        """Build the system prompt for evaluating a trade offer."""
        return self.BARTER_PROMPT_TEMPLATE.format(
            agent_name=agent_state.agent_name,
            specialty=agent_state.specialty,
            barter_instructions=agent_state.barter_instructions,
            workload=agent_state.workload_display,
            credits=agent_state.credits,
            offerer_name=barter_context.offerer_name,
            offered_service=barter_context.offered_service,
            wanted_service=barter_context.wanted_service,
        )

    def _build_proactive_prompt(self, agent_state: BarterAgentState) -> str:
        """Build prompt for agent to decide whether to post their own offer."""
        return self.PROACTIVE_BARTER_PROMPT.format(
            agent_name=agent_state.agent_name,
            specialty=agent_state.specialty,
            barter_instructions=agent_state.barter_instructions,
            workload=agent_state.workload_display,
            credits=agent_state.credits,
        )

    def _parse_barter_decision(self, response_text: str) -> BarterDecision:
        """Parse the LLM response into a BarterDecision."""
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse barter response as JSON: {response_text}")
            raise ValueError(f"Invalid JSON response: {e}")

        action = data.get("action", "").upper()
        reasoning = data.get("reasoning", "No reasoning provided")

        if action == "ACCEPT":
            return BarterDecision(
                decision_type=BarterDecisionType.ACCEPT,
                reasoning=reasoning,
            )
        elif action == "DECLINE":
            return BarterDecision(
                decision_type=BarterDecisionType.DECLINE,
                reasoning=reasoning,
            )
        elif action == "POST_OFFER":
            offer_str = data.get("offer", "").lower().replace(" ", "_")
            want_str = data.get("want", "").lower().replace(" ", "_")

            try:
                offer_specialty = AgentSpecialty(offer_str)
                want_specialty = AgentSpecialty(want_str)
            except ValueError:
                raise ValueError(f"Invalid specialty in offer: offer={offer_str}, want={want_str}")

            return BarterDecision(
                decision_type=BarterDecisionType.POST_OFFER,
                reasoning=reasoning,
                offer_specialty=offer_specialty,
                want_specialty=want_specialty,
            )
        elif action == "PASS":
            return BarterDecision(
                decision_type=BarterDecisionType.DECLINE,
                reasoning=reasoning,
            )
        else:
            raise ValueError(f"Unknown action: {action}")

    async def evaluate_trade_offer(
        self,
        agent_id: UUID,
        trade_offer_id: UUID,
    ) -> BarterDecisionResponse:
        """Have an agent evaluate a trade offer using AI."""
        # Fetch agent
        agent = await self.agent_service.get_by_id(agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if not agent.is_active:
            raise ValueError("Agent is not active")

        # Fetch trade offer
        offer = await self.barter_service.get_offer_with_agent(trade_offer_id)
        if not offer:
            raise ValueError("Trade offer not found")

        # Check capacity - automatic decline if at capacity
        if agent.is_at_capacity:
            logger.info(f"Agent {agent.name} at capacity, auto-declining trade offer")
            return BarterDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                trade_offer_id=trade_offer_id,
                decision_type=BarterDecisionType.DECLINE,
                reasoning=f"At capacity ({agent.current_jobs}/5 jobs). Cannot take on more work.",
                raw_response=None,
                created_at=datetime.now(timezone.utc),
            )

        # Build context
        agent_state = BarterAgentState(
            agent_name=agent.name,
            specialty=agent.specialty.value,
            barter_instructions=agent.barter_instructions,
            current_jobs=agent.current_jobs,
            credits=agent.credits,
        )

        barter_context = BarterContext(
            offered_service=offer.offer_specialty.value,
            wanted_service=offer.want_specialty.value,
            offerer_name=offer.agent_name,
            offerer_specialty=offer.offer_specialty.value,
        )

        # Build prompt and call OpenAI
        system_prompt = self._build_barter_prompt(agent_state, barter_context)

        try:
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Make your decision about this trade offer."},
                ],
                max_tokens=self.settings.openai_max_tokens,
                temperature=self.settings.openai_temperature,
            )
            raw_response = response.choices[0].message.content
            logger.debug(f"Agent {agent.name} barter response: {raw_response}")
        except Exception as e:
            logger.error(f"OpenAI API error for agent {agent.name}: {e}")
            raise ValueError(f"Failed to get AI decision: {e}")

        # Parse decision
        try:
            decision = self._parse_barter_decision(raw_response)
        except ValueError as e:
            logger.error(f"Failed to parse barter decision for agent {agent.name}: {e}")
            return BarterDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                trade_offer_id=trade_offer_id,
                decision_type=BarterDecisionType.DECLINE,
                reasoning=f"Decision error: {e}",
                raw_response=raw_response,
                created_at=datetime.now(timezone.utc),
            )

        response_obj = BarterDecisionResponse(
            agent_id=agent_id,
            agent_name=agent.name,
            trade_offer_id=trade_offer_id,
            decision_type=decision.decision_type,
            reasoning=decision.reasoning,
            raw_response=raw_response if self.settings.debug else None,
            created_at=datetime.now(timezone.utc),
        )

        # Store for analytics
        await self._store_decision(response_obj)

        return response_obj

    async def get_proactive_offer_decision(
        self,
        agent_id: UUID,
    ) -> BarterDecisionResponse:
        """Have an agent decide whether to post a trade offer."""
        agent = await self.agent_service.get_by_id(agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if not agent.is_active:
            raise ValueError("Agent is not active")

        # Check capacity
        if agent.is_at_capacity:
            return BarterDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                trade_offer_id=None,
                decision_type=BarterDecisionType.DECLINE,
                reasoning=f"At capacity ({agent.current_jobs}/5 jobs). Cannot take on more work.",
                raw_response=None,
                created_at=datetime.now(timezone.utc),
            )

        # Check if already has open offer
        existing_offers = await self.barter_service.get_agent_open_offers(agent_id)
        if existing_offers:
            return BarterDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                trade_offer_id=None,
                decision_type=BarterDecisionType.DECLINE,
                reasoning="Already have an open trade offer.",
                raw_response=None,
                created_at=datetime.now(timezone.utc),
            )

        agent_state = BarterAgentState(
            agent_name=agent.name,
            specialty=agent.specialty.value,
            barter_instructions=agent.barter_instructions,
            current_jobs=agent.current_jobs,
            credits=agent.credits,
        )

        system_prompt = self._build_proactive_prompt(agent_state)

        try:
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Decide if you want to post a trade offer."},
                ],
                max_tokens=self.settings.openai_max_tokens,
                temperature=self.settings.openai_temperature,
            )
            raw_response = response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error for agent {agent.name}: {e}")
            raise ValueError(f"Failed to get AI decision: {e}")

        try:
            decision = self._parse_barter_decision(raw_response)
        except ValueError as e:
            return BarterDecisionResponse(
                agent_id=agent_id,
                agent_name=agent.name,
                trade_offer_id=None,
                decision_type=BarterDecisionType.DECLINE,
                reasoning=f"Decision error: {e}",
                raw_response=raw_response,
                created_at=datetime.now(timezone.utc),
            )

        response_obj = BarterDecisionResponse(
            agent_id=agent_id,
            agent_name=agent.name,
            trade_offer_id=None,
            decision_type=decision.decision_type,
            reasoning=decision.reasoning,
            raw_response=raw_response if self.settings.debug else None,
            created_at=datetime.now(timezone.utc),
        )

        await self._store_decision(response_obj)
        return response_obj

    async def execute_barter_decision(
        self,
        agent_id: UUID,
        trade_offer_id: UUID | None = None,
    ) -> BarterDecisionResponse:
        """
        Get agent's barter decision and execute it.

        If trade_offer_id is provided, evaluate that offer.
        If not, get a proactive decision about posting an offer.
        """
        if trade_offer_id:
            decision = await self.evaluate_trade_offer(agent_id, trade_offer_id)

            if decision.decision_type == BarterDecisionType.ACCEPT:
                # The original offer already exists - we need to create a counter-offer
                # that matches it, triggering the auto-match
                original_offer = await self.barter_service.get_offer_by_id(trade_offer_id)
                if original_offer:
                    try:
                        # Create matching counter-offer
                        counter_offer = await self.barter_service.create_offer(
                            TradeOfferCreate(
                                agent_id=agent_id,
                                offer_specialty=original_offer.want_specialty,
                                want_specialty=original_offer.offer_specialty,
                            )
                        )
                        # The auto-match should have happened
                        if counter_offer.trade_id:
                            decision.trade_id = counter_offer.trade_id
                            decision.new_offer_id = counter_offer.id
                    except ValueError as e:
                        decision.reasoning = f"{decision.reasoning} [Trade failed: {e}]"

        else:
            decision = await self.get_proactive_offer_decision(agent_id)

            if decision.decision_type == BarterDecisionType.POST_OFFER:
                # Parse the offer from the raw response
                try:
                    raw_data = json.loads(decision.raw_response or "{}")
                    offer_str = raw_data.get("offer", "").lower().replace(" ", "_")
                    want_str = raw_data.get("want", "").lower().replace(" ", "_")

                    new_offer = await self.barter_service.create_offer(
                        TradeOfferCreate(
                            agent_id=agent_id,
                            offer_specialty=AgentSpecialty(offer_str),
                            want_specialty=AgentSpecialty(want_str),
                        )
                    )
                    decision.new_offer_id = new_offer.id
                    if new_offer.trade_id:
                        decision.trade_id = new_offer.trade_id
                except Exception as e:
                    decision.reasoning = f"{decision.reasoning} [Offer creation failed: {e}]"

        return decision

    async def _store_decision(self, decision: BarterDecisionResponse) -> None:
        """Store barter decision for analytics."""
        try:
            data = {
                "agent_id": str(decision.agent_id),
                "trade_offer_id": str(decision.trade_offer_id) if decision.trade_offer_id else None,
                "decision_type": decision.decision_type.value,
                "reasoning": decision.reasoning,
                "created_at": decision.created_at.isoformat(),
            }
            self.decisions_table.insert(data).execute()
        except Exception as e:
            logger.error(f"Failed to store barter decision: {e}")

    async def trigger_agents_for_barter_round(
        self,
        agent_ids: list[UUID] | None = None,
    ) -> list[BarterDecisionResponse]:
        """
        Trigger multiple agents to consider posting barter offers.
        Used to simulate a barter round.
        """
        if agent_ids:
            agents = [await self.agent_service.get_by_id(aid) for aid in agent_ids]
            agents = [a for a in agents if a and a.is_active]
        else:
            agents = await self.agent_service.get_all(is_active=True)

        decisions = []
        for agent in agents:
            if agent.is_at_capacity:
                continue

            try:
                decision = await self.execute_barter_decision(agent.id)
                decisions.append(decision)
            except Exception as e:
                logger.error(f"Error getting barter decision from agent {agent.name}: {e}")

        return decisions

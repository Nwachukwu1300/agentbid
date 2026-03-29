"""
LLM-Assisted Agent Builder Service

This service powers the "wow" feature - users describe their desired agent
in natural language, and the LLM generates comprehensive, strategic
auction and barter instructions.
"""

import json
import logging
from typing import Optional
from openai import OpenAI
from pydantic import BaseModel

from app.config import get_settings
from app.models.agent import AgentSpecialty

logger = logging.getLogger(__name__)


class GeneratedInstructions(BaseModel):
    """The output of the LLM instruction generation."""
    auction_instructions: str
    barter_instructions: str
    suggested_name: str
    personality_summary: str


class ConversationMessage(BaseModel):
    """A message in the agent creation conversation."""
    role: str  # 'user' or 'assistant'
    content: str


class AgentBuilderService:
    """
    Service for LLM-assisted agent creation.

    Users chat with the LLM to describe their desired agent strategy,
    and the LLM generates rich, detailed personality instructions.
    """

    SYSTEM_PROMPT = """You are an AI assistant helping users create autonomous agents for a competitive marketplace.

The marketplace works like this:
- Agents compete in real-time auctions for service jobs (like Upwork but for AI agents)
- Agents win by bidding the LOWEST price (reverse auction)
- Agents also engage in barter trades, exchanging services with each other
- Each agent has a specialty: Designer, Coder, Writer, Data Analyst, or Tester
- Agents start with 1000 credits and can hold max 5 concurrent jobs
- When they win a job, credits transfer immediately

Your job is to:
1. Have a friendly, engaging conversation to understand what kind of agent the user wants
2. Ask clarifying questions to understand their strategy preferences
3. When you have enough information, generate comprehensive personality instructions

IMPORTANT STRATEGY DIMENSIONS TO EXPLORE:
- Risk tolerance: Conservative (safe bids) vs Aggressive (undercut heavily)
- Specialization focus: Jobs that match specialty vs taking any available work
- Pricing strategy: Premium (higher bids, fewer jobs) vs Volume (low bids, many jobs)
- Workload management: Stay lean (1-2 jobs) vs maximize capacity (4-5 jobs)
- Credit strategy: Preserve credits vs reinvest aggressively
- Competition response: React to competitors or stick to own strategy
- Barter preference: Seek trades actively or focus on auctions
- Service preferences: What types of work within their specialty they prefer

Keep the conversation natural and conversational. Don't ask all questions at once.
Ask 2-3 questions per response, building on previous answers.

When you feel you have enough information (usually after 2-4 exchanges),
indicate you're ready to generate instructions by saying something like
"I think I understand what you're looking for! Let me create your agent..."

Be enthusiastic and make the user feel their agent will be unique and strategic."""

    GENERATION_PROMPT = """Based on our conversation, generate comprehensive personality instructions for this agent.

The user wants a {specialty} agent with these characteristics:
{conversation_summary}

Generate TWO sets of instructions:

1. AUCTION INSTRUCTIONS - How the agent should behave in competitive auctions
   - Be specific about bidding strategy, risk tolerance, pricing approach
   - Include personality traits that will influence decisions
   - Reference specific scenarios (when to bid aggressively, when to pass)
   - Make it feel like a real personality, not generic rules

2. BARTER INSTRUCTIONS - How the agent should handle direct trade negotiations
   - What trades are valuable to them
   - When to accept vs decline trades
   - Their approach to building relationships
   - Specialty preferences for trades

CRITICAL: Make these instructions RICH and DETAILED (150-300 words each).
They should capture a distinct personality that will lead to unique behavior.
Avoid generic advice - be specific and strategic.

Also suggest:
- A creative, memorable name that fits the personality
- A one-sentence personality summary

Respond with ONLY a valid JSON object in this exact format:
{{
  "auction_instructions": "...",
  "barter_instructions": "...",
  "suggested_name": "...",
  "personality_summary": "..."
}}"""

    REFINEMENT_PROMPT = """The user has provided feedback on the generated instructions.

Current instructions:
AUCTION: {current_auction}
BARTER: {current_barter}

User feedback: {feedback}

Please regenerate the instructions incorporating this feedback while maintaining
the rich, detailed personality approach. Keep the overall strategy but adjust
based on the user's input.

Respond with ONLY a valid JSON object:
{{
  "auction_instructions": "...",
  "barter_instructions": "...",
  "suggested_name": "...",
  "personality_summary": "..."
}}"""

    def __init__(self):
        self.settings = get_settings()
        self.client = OpenAI(api_key=self.settings.openai_api_key)

    async def chat(
        self,
        messages: list[ConversationMessage],
        specialty: Optional[AgentSpecialty] = None,
    ) -> str:
        """
        Continue the agent creation conversation.

        Args:
            messages: The conversation history
            specialty: The agent's specialty (if already selected)

        Returns:
            The assistant's response
        """
        # Build messages for the API
        api_messages = [{"role": "system", "content": self.SYSTEM_PROMPT}]

        # Add specialty context if provided
        if specialty:
            api_messages.append({
                "role": "system",
                "content": f"The user has selected the {specialty.value} specialty. "
                           f"Tailor your questions and suggestions to this specialty."
            })

        # Add conversation history
        for msg in messages:
            api_messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Use GPT-4 for better conversation quality
                messages=api_messages,
                max_tokens=500,
                temperature=0.8,  # More creative conversation
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI chat error: {e}")
            raise ValueError(f"Failed to get response: {e}")

    async def generate_instructions(
        self,
        conversation: list[ConversationMessage],
        specialty: AgentSpecialty,
    ) -> GeneratedInstructions:
        """
        Generate comprehensive agent instructions based on the conversation.

        Args:
            conversation: The full conversation history
            specialty: The agent's specialty

        Returns:
            Generated auction and barter instructions with suggested name
        """
        # Build conversation summary for context
        conversation_text = "\n".join([
            f"{msg.role.upper()}: {msg.content}"
            for msg in conversation
        ])

        prompt = self.GENERATION_PROMPT.format(
            specialty=specialty.value,
            conversation_summary=conversation_text,
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1500,
                temperature=0.7,
            )

            raw_response = response.choices[0].message.content
            return self._parse_instructions(raw_response)

        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            raise ValueError(f"Failed to generate instructions: {e}")

    async def refine_instructions(
        self,
        current: GeneratedInstructions,
        feedback: str,
        specialty: AgentSpecialty,
    ) -> GeneratedInstructions:
        """
        Refine generated instructions based on user feedback.

        Args:
            current: The current generated instructions
            feedback: User's feedback for refinement
            specialty: The agent's specialty

        Returns:
            Refined instructions
        """
        prompt = self.REFINEMENT_PROMPT.format(
            current_auction=current.auction_instructions,
            current_barter=current.barter_instructions,
            feedback=feedback,
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1500,
                temperature=0.7,
            )

            raw_response = response.choices[0].message.content
            return self._parse_instructions(raw_response)

        except Exception as e:
            logger.error(f"OpenAI refinement error: {e}")
            raise ValueError(f"Failed to refine instructions: {e}")

    async def quick_generate(
        self,
        description: str,
        specialty: AgentSpecialty,
    ) -> GeneratedInstructions:
        """
        Quick generation without conversation - for users who want to skip chat.

        Args:
            description: User's brief description of desired agent
            specialty: The agent's specialty

        Returns:
            Generated instructions
        """
        prompt = f"""Generate comprehensive agent personality instructions based on this description:

Specialty: {specialty.value}
User's description: {description}

Create RICH, DETAILED instructions (150-300 words each) that capture a distinct personality.
Be specific about:
- Bidding strategy and risk tolerance
- Pricing approach
- Workload preferences
- When to be aggressive vs conservative
- Barter preferences and trade approach

Respond with ONLY a valid JSON object:
{{
  "auction_instructions": "...",
  "barter_instructions": "...",
  "suggested_name": "...",
  "personality_summary": "..."
}}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=1500,
                temperature=0.7,
            )

            raw_response = response.choices[0].message.content
            return self._parse_instructions(raw_response)

        except Exception as e:
            logger.error(f"OpenAI quick generation error: {e}")
            raise ValueError(f"Failed to generate instructions: {e}")

    def _parse_instructions(self, response_text: str) -> GeneratedInstructions:
        """Parse the LLM response into GeneratedInstructions."""
        # Clean up response - remove markdown code blocks if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            data = json.loads(cleaned)
            return GeneratedInstructions(
                auction_instructions=data["auction_instructions"],
                barter_instructions=data["barter_instructions"],
                suggested_name=data.get("suggested_name", "My Agent"),
                personality_summary=data.get("personality_summary", "A strategic marketplace agent"),
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Failed to parse instructions: {response_text}")
            raise ValueError(f"Failed to parse generated instructions: {e}")


# Singleton instance
_agent_builder: Optional[AgentBuilderService] = None


def get_agent_builder() -> AgentBuilderService:
    """Get or create the agent builder service singleton."""
    global _agent_builder
    if _agent_builder is None:
        _agent_builder = AgentBuilderService()
    return _agent_builder

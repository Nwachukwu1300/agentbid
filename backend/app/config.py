import hashlib

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    supabase_service_role_key: str | None = None

    # OpenAI Configuration
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"  # Cost-effective for agent decisions
    openai_max_tokens: int = 256
    openai_temperature: float = 0.7  # Some creativity in reasoning

    # Application Settings
    app_name: str = "AgentBid"
    debug: bool = False
    # Comma-separated frontend URLs allowed to call the API from a browser
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Agent Defaults
    default_agent_credits: int = 1000
    # Ignored: capacity is fixed at models.agent.MAX_JOBS (5) and enforced by the database. Kept so old .env files still load.
    max_agent_capacity: int = 5

    # Job Settings
    job_completion_duration_seconds: int = 300  # 5 minutes

    # Auction Settings
    auction_min_duration_seconds: int = 90
    auction_max_duration_seconds: int = 120
    job_spawn_interval_seconds: int = 30

    # Arena economy
    work_cost_ratio: float = 0.5  # delivering a job costs this share of its budget...
    workload_cost_step: float = 0.10  # ...plus this much more per job the agent is already running
    # Each agent's cost for each job varies by up to this much either way, known only to that agent. Without it
    # every rival has the same cost, so everyone bids cost + 1 and wins pay almost nothing.
    private_cost_spread: float = 0.2
    season_duration_seconds: int = 3600

    # Daily caps on paid AI calls
    ai_daily_agent_calls: int = 3000  # whole arena; agents pass once it is reached
    ai_daily_builder_calls_per_user: int = 30
    ai_daily_negotiation_calls: int = 2000  # whole arena; winners keep their bid once it is reached

    # Negotiation after the auction (all tunables in one place)
    negotiation_share: float = 0.3  # chance a winning bid goes to a negotiation with the client
    client_max_low_ratio: float = 0.7  # client's secret top price is drawn between these shares of the budget
    client_max_high_ratio: float = 1.2
    agent_max_offer_ratio: float = 2.0  # agents can't ask more than this share of the budget
    negotiation_max_turns: int = 6  # messages in total, client first
    negotiation_turn_interval_seconds: int = 4  # pacing, so people can watch live
    negotiation_max_message_chars: int = 400
    no_deal_penalty: int = 0  # credits lost when the agent walks away or turns run out

    def work_cost(self, base_price: int, jobs_running: int = 0, agent_id=None, auction_id=None) -> int:
        """Credits it costs this agent to deliver a job. Winner's profit = bid - work cost.

        With agent_id and auction_id, includes that agent's private cost factor for that auction.
        """
        factor = self.private_cost_factor(agent_id, auction_id) if agent_id and auction_id else 1.0
        return round(base_price * self.work_cost_ratio * (1 + self.workload_cost_step * jobs_running) * factor)

    def private_cost_factor(self, agent_id, auction_id) -> float:
        """Stable per agent and auction, between 1 - spread and 1 + spread, so the prompt, the stored bid and
        the explanations all agree without storing it."""
        digest = hashlib.sha256(f"{agent_id}:{auction_id}".encode()).digest()
        unit = int.from_bytes(digest[:8], "big") / 2**64  # uniform in [0, 1)
        return 1 + self.private_cost_spread * (2 * unit - 1)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

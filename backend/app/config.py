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

    # Agent Defaults
    default_agent_credits: int = 1000
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
    season_duration_seconds: int = 3600

    def work_cost(self, base_price: int, jobs_running: int = 0) -> int:
        """Credits it costs this agent to deliver a job. Winner's profit = bid - work cost."""
        return round(base_price * self.work_cost_ratio * (1 + self.workload_cost_step * jobs_running))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

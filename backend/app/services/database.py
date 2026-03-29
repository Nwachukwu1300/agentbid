from supabase import create_client, Client
from functools import lru_cache

from app.config import get_settings


class DatabaseService:
    def __init__(self, client: Client):
        self.client = client

    def table(self, table_name: str):
        return self.client.table(table_name)

    @property
    def auth(self):
        return self.client.auth


@lru_cache
def get_supabase_client() -> Client:
    """Get Supabase client using service role key (bypasses RLS) if available,
    otherwise falls back to anon key."""
    settings = get_settings()
    # Use service role key for backend operations (bypasses RLS)
    # This is needed for job spawning, auction management, etc.
    key = settings.supabase_service_role_key or settings.supabase_key
    return create_client(settings.supabase_url, key)


def get_database_service() -> DatabaseService:
    client = get_supabase_client()
    return DatabaseService(client)

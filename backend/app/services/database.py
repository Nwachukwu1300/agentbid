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
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


def get_database_service() -> DatabaseService:
    client = get_supabase_client()
    return DatabaseService(client)

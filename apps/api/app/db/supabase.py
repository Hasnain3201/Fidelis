from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from supabase import Client


@lru_cache(maxsize=1)
def get_supabase_client() -> "Client":
    """Shared anonymous client – use for public read operations only."""
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not set")
    if not settings.supabase_publishable_key:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY is not set")

    try:
        from supabase import create_client
    except Exception as exc:
        raise RuntimeError(f"Failed to import Supabase client dependency: {exc}") from exc

    try:
        return create_client(settings.supabase_url, settings.supabase_publishable_key)
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize Supabase client: {exc}") from exc


def get_supabase_client_for_user(access_token: str) -> "Client":
    """Request-scoped client that forwards the caller's JWT so Supabase
    PostgREST evaluates RLS policies with ``auth.uid()`` set to the caller."""
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not set")
    if not settings.supabase_publishable_key:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY is not set")

    try:
        from supabase import create_client
    except Exception as exc:
        raise RuntimeError(f"Failed to import Supabase client dependency: {exc}") from exc

    try:
        client = create_client(settings.supabase_url, settings.supabase_publishable_key)
        client.postgrest.auth(access_token)
        return client
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize user-scoped Supabase client: {exc}") from exc

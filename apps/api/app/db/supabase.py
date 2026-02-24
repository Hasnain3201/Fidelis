from functools import lru_cache
from typing import Optional, TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from supabase import Client


@lru_cache(maxsize=1)
def get_supabase_client() -> Optional["Client"]:
    if not settings.supabase_url:
        return None

    key = settings.supabase_publishable_key or settings.supabase_secret_key
    if not key:
        return None

    try:
        from supabase import create_client
    except Exception:
        # Keep local development working even if optional Supabase deps are partially installed.
        return None

    return create_client(settings.supabase_url, key)

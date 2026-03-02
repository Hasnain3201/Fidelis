from functools import lru_cache
from typing import Optional, TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from supabase import Client

@lru_cache(maxsize=1)
def get_supabase_admin_client() -> Optional["Client"]:
    if not settings.supabase_url:
        return None
    
    key = getattr(settings, "supabase_service_role_key", None) or getattr(settings, "supabase_secret_key", None)

    if not key:
        return None
    
    try:
        from supabase import create_client
    except:
        return None
    
    return create_client(settings.supabase_url, key)
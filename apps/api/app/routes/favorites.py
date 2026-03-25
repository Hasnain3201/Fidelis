from fastapi import APIRouter, Depends, HTTPException, status

from uuid import UUID
from datetime import datetime, timezone

from app.core.auth import AuthContext, get_auth_context
from app.db.supabase_admin import get_supabase_admin_client
from app.models.favorite_schemas import FavoriteCreate, FavoriteRead

router = APIRouter()


def _get_admin_client_or_503():
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase admin client is unavailable. Verify backend Supabase environment configuration.",
        )
    return client


def _require_user_role(auth: AuthContext) -> None:
    if auth.role not in {"user", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role 'user' required",
        )

@router.get("/", response_model=list[FavoriteRead])
async def list_favorites(auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = _get_admin_client_or_503()

    response = (
        client
        .table("favorites")
        .select("event_id,created_at,events!favorites_event_id_fkey(title,start_time)")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
        .execute()
    )

    data = response.data or []

    favorites = []

    for row in data:
        event = row.get("events") or {}
        created_at = row.get("created_at") or datetime.now(timezone.utc).isoformat()

        favorites.append({
            "event_id": row["event_id"],
            "created_at": created_at,
            "title": event.get("title") or "Untitled Event",
            "start_time": event.get("start_time") or created_at,
        })

    return favorites    

@router.post("/", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(payload: FavoriteCreate, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = _get_admin_client_or_503()

    row = {
        "user_id": auth.user_id,
        "event_id": payload.event_id,
    }

    response = (
        client
        .table("favorites")
        .upsert(row)
        .execute()
    )

    event = (
        client
        .table("events")
        .select("title,start_time")
        .eq("id", payload.event_id)
        .single()
        .execute()
    ).data

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return {
        "event_id": payload.event_id,
        "created_at": datetime.now(timezone.utc),  
        "title": event["title"],
        "start_time": event["start_time"],
    }

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(event_id: UUID, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = _get_admin_client_or_503()

    client.table("favorites").delete().eq("user_id", auth.user_id).eq("event_id", event_id).execute()

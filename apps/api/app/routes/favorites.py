from fastapi import APIRouter, Depends, HTTPException, status

from uuid import UUID
from datetime import datetime, timezone

from app.core.auth import require_user_id
from app.db.supabase_admin import get_supabase_admin_client
from app.models.favorite_schemas import FavoriteCreate, FavoriteRead

router = APIRouter()

@router.get("/", response_model=list[FavoriteRead])
async def list_favorites(user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    response = (
        client
        .table("favorites")
        .select("event_id,created_at,events!favorites_event_id_fkey(title,start_time)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    data = response.data or []

    favorites = []

    for row in data:
        event = row.get("events") or {}

        favorites.append({
            "event_id": row["event_id"],
            "created_at": row["created_at"],
            "title": event.get("title"),
            "start_time": event.get("start_time"),
        })

    return favorites    

@router.post("/", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
async def add_favorite(payload: FavoriteCreate, user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    row = {
        "user_id": user_id,
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

    return {
        "event_id": payload.event_id,
        "created_at": datetime.now(timezone.utc),  
        "title": event["title"],
        "start_time": event["start_time"],
    }

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(event_id: UUID, user_id:UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    client.table("favorites").delete().eq("user_id", user_id).eq("event_id", event_id).execute()


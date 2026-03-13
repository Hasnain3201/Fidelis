from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id
from app.db.supabase_admin import get_supabase_admin_client
from app.models.schemas import FavoriteCreate, FavoriteRead

router = APIRouter()

@router.get("/", response_model=list[FavoriteRead])
async def list_favorites(user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    response = (
        client
        .table("favorites")
        .select("event_id,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return response.data or []
    

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
        .insert(row)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save favorite")
    
    return response.data[0]

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(event_id: UUID, user_id:UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    client.table("favorites").delete().eq("user_id", user_id).eq("event_id", event_id).execute()


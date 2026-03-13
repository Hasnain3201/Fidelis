from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id

from app.db.supabase_admin import get_supabase_admin_client
from app.models.schemas import FollowCreate, FollowRead

router = APIRouter()

@router.get("/", response_model=list[FollowRead])
async def list_follows(user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    response = (
        client
        .table("artist_follows")
        .select("artist_id,created_at")
        .eq("user_id", user_id)
        .execute()
    )

    return response.data or [] 

@router.post("/")
async def create_follow(payload: FollowCreate, user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    row = {
        "user_id": user_id,
        "artist_id": payload.artist_id
    }

    response = (
        client
        .table("artist_follows")
        .insert(row)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to follow.")

    return response.data[0] or None

@router.delete("/{artist_id}")
async def remove_follow(artist_id: UUID, user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    client.table("artist_follows").delete().eq("user_id", user_id).eq("artist_id", artist_id).execute()
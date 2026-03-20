from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id

from app.db.supabase_admin import get_supabase_admin_client
from app.models.follow_schemas import FollowCreate, FollowRead

router = APIRouter()

@router.get("/", response_model=list[FollowRead])
async def list_follows(user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    response = (
        client
        .table("artist_follows")
        .select("artist_id,created_at,artists(stage_name)")
        .eq("user_id", user_id)
        .execute()
    )

    data = response.data or []

    follows = []

    for row in data:
        artist = row.get("artists") or {}

        follows.append({
            "artist_id": row["artist_id"],
            "created_at": row["created_at"],
            "stage_name": artist.get("stage_name")
        })

    return follows

@router.post("/", response_model=FollowRead)
async def create_follow(payload: FollowCreate, user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    row = {
        "user_id": user_id,
        "artist_id": payload.artist_id
    }

    existing = (
        client
        .table("artist_follows")
        .select("artist_id")
        .eq("user_id", user_id)
        .eq("artist_id", payload.artist_id)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=400, detail="Already following artist.")

    response = (
        client
        .table("artist_follows")
        .insert(row)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to follow."
        )

    follow = response.data[0]

    artist_res = (
        client
        .table("artists")
        .select("stage_name")
        .eq("id", follow["artist_id"])
        .single()
        .execute()
    )

    artist = artist_res.data or {}

    return {
        "artist_id": follow["artist_id"],
        "created_at": follow["created_at"],
        "stage_name": artist.get("stage_name")
    }

@router.delete("/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_follow(artist_id: UUID, user_id: UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

    client.table("artist_follows").delete().eq("user_id", user_id).eq("artist_id", artist_id).execute()
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase import get_supabase_client
from app.core.auth import require_role, require_user_id

router = APIRouter()


@router.get("/mine")
def get_my_artist_profile(
    user_id: str = Depends(require_user_id),
    _: str = Depends(require_role("artist")),
) -> dict:
    client = get_supabase_client()

    if client is None:
        return {
            "owner_user_id": user_id,
            "message": "Artist profile scaffolded. Add media, availability, and linked events.",
        }

    try:
        response = (
            client.table("artists")
            .select("id,stage_name,genre,bio,media_url,created_at,updated_at")
            .eq("owner_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load artist profile")

    rows = response.data or []
    if not rows:
        return {
            "owner_user_id": user_id,
            "has_artist_profile": False,
            "message": "No artist profile found for this user. Create one in Supabase to see it here.",
        }

    artist = rows[0]
    return {
        "owner_user_id": user_id,
        "has_artist_profile": True,
        "artist": artist,
    }

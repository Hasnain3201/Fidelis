from fastapi import APIRouter, Depends

from app.core.auth import require_role, require_user_id

router = APIRouter()


@router.get("/mine")
def get_my_artist_profile(
    user_id: str = Depends(require_user_id),
    _: str = Depends(require_role("artist")),
) -> dict:
    return {
        "owner_user_id": user_id,
        "message": "Artist profile scaffolded. Add media, availability, and linked events.",
    }

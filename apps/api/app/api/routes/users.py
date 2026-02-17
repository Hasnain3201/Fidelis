from fastapi import APIRouter, Depends

from app.core.auth import require_user_id
from app.models.schemas import FavoriteCreate

router = APIRouter()


@router.get("/me")
def current_user(user_id: str = Depends(require_user_id)) -> dict:
    return {
        "id": user_id,
        "role": "user",
        "message": "Replace with Supabase JWT claims.",
    }


@router.post("/favorites")
def add_favorite(payload: FavoriteCreate, user_id: str = Depends(require_user_id)) -> dict:
    return {
        "user_id": user_id,
        "event_id": payload.event_id,
        "status": "saved",
    }

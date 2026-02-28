from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase import get_supabase_client
from app.core.auth import require_user_id
from app.models.schemas import FavoriteCreate

router = APIRouter()


@router.get("/me")
def current_user(user_id: str = Depends(require_user_id)) -> dict:
    client = get_supabase_client()

    if client is None:
        return {
            "id": user_id,
            "role": "user",
            "message": "Replace with Supabase JWT claims.",
        }

    try:
        response = (
            client.table("profiles")
            .select("id,role,display_name,home_zip,created_at,updated_at")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load user profile")

    profile = response.data or {}
    if not profile:
        return {
            "id": user_id,
            "role": "user",
            "message": "Profile not found in Supabase. Create a profile row to enrich this payload.",
        }

    return profile


@router.post("/favorites")
def add_favorite(payload: FavoriteCreate, user_id: str = Depends(require_user_id)) -> dict:
    client = get_supabase_client()

    if client is None:
        return {
            "user_id": user_id,
            "event_id": payload.event_id,
            "status": "saved",
        }

    favorite_row = {
        "user_id": user_id,
        "event_id": payload.event_id,
    }

    try:
        client.table("favorites").insert(favorite_row).execute()
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save favorite")

    return {
        "user_id": user_id,
        "event_id": payload.event_id,
        "status": "saved",
    }

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id

from app.db.supabase_admin import get_supabase_admin_client

from app.models.profile_schemas import ProfileSummary, UpdateProfileResponse

router = APIRouter()


def _get_admin_client_or_503():
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase admin client is unavailable. Verify backend Supabase environment configuration.",
        )
    return client

@router.get("/me", response_model=ProfileSummary)
async def get_my_profile(user_id:UUID = Depends(require_user_id)):
    client = _get_admin_client_or_503()

    response = (
        client
        .table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return response.data

@router.patch("/me")
async def update_my_profile(payload: UpdateProfileResponse, user_id: UUID = Depends(require_user_id)):
    client = _get_admin_client_or_503()

    updated_fields = payload.model_dump(exclude_unset=True)

    response = (
        client
        .table("profiles")
        .update(updated_fields)
        .eq("id", user_id)
        .execute()
    )

    return response.data

@router.get("/{profile_id}")
async def view_profile(profile_id: UUID):
    client = _get_admin_client_or_503()

    response = (
        client
        .table("profiles")
        .select("id,display_name,avatar_url,city,state")
        .eq("id", profile_id)
        .single()
        .execute()
    )
   
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return response.data

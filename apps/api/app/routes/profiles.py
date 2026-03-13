from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id

from app.db.supabase_admin import get_supabase_admin_client

from app.models.profile_schemas import ProfileSummary, UpdateProfileResponse

router = APIRouter()

@router.get("/me", response_model=ProfileSummary)
async def get_my_profile(user_id:UUID = Depends(require_user_id)):
    client = get_supabase_admin_client()

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
    client = get_supabase_admin_client()

    updated_fields = payload.model_dump(exclude_unset=True)

    response = (
        client
        .table("profiles")
        .update(updated_fields)
        .eq("id", user_id)
        .execute()
    )

    return response.data

@router.get("/{profiles_id}")
async def view_profile(profile_id: UUID):
    client = get_supabase_admin_client()

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


from datetime import datetime, timezone
import re
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import require_user_id
from app.db.supabase_admin import get_supabase_admin_client
from app.models.profile_schemas import (
    ProfileSummary,
    UpdateProfileResponse,
    UpdateProfilePreferencesRequest,
)

router = APIRouter()


def _get_admin_client_or_503():
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase admin client is unavailable. Verify backend Supabase environment configuration.",
        )
    return client


def _normalize_tokens(values: list[str], max_items: int = 20) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    for raw in values:
        if not isinstance(raw, str):
            continue
        token = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
        if not token or token in seen:
            continue
        seen.add(token)
        out.append(token)
        if len(out) >= max_items:
            break

    return out


@router.get("/me", response_model=ProfileSummary)
async def get_my_profile(user_id: UUID = Depends(require_user_id)):
    client = _get_admin_client_or_503()

    response = (
        client
        .table("profiles")
        .select("*")
        .eq("id", str(user_id))
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
        .eq("id", str(user_id))
        .execute()
    )

    return response.data


@router.patch("/me/preferences", response_model=ProfileSummary)
async def update_my_preferences(
    payload: UpdateProfilePreferencesRequest,
    user_id: UUID = Depends(require_user_id),
):
    client = _get_admin_client_or_503()
    updates: dict = {}

    if payload.preferred_genres is not None:
        updates["preferred_genres"] = _normalize_tokens(payload.preferred_genres)

    if payload.preferred_event_types is not None:
        updates["preferred_event_types"] = _normalize_tokens(payload.preferred_event_types)

    if payload.budget_min is not None:
        if payload.budget_min < 0:
            raise HTTPException(status_code=422, detail="budget_min must be >= 0")
        updates["budget_min"] = payload.budget_min

    if payload.budget_max is not None:
        if payload.budget_max < 0:
            raise HTTPException(status_code=422, detail="budget_max must be >= 0")
        updates["budget_max"] = payload.budget_max

    if payload.budget_min is not None and payload.budget_max is not None:
        if payload.budget_min > payload.budget_max:
            raise HTTPException(status_code=422, detail="budget_min cannot exceed budget_max")

    if payload.max_distance_miles is not None:
        if payload.max_distance_miles < 1 or payload.max_distance_miles > 250:
            raise HTTPException(status_code=422, detail="max_distance_miles must be between 1 and 250")
        updates["max_distance_miles"] = payload.max_distance_miles

    if payload.mark_onboarding_complete:
        updates["onboarding_completed_at"] = datetime.now(timezone.utc).isoformat()

    if not updates:
        raise HTTPException(status_code=422, detail="No preference fields provided")

    try:
        client.table("profiles").update(updates).eq("id", str(user_id)).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {exc}")

    try:
        fetch = (
            client.table("profiles")
            .select("*")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Preferences updated, but reload failed: {exc}")

    if not fetch.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return fetch.data

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
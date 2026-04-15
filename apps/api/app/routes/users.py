from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthContext, get_auth_context
from app.db.supabase import get_supabase_client_for_user
from app.models.favorite_schemas import FavoriteCreate, FavoriteRead
from app.models.follow_schemas import FollowCreate, FollowRead
from app.models.profile_schemas import UpdateProfileResponse

router = APIRouter()


def _get_user_client_or_500(access_token: str):
    try:
        return get_supabase_client_for_user(access_token)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


def _execute_or_503(fn, detail: str):
    try:
        return fn()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        ) from exc


@router.get("/me")
def get_user_profile(auth: AuthContext = Depends(get_auth_context)):
    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("profiles")
            .select("*")
            .eq("id", auth.user_id)
            .single()
            .execute()
        ),
        "Failed to load profile",
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return response.data


@router.patch("/me")
def update_user_profile(
    payload: UpdateProfileResponse,
    auth: AuthContext = Depends(get_auth_context),
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("profiles")
            .update(updates)
            .eq("id", auth.user_id)
            .execute()
        ),
        "Failed to update profile",
    )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Profile not found")
    return rows[0]


@router.get("/favorites", response_model=list[FavoriteRead])
def list_user_favorites(auth: AuthContext = Depends(get_auth_context)):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("favorites")
            .select("event_id,created_at,events(title,start_time)")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        ),
        "Failed to load favorites",
    )

    rows = response.data or []
    favorites: list[dict[str, Any]] = []
    for row in rows:
        event = row.get("events") or {}
        created_at = row.get("created_at") or datetime.now(timezone.utc).isoformat()
        favorites.append(
            {
                "event_id": row.get("event_id"),
                "created_at": created_at,
                "title": event.get("title") or row.get("title") or "Untitled Event",
                "start_time": event.get("start_time") or row.get("start_time") or created_at,
            }
        )

    return favorites


@router.post("/favorites", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
def add_user_favorite(
    payload: FavoriteCreate,
    auth: AuthContext = Depends(get_auth_context),
):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("favorites")
            .upsert(
                {
                    "user_id": auth.user_id,
                    "event_id": payload.event_id,
                }
            )
            .execute()
        ),
        "Failed to add favorite",
    )

    rows = response.data or []
    created_at = (
        rows[0].get("created_at")
        if rows and isinstance(rows[0], dict)
        else datetime.now(timezone.utc).isoformat()
    )
    return {
        "event_id": payload.event_id,
        "created_at": created_at,
        "title": "Untitled Event",
        "start_time": created_at,
    }


@router.delete("/favorites/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_favorite(event_id: str, auth: AuthContext = Depends(get_auth_context)):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    _execute_or_503(
        lambda: client.table("favorites").delete().eq("user_id", auth.user_id).eq("event_id", event_id).execute(),
        "Failed to remove favorite",
    )
    return None


@router.get("/follows", response_model=list[FollowRead])
def list_user_follows(auth: AuthContext = Depends(get_auth_context)):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("artist_follows")
            .select("artist_id,created_at,artists(stage_name)")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        ),
        "Failed to load follows",
    )

    rows = response.data or []
    follows: list[dict[str, Any]] = []
    for row in rows:
        artist = row.get("artists") or {}
        created_at = row.get("created_at") or datetime.now(timezone.utc).isoformat()
        follows.append(
            {
                "artist_id": row.get("artist_id"),
                "created_at": created_at,
                "stage_name": artist.get("stage_name") or row.get("stage_name") or "Unknown Artist",
            }
        )
    return follows


@router.post("/follows", response_model=FollowRead, status_code=status.HTTP_201_CREATED)
def create_user_follow(payload: FollowCreate, auth: AuthContext = Depends(get_auth_context)):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    response = _execute_or_503(
        lambda: (
            client.table("artist_follows")
            .upsert(
                {
                    "user_id": auth.user_id,
                    "artist_id": payload.artist_id,
                }
            )
            .execute()
        ),
        "Failed to follow artist",
    )

    rows = response.data or []
    created_at = (
        rows[0].get("created_at")
        if rows and isinstance(rows[0], dict)
        else datetime.now(timezone.utc).isoformat()
    )
    return {
        "artist_id": payload.artist_id,
        "created_at": created_at,
        "stage_name": "Unknown Artist",
    }


@router.delete("/follows/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_follow(artist_id: str, auth: AuthContext = Depends(get_auth_context)):
    if auth.role != "user" and auth.role != "admin":
        raise HTTPException(status_code=403, detail="Role 'user' required")

    client = _get_user_client_or_500(auth.access_token)
    _execute_or_503(
        lambda: client.table("artist_follows").delete().eq("user_id", auth.user_id).eq("artist_id", artist_id).execute(),
        "Failed to unfollow artist",
    )
    return None

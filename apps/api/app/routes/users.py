from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthContext, get_auth_context, require_role
from app.db.supabase import get_supabase_client_for_user
from app.models.schemas import (
    FavoriteCreate,
    FavoriteRead,
    FollowCreate,
    FollowRead,
    UserProfileRead,
    UserProfileUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserProfileRead)
def get_my_profile(auth: AuthContext = Depends(get_auth_context)):
    client = get_supabase_client_for_user(auth.access_token)
    try:
        response = (
            client.table("profiles")
            .select("id,role,display_name,home_zip,created_at,updated_at")
            .eq("id", auth.user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load user profile",
        )

    profile = response.data
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return profile


@router.patch("/me", response_model=UserProfileRead)
def update_my_profile(
    payload: UserProfileUpdate,
    auth: AuthContext = Depends(get_auth_context),
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    client = get_supabase_client_for_user(auth.access_token)
    try:
        response = (
            client.table("profiles")
            .update(updates)
            .eq("id", auth.user_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return rows[0]


# ---------------------------------------------------------------------------
# Favorites  (role: user)
# ---------------------------------------------------------------------------

@router.get("/favorites", response_model=list[FavoriteRead])
def list_favorites(auth: AuthContext = Depends(require_role("user"))):
    client = get_supabase_client_for_user(auth.access_token)
    try:
        response = (
            client.table("favorites")
            .select("event_id,created_at")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load favorites",
        )
    return response.data or []


@router.post("/favorites", status_code=status.HTTP_201_CREATED, response_model=FavoriteRead)
def add_favorite(
    payload: FavoriteCreate,
    auth: AuthContext = Depends(require_role("user")),
):
    client = get_supabase_client_for_user(auth.access_token)
    row = {"user_id": auth.user_id, "event_id": payload.event_id}
    try:
        response = client.table("favorites").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save favorite",
        )
    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Insert returned no data",
        )
    return rows[0]


@router.delete("/favorites/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    event_id: str,
    auth: AuthContext = Depends(require_role("user")),
):
    client = get_supabase_client_for_user(auth.access_token)
    try:
        client.table("favorites").delete().eq("user_id", auth.user_id).eq("event_id", event_id).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove favorite",
        )


# ---------------------------------------------------------------------------
# Follows  (role: user)
# ---------------------------------------------------------------------------

@router.get("/follows", response_model=list[FollowRead])
def list_follows(auth: AuthContext = Depends(require_role("user"))):
    client = get_supabase_client_for_user(auth.access_token)
    try:
        response = (
            client.table("artist_follows")
            .select("artist_id,created_at")
            .eq("user_id", auth.user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load follows",
        )
    return response.data or []


@router.post("/follows", status_code=status.HTTP_201_CREATED, response_model=FollowRead)
def follow_artist(
    payload: FollowCreate,
    auth: AuthContext = Depends(require_role("user")),
):
    client = get_supabase_client_for_user(auth.access_token)
    row = {"user_id": auth.user_id, "artist_id": payload.artist_id}
    try:
        response = client.table("artist_follows").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to follow artist",
        )
    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Insert returned no data",
        )
    return rows[0]


@router.delete("/follows/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_artist(
    artist_id: str,
    auth: AuthContext = Depends(require_role("user")),
):
    client = get_supabase_client_for_user(auth.access_token)
    try:
        client.table("artist_follows").delete().eq("user_id", auth.user_id).eq("artist_id", artist_id).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unfollow artist",
        )

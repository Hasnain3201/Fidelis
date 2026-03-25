from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthContext, get_auth_context
from app.db.supabase_admin import get_supabase_admin_client
from app.models.follow_schemas import FollowCreate, FollowRead, VenueFollowCreate, VenueFollowRead

router = APIRouter()


def _require_user_role(auth: AuthContext) -> None:
    if auth.role not in {"user", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role 'user' required")


@router.get("/", response_model=list[FollowRead])
async def list_follows(auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    response = (
        client
        .table("artist_follows")
        .select("artist_id,created_at,artists(stage_name)")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
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


@router.post("/", response_model=FollowRead, status_code=status.HTTP_201_CREATED)
async def create_follow(payload: FollowCreate, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    row = {
        "user_id": auth.user_id,
        "artist_id": payload.artist_id
    }

    existing = (
        client
        .table("artist_follows")
        .select("artist_id")
        .eq("user_id", auth.user_id)
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


@router.get("/venues", response_model=list[VenueFollowRead])
async def list_venue_follows(auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    response = (
        client
        .table("venue_follows")
        .select("venue_id,created_at,venues(name)")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
        .execute()
    )

    data = response.data or []

    follows = []

    for row in data:
        venue = row.get("venues") or {}
        follows.append(
            {
                "venue_id": row["venue_id"],
                "created_at": row["created_at"],
                "venue_name": venue.get("name") or "Unknown Venue",
            }
        )

    return follows


@router.post("/venues", response_model=VenueFollowRead, status_code=status.HTTP_201_CREATED)
async def create_venue_follow(payload: VenueFollowCreate, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    existing = (
        client
        .table("venue_follows")
        .select("venue_id")
        .eq("user_id", auth.user_id)
        .eq("venue_id", payload.venue_id)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already following venue.")

    response = (
        client
        .table("venue_follows")
        .insert(
            {
                "user_id": auth.user_id,
                "venue_id": payload.venue_id,
            }
        )
        .execute()
    )

    rows = response.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to follow venue.",
        )

    follow = rows[0]
    venue_res = (
        client
        .table("venues")
        .select("name")
        .eq("id", follow["venue_id"])
        .single()
        .execute()
    )
    venue = venue_res.data or {}

    return {
        "venue_id": follow["venue_id"],
        "created_at": follow["created_at"],
        "venue_name": venue.get("name") or "Unknown Venue",
    }


@router.delete("/venues/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_venue_follow(venue_id: str, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    client.table("venue_follows").delete().eq("user_id", auth.user_id).eq("venue_id", venue_id).execute()
    return None


@router.delete("/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_follow(artist_id: str, auth: AuthContext = Depends(get_auth_context)):
    _require_user_role(auth)
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin client not configured")

    client.table("artist_follows").delete().eq("user_id", auth.user_id).eq("artist_id", artist_id).execute()
    return None

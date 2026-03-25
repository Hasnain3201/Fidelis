from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, require_managed_artist, require_role

from app.db.supabase import get_supabase_client, get_supabase_client_for_user
from app.db.supabase_admin import get_supabase_admin_client

from app.models.artist_schemas import ArtistProfileCreate, ArtistProfileRead, ArtistProfileUpdate

router = APIRouter()

_ARTIST_COLS = "id,stage_name,genre,bio,media_url,created_at,updated_at"


def _get_supabase_client_or_503():
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Artist profile  (role: artist + approved claim)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[ArtistProfileRead])
def list_artists(
    query: Optional[str] = Query(default=None),
    genre: Optional[str] = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
):
    client = _get_supabase_client_or_503()
    q = client.table("artists").select(_ARTIST_COLS).order("stage_name").limit(limit)

    if query:
        q = q.ilike("stage_name", f"%{query.strip()}%")
    if genre:
        q = q.ilike("genre", f"%{genre.strip()}%")

    try:
        response = q.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load artists",
        )
    return response.data or []

@router.get("/mine", response_model=ArtistProfileRead)
def get_my_artist_profile(pair: tuple[AuthContext, str] = Depends(require_managed_artist)):
    auth, artist_id = pair
    try:
        client = get_supabase_client_for_user(auth.access_token)
        response = (
            client.table("artists")
            .select(_ARTIST_COLS)
            .eq("id", artist_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load artist profile",
        )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")
    return response.data


@router.post("/mine", status_code=status.HTTP_201_CREATED, response_model=ArtistProfileRead)
def create_artist_profile(
    payload: ArtistProfileCreate,
    auth: AuthContext = Depends(require_role("artist")),
):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    row = payload.model_dump()
    try:
        response = admin.table("artists").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create artist profile",
        )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")

    artist_id = rows[0]["id"]

    try:
        admin.table("artist_claims").insert({
            "artist_id": artist_id,
            "user_id": auth.user_id,
            "status": "approved",
        }).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Artist created but failed to create auto-approved claim",
        )

    return rows[0]


@router.patch("/mine", response_model=ArtistProfileRead)
def update_artist_profile(
    payload: ArtistProfileUpdate,
    pair: tuple[AuthContext, str] = Depends(require_managed_artist),
):
    auth, artist_id = pair
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    try:
        client = get_supabase_client_for_user(auth.access_token)
        response = client.table("artists").update(updates).eq("id", artist_id).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update artist profile",
        )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found after update")
    return rows[0]

@router.get("/{artist_id}/events")
async def get_artist_events(artist_id: UUID):
    client = _get_supabase_client_or_503()

    try:
        response = (
            client
            .table("event_artists")
            .select("events(id, title, start_time, category, zip_code, venues(name))")
            .eq("artist_id", artist_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load artist events",
        )
    
    data = response.data or []

    events = []

    for row in data:
        event = row.get("events") or {}
        venue = event.get("venues") or {}

        events.append({
            "id": event.get("id"),
            "title": event.get("title"),
            "start_time": event.get("start_time"),
            "venue_name": venue.get("name")
        })

    return events

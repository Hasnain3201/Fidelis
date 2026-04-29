from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import (
    AuthContext,
    get_managed_artist_ids,
    require_managed_artist,
    require_role,
    require_user_id,
)
from app.db.supabase import get_supabase_client, get_supabase_client_for_user
from app.db.supabase_admin import get_supabase_admin_client
from app.models.artist_schemas import (
    ArtistProfileCreate,
    ArtistProfileRead,
    ArtistProfileUpdate,
    ArtistSearchResponse,
)

router = APIRouter()

_ARTIST_COLS = "id,stage_name,genre,bio,media_url,cover_image_url,created_at,updated_at"
_ARTIST_COLS_LEGACY = "id,stage_name,genre,bio,media_url,created_at,updated_at"


def _is_missing_column_error(exc: Exception, column: str) -> bool:
    message = str(exc).lower()
    column_name = column.lower()
    return column_name in message and (
        "does not exist" in message
        or "unknown column" in message
        or "could not find the" in message
    )


def _is_missing_owner_id_column_error(exc: Exception) -> bool:
    return _is_missing_column_error(exc, "owner_id")


def _ensure_profile_row(admin, user_id: str, role: str) -> None:
    """Best-effort profile seed so FK checks can pass for claim inserts."""
    try:
        admin.table("profiles").upsert(
            {
                "id": user_id,
                "role": role,
                "display_name": "",
            },
            on_conflict="id",
        ).execute()
    except Exception:
        pass


def _persist_profile_artist_link(admin, user_id: str, artist_id: str) -> bool:
    """Persist fallback managed-artist linkage on profiles when available."""
    _ensure_profile_row(admin, user_id, "artist")

    try:
        admin.table("profiles").update(
            {"managed_artist_id": artist_id}
        ).eq("id", user_id).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, "managed_artist_id"):
            return False
        return False

    try:
        response = (
            admin.table("profiles")
            .select("managed_artist_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = response.data or {}
        if not isinstance(data, dict):
            return False
        return str(data.get("managed_artist_id", "")).strip() == artist_id
    except Exception:
        return False

def _get_supabase_client_or_503():
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


def _parse_uuid_or_404(value: str, detail: str = "Artist not found") -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _load_artist_by_id(admin, artist_id: str):
    for columns in (_ARTIST_COLS, _ARTIST_COLS_LEGACY):
        try:
            response = (
                admin.table("artists")
                .select(columns)
                .eq("id", artist_id)
                .single()
                .execute()
            )
        except Exception:
            continue

        row = response.data
        if not row:
            return None

        if isinstance(row, dict) and "cover_image_url" not in row:
            row = {**row, "cover_image_url": None}
        return row

    return None


def _get_existing_managed_artist(admin, user_id: str):
    for artist_id in get_managed_artist_ids(user_id):
        artist = _load_artist_by_id(admin, artist_id)
        if artist:
            return artist
    return None


def _is_artist_linked_to_user(admin, user_id: str, artist_id: str) -> bool:
    try:
        owner_response = (
            admin.table("artists")
            .select("id,owner_id")
            .eq("id", artist_id)
            .single()
            .execute()
        )
        owner_row = owner_response.data or {}
        if str(owner_row.get("owner_id", "")).strip() == user_id:
            return True
    except Exception:
        # owner_id may not exist in every migrated environment
        pass

    try:
        profile_response = (
            admin.table("profiles")
            .select("managed_artist_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile_row = profile_response.data or {}
        if str(profile_row.get("managed_artist_id", "")).strip() == artist_id:
            return True
    except Exception:
        pass

    try:
        claims_response = (
            admin.table("artist_claims")
            .select("id")
            .eq("artist_id", artist_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if claims_response.data:
            return True
    except Exception:
        pass

    return False


# ---------------------------------------------------------------------------
# Public discovery endpoints
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


@router.get("/search", response_model=ArtistSearchResponse)
def search_artists(
    query: Optional[str] = Query(default=None),
    genre: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    client = _get_supabase_client_or_503()
    offset = (page - 1) * limit

    q = client.table("artists").select(_ARTIST_COLS, count="exact").order("stage_name")

    if query and query.strip():
        q = q.ilike("stage_name", f"%{query.strip()}%")
    if genre and genre.strip():
        q = q.ilike("genre", f"%{genre.strip()}%")

    q = q.range(offset, offset + limit - 1)

    try:
        response = q.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to search artists",
        )

    rows = response.data or []
    total = response.count if isinstance(response.count, int) else len(rows)

    return ArtistSearchResponse(
        items=rows,
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/popular", response_model=list[ArtistProfileRead])
def get_popular_artists(limit: int = Query(20, ge=1, le=100)):
    client = _get_supabase_client_or_503()

    try:
        response = client.rpc("get_popular_artists", {"limit_count": limit}).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load popular artists",
        )

    return response.data or []


@router.get("/recommended", response_model=list[ArtistProfileRead])
def get_recommended_artists(
    user_id: str = Depends(require_user_id),
    limit: int = Query(20, ge=1, le=100),
):
    client = _get_supabase_client_or_503()

    try:
        response = client.rpc(
            "get_recommended_artists",
            {"for_user": user_id, "limit_count": limit},
        ).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load recommended artists",
        )

    return response.data or []


# ---------------------------------------------------------------------------
# Managed artist profile endpoints (role: artist)
# ---------------------------------------------------------------------------

@router.get("/mine", response_model=ArtistProfileRead)
def get_my_artist_profile(pair: tuple[AuthContext, str] = Depends(require_managed_artist)):
    _, artist_id = pair
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")
    row = _load_artist_by_id(admin, artist_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Managed artist profile not found")
    return row


@router.post("/mine", status_code=status.HTTP_201_CREATED, response_model=ArtistProfileRead)
def create_artist_profile(
    payload: ArtistProfileCreate,
    auth: AuthContext = Depends(require_role("artist")),
):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    # Idempotency: one managed artist profile per artist account.
    existing_profile = _get_existing_managed_artist(admin, auth.user_id)
    if existing_profile:
        return existing_profile

    # Ensure profile row exists so claim FK checks can pass in all environments.
    _ensure_profile_row(admin, auth.user_id, "artist")

    row = payload.model_dump(exclude_none=True)
    row["owner_id"] = auth.user_id
    inserted_with_owner_link = False
    try:
        response = admin.table("artists").insert(row).execute()
        inserted_with_owner_link = True
    except Exception as exc:
        if not _is_missing_owner_id_column_error(exc):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create artist profile",
            )
        # Fallback for environments where artists.owner_id was removed.
        fallback_row = payload.model_dump(exclude_none=True)
        try:
            response = admin.table("artists").insert(fallback_row).execute()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create artist profile",
            )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")

    artist_id = rows[0]["id"]
    inserted_row = rows[0]
    if isinstance(inserted_row, dict) and "cover_image_url" not in inserted_row:
        inserted_row = {**inserted_row, "cover_image_url": None}

    # Artist approval is no longer required for dashboard access.
    # We still create a claim row when possible for compatibility with existing
    # ownership links and admin tooling.
    claim_link_created = False
    try:
        admin.table("artist_claims").insert({
            "id": str(uuid4()),
            "artist_id": artist_id,
            "user_id": auth.user_id,
            "status": "approved",
        }).execute()
        claim_link_created = True
    except Exception:
        # Fallback to a regular user-scoped pending claim if approved insert is
        # unavailable due environment-specific DB policies.
        try:
            user_client = get_supabase_client_for_user(auth.access_token)
            user_client.table("artist_claims").insert({
                "id": str(uuid4()),
                "artist_id": artist_id,
                "user_id": auth.user_id,
                "status": "pending",
            }).execute()
            claim_link_created = True
        except Exception:
            pass

    profile_link_created = _persist_profile_artist_link(admin, auth.user_id, artist_id)

    # Ensure the created row is actually managed by this account before
    # returning success.
    managed_profile = _get_existing_managed_artist(admin, auth.user_id)
    if managed_profile:
        return managed_profile

    # Fallback: resolve linkage directly against the newly inserted profile.
    # This avoids false negatives when managed-ID listing is temporarily stale.
    if _is_artist_linked_to_user(admin, auth.user_id, artist_id):
        reloaded = _load_artist_by_id(admin, artist_id)
        if reloaded:
            return reloaded
        if isinstance(inserted_row, dict):
            return inserted_row

    # Pragmatic fallback: if we successfully established any linkage mechanism,
    # avoid false 500 responses when immediate read-back checks are unavailable
    # in this environment.
    if inserted_with_owner_link or claim_link_created or profile_link_created:
        reloaded = _load_artist_by_id(admin, artist_id)
        if reloaded:
            return reloaded
        if isinstance(inserted_row, dict):
            return inserted_row

    # Best-effort cleanup to avoid orphaned duplicates when linkage failed.
    try:
        admin.table("artists").delete().eq("id", artist_id).execute()
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Managed artist profile could not be linked to this account. Please try again.",
    )


@router.patch("/mine", response_model=ArtistProfileRead)
def update_artist_profile(
    payload: ArtistProfileUpdate,
    pair: tuple[AuthContext, str] = Depends(require_managed_artist),
):
    _, artist_id = pair
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    try:
        response = (
            admin.table("artists")
            .update(updates)
            .eq("id", artist_id)
            .select(_ARTIST_COLS)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update artist profile",
        )

    row = response.data
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found after update")
    return row

@router.get("/{artist_id}", response_model=ArtistProfileRead)
def get_artist_detail(artist_id: str):
    parsed_artist_id = _parse_uuid_or_404(artist_id)
    client = _get_supabase_client_or_503()
 
    try:
        response = (
            client.table("artists")
            .select(_ARTIST_COLS)
            .eq("id", str(parsed_artist_id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load artist profile",
        )
 
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")
 
    return response.data


@router.get("/{artist_id}/events")
async def get_artist_events(artist_id: str):
    parsed_artist_id = _parse_uuid_or_404(artist_id)
    client = _get_supabase_client_or_503()

    try:
        response = (
            client
            .table("event_artists")
            .select("events(id, title, start_time, category, zip_code, venues(name))")
            .eq("artist_id", str(parsed_artist_id))
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
            "venue_name": venue.get("name"),
        })

    return events

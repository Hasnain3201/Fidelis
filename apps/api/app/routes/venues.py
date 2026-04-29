from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import (
    AuthContext,
    get_managed_venue_ids,
    require_managed_venue,
    require_role,
    require_user_id,
)
from app.db.supabase import get_supabase_client, get_supabase_client_for_user
from app.db.supabase_admin import get_supabase_admin_client

from app.models.event_schemas import EventCreate, EventCreated, EventSummary
from app.models.venue_schemas import (
    VenueProfileCreate,
    VenueProfileRead,
    VenueProfileUpdate,
    VenueSearchResponse,
)

router = APIRouter()

_VENUE_COLS = "id,name,description,address_line,city,state,zip_code,verified,cover_image_url,created_at,updated_at"
_VENUE_COLS_LEGACY = "id,name,description,address_line,city,state,zip_code,verified,created_at,updated_at"


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


def _persist_profile_venue_link(admin, user_id: str, venue_id: str) -> bool:
    """Persist fallback managed-venue linkage on profiles when available."""
    _ensure_profile_row(admin, user_id, "venue")

    try:
        admin.table("profiles").update(
            {"managed_venue_id": venue_id}
        ).eq("id", user_id).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, "managed_venue_id"):
            return False
        return False

    try:
        response = (
            admin.table("profiles")
            .select("managed_venue_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = response.data or {}
        if not isinstance(data, dict):
            return False
        return str(data.get("managed_venue_id", "")).strip() == venue_id
    except Exception:
        return False

def _get_supabase_client_or_503():
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


def _parse_uuid_or_404(value: str, detail: str = "Venue not found") -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _load_venue_by_id(admin, venue_id: str):
    for columns in (_VENUE_COLS, _VENUE_COLS_LEGACY):
        try:
            response = (
                admin.table("venues")
                .select(columns)
                .eq("id", venue_id)
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


def _get_existing_managed_venue(admin, user_id: str):
    for venue_id in get_managed_venue_ids(user_id):
        venue = _load_venue_by_id(admin, venue_id)
        if venue:
            return venue
    return None


def _is_venue_linked_to_user(admin, user_id: str, venue_id: str) -> bool:
    try:
        owner_response = (
            admin.table("venues")
            .select("id,owner_id")
            .eq("id", venue_id)
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
            .select("managed_venue_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile_row = profile_response.data or {}
        if str(profile_row.get("managed_venue_id", "")).strip() == venue_id:
            return True
    except Exception:
        pass

    try:
        claims_response = (
            admin.table("venue_claims")
            .select("id")
            .eq("venue_id", venue_id)
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
# Venue profile (role: venue)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[VenueProfileRead])
def list_venues(
    zip_code: Optional[str] = Query(default=None, pattern=r"^\d{5}$"),
    city: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    query: Optional[str] = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
):
    client = _get_supabase_client_or_503()
    q = client.table("venues").select(_VENUE_COLS).order("name").limit(limit)

    if zip_code:
        q = q.eq("zip_code", zip_code)
    if city:
        q = q.ilike("city", f"%{city.strip()}%")
    if state:
        q = q.ilike("state", f"%{state.strip()}%")
    if query:
        q = q.ilike("name", f"%{query.strip()}%")

    try:
        response = q.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load venues",
        )
    return response.data or []


@router.get("/search", response_model=VenueSearchResponse)
def search_venues(
    query: Optional[str] = Query(default=None),
    zip_code: Optional[str] = Query(default=None, pattern=r"^\d{5}$"),
    city: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None, min_length=2, max_length=2),
    verified: Optional[bool] = Query(default=None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    client = _get_supabase_client_or_503()
    offset = (page - 1) * limit

    q = client.table("venues").select(_VENUE_COLS, count="exact")

    if query and query.strip():
        q = q.ilike("name", f"%{query.strip()}%")
    if zip_code:
        q = q.eq("zip_code", zip_code)
    if city and city.strip():
        q = q.ilike("city", f"%{city.strip()}%")
    if state and state.strip():
        q = q.eq("state", state.strip().upper())

    # Backward compatibility: keep accepting `verified` query param, but no-op.
    _ = verified

    q = q.order("name").range(offset, offset + limit - 1)

    try:
        response = q.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to search venues",
        )

    rows = response.data or []
    total = response.count if isinstance(response.count, int) else len(rows)

    return VenueSearchResponse(
        items=rows,
        page=page,
        limit=limit,
        total=total,
    )

@router.get("/popular", response_model=list[VenueProfileRead])
def get_popular_venues(limit: int = Query(20, ge=1, le=100)):
    client = _get_supabase_client_or_503()
    try:
        response = client.rpc("get_popular_venues", {"limit_count": limit}).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load popular venues",
        )
    return response.data or []


@router.get("/recommended", response_model=list[VenueProfileRead])
def get_recommended_venues(
    user_id: str = Depends(require_user_id),
    limit: int = Query(20, ge=1, le=100),
):
    client = _get_supabase_client_or_503()
    try:
        response = client.rpc(
            "get_recommended_venues",
            {"for_user": user_id, "limit_count": limit},
        ).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load recommended venues",
        )
    return response.data or []


@router.get("/mine", response_model=VenueProfileRead)
def get_my_venue(pair: tuple[AuthContext, str] = Depends(require_managed_venue)):
    _, venue_id = pair
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")
    row = _load_venue_by_id(admin, venue_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Managed venue profile not found")
    return row


@router.get("/mine/events", response_model=list[EventSummary])
def get_my_venue_events(
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
    limit: int = Query(default=50, ge=1, le=200),
):
    _, venue_id = pair
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    try:
        response = (
            admin.table("events")
            .select("id,title,start_time,category,zip_code,price,venues(name)")
            .eq("venue_id", venue_id)
            .order("start_time")
            .limit(limit)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load venue events",
        )

    rows = response.data or []
    return [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
            price=row.get("price"),
        )
        for row in rows
    ]


@router.post("/mine", status_code=status.HTTP_201_CREATED, response_model=VenueProfileRead)
def create_venue(
    payload: VenueProfileCreate,
    auth: AuthContext = Depends(require_role("venue")),
):
    admin = get_supabase_admin_client()
    if admin is None:
        raise HTTPException(status_code=500, detail="Admin client not configured")

    # Idempotency: one managed venue profile per venue account.
    existing_profile = _get_existing_managed_venue(admin, auth.user_id)
    if existing_profile:
        return existing_profile

    # Ensure profile row exists so claim FK checks can pass in all environments.
    _ensure_profile_row(admin, auth.user_id, "venue")

    row = payload.model_dump(exclude_none=True)
    row["owner_id"] = auth.user_id
    inserted_with_owner_link = False
    try:
        response = admin.table("venues").insert(row).execute()
        inserted_with_owner_link = True
    except Exception as exc:
        if not _is_missing_owner_id_column_error(exc):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create venue",
            )
        # Fallback for environments where venues.owner_id was removed.
        fallback_row = payload.model_dump(exclude_none=True)
        try:
            response = admin.table("venues").insert(fallback_row).execute()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create venue",
            )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")

    venue_id = rows[0]["id"]
    inserted_row = rows[0]
    if isinstance(inserted_row, dict) and "cover_image_url" not in inserted_row:
        inserted_row = {**inserted_row, "cover_image_url": None}

    # Venue approval is no longer required for dashboard access.
    # We still create a claim row when possible for compatibility with existing
    # ownership links and admin tooling.
    claim_link_created = False
    try:
        admin.table("venue_claims").insert({
            "id": str(uuid4()),
            "venue_id": venue_id,
            "user_id": auth.user_id,
            "status": "approved",
        }).execute()
        claim_link_created = True
    except Exception:
        # Fallback to a regular user-scoped pending claim if approved insert is
        # unavailable due environment-specific DB policies.
        try:
            user_client = get_supabase_client_for_user(auth.access_token)
            user_client.table("venue_claims").insert({
                "id": str(uuid4()),
                "venue_id": venue_id,
                "user_id": auth.user_id,
                "status": "pending",
            }).execute()
            claim_link_created = True
        except Exception:
            pass

    profile_link_created = _persist_profile_venue_link(admin, auth.user_id, venue_id)

    # Ensure the created row is actually managed by this account before
    # returning success.
    managed_profile = _get_existing_managed_venue(admin, auth.user_id)
    if managed_profile:
        return managed_profile

    # Fallback: resolve linkage directly against the newly inserted profile.
    # This avoids false negatives when managed-ID listing is temporarily stale.
    if _is_venue_linked_to_user(admin, auth.user_id, venue_id):
        reloaded = _load_venue_by_id(admin, venue_id)
        if reloaded:
            return reloaded
        if isinstance(inserted_row, dict):
            return inserted_row

    # Pragmatic fallback: if we successfully established any linkage mechanism,
    # avoid false 500 responses when immediate read-back checks are unavailable
    # in this environment.
    if inserted_with_owner_link or claim_link_created or profile_link_created:
        reloaded = _load_venue_by_id(admin, venue_id)
        if reloaded:
            return reloaded
        if isinstance(inserted_row, dict):
            return inserted_row

    # Best-effort cleanup to avoid orphaned duplicates when linkage failed.
    try:
        admin.table("venues").delete().eq("id", venue_id).execute()
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Managed venue profile could not be linked to this account. Please try again.",
    )


@router.patch("/mine", response_model=VenueProfileRead)
def update_venue(
    payload: VenueProfileUpdate,
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
):
    _, venue_id = pair
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
            admin.table("venues")
            .update(updates)
            .eq("id", venue_id)
            .select(_VENUE_COLS)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update venue",
        )

    row = response.data
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found after update")
    return row


@router.get("/{venue_id}", response_model=VenueProfileRead)
def get_venue_detail(venue_id: str):
    parsed_venue_id = _parse_uuid_or_404(venue_id)
    client = _get_supabase_client_or_503()

    try:
        response = (
            client.table("venues")
            .select(_VENUE_COLS)
            .eq("id", str(parsed_venue_id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load venue",
        )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")

    return response.data


@router.get("/{venue_id}/events", response_model=list[EventSummary])
def get_venue_events(
    venue_id: str,
    limit: int = Query(default=50, ge=1, le=200),
):
    parsed_venue_id = _parse_uuid_or_404(venue_id)
    client = _get_supabase_client_or_503()

    try:
        now_utc = datetime.now(timezone.utc).isoformat()
        response = (
            client.table("events")
            .select("id,title,start_time,category,zip_code,is_promoted,price,venues(name)")
            .eq("venue_id", str(parsed_venue_id))
            .gte("start_time", now_utc)
            .order("start_time")
            .limit(limit)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load venue events",
        )

    rows = response.data or []
    return [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
            is_promoted=bool(row.get("is_promoted", False)),
            price=row.get("price"),
        )
        for row in rows
    ]

# ---------------------------------------------------------------------------
# Event creation (role: venue)
# ---------------------------------------------------------------------------

@router.post("/events", response_model=EventCreated)
def create_venue_event(
    payload: EventCreate,
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
):
    auth, venue_id = pair
    try:
        client = get_supabase_client_for_user(auth.access_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize venue event creation",
        )

    event_payload = {
        "venue_id": venue_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "start_time": payload.start_time.isoformat(),
        "end_time": payload.end_time.isoformat(),
        "zip_code": payload.zip_code,
        "ticket_url": payload.ticket_url,
        "cover_image_url": payload.cover_image_url,
        "price": payload.price,
        "age_requirement": payload.age_requirement,
        "capacity": payload.capacity,
    }

    try:
        insert_response = (
            client.table("events")
            .insert(event_payload)
            .select("id")
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event",
        )

    row = insert_response.data or {}
    event_id = row.get("id")
    if not event_id:
        raise HTTPException(status_code=500, detail="Event created without id")

    return EventCreated(id=str(event_id), status="created")

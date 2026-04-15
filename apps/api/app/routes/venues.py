from datetime import datetime, timezone
from typing import Optional

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, require_managed_venue, require_role, require_user_id
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

def _get_supabase_client_or_503():
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Venue profile  (role: venue + approved claim)
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
    if verified is not None:
        q = q.eq("verified", verified)

    q = q.order("verified", desc=True).order("name").range(offset, offset + limit - 1)

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
    auth, venue_id = pair
    try:
        client = get_supabase_client_for_user(auth.access_token)
        response = (
            client.table("venues")
            .select(_VENUE_COLS)
            .eq("id", venue_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load venue profile",
        )

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
    return response.data


@router.get("/mine/events", response_model=list[EventSummary])
def get_my_venue_events(
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
    limit: int = Query(default=50, ge=1, le=200),
):
    auth, venue_id = pair
    try:
        client = get_supabase_client_for_user(auth.access_token)
        now_utc = datetime.now(timezone.utc).isoformat()
        response = (
            client.table("events")
            .select("id,title,start_time,category,zip_code,venues(name)")
            .eq("venue_id", venue_id)
            .gte("start_time", now_utc)
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

    row = payload.model_dump()
    try:
        response = admin.table("venues").insert(row).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create venue",
        )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Insert returned no data")

    venue_id = rows[0]["id"]

    try:
        admin.table("venue_claims").insert({
            "venue_id": venue_id,
            "user_id": auth.user_id,
            "status": "approved",
        }).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue created but failed to create auto-approved claim",
        )

    return rows[0]


@router.patch("/mine", response_model=VenueProfileRead)
def update_venue(
    payload: VenueProfileUpdate,
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
):
    auth, venue_id = pair
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    try:
        client = get_supabase_client_for_user(auth.access_token)
        response = client.table("venues").update(updates).eq("id", venue_id).execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update venue",
        )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found after update")
    return rows[0]


@router.get("/{venue_id}", response_model=VenueProfileRead)
def get_venue_detail(venue_id: UUID):
    client = _get_supabase_client_or_503()

    try:
        response = (
            client.table("venues")
            .select(_VENUE_COLS)
            .eq("id", str(venue_id))
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
    venue_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
):
    client = _get_supabase_client_or_503()

    try:
        now_utc = datetime.now(timezone.utc).isoformat()
        response = (
            client.table("events")
            .select("id,title,start_time,category,zip_code,is_promoted,venues(name)")
            .eq("venue_id", str(venue_id))
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
        )
        for row in rows
    ]

# ---------------------------------------------------------------------------
# Event creation  (role: venue + approved claim)
# ---------------------------------------------------------------------------

@router.post("/events", response_model=EventCreated)
def create_venue_event(
    payload: EventCreate,
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
):
    auth, venue_id = pair
    try:
        client = get_supabase_client_for_user(auth.access_token)
        venue_response = (
            client.table("venues")
            .select("verified")
            .eq("id", venue_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify venue access",
        )

    venue_row = venue_response.data or {}
    if not venue_row.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only verified venues can publish events",
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
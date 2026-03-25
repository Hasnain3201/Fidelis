from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthContext, require_managed_venue, require_role
from app.db.supabase import get_supabase_client_for_user
from app.db.supabase_admin import get_supabase_admin_client

from app.models.event_schemas import EventCreate, EventCreated
from app.models.venue_schemas import VenueProfileCreate, VenueProfileRead, VenueProfileUpdate

router = APIRouter()

_VENUE_COLS = "id,name,description,address_line,city,state,zip_code,verified,created_at,updated_at"


# ---------------------------------------------------------------------------
# Venue profile  (role: venue + approved claim)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Event creation  (role: venue + approved claim)
# ---------------------------------------------------------------------------

@router.post("/events", response_model=EventCreated)
def create_venue_event(
    payload: EventCreate,
    pair: tuple[AuthContext, str] = Depends(require_managed_venue),
):
    auth, venue_id = pair
    event_payload = {
        "venue_id": venue_id,
        "created_by": auth.user_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "start_time": payload.start_time.isoformat(),
        "end_time": payload.end_time.isoformat(),
        "zip_code": payload.zip_code,
        "ticket_url": payload.ticket_url,
    }

    try:
        client = get_supabase_client_for_user(auth.access_token)
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

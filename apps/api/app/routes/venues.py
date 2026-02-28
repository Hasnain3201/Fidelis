from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase import get_supabase_client
from app.core.auth import require_role, require_user_id
from app.models.schemas import EventCreate, EventCreated

router = APIRouter()
@router.get("/mine")
def get_my_venue(user_id: str = Depends(require_user_id), _: str = Depends(require_role("venue"))) -> dict:
    client = get_supabase_client()

    if client is None:
        return {
            "owner_user_id": user_id,
            "verification_status": "pending",
            "message": "Venue profile scaffolded. Connect to Supabase table 'venues'.",
        }

    try:
        response = (
            client.table("venues")
            .select("id,name,description,address_line,city,state,zip_code,verified,created_at,updated_at")
            .eq("owner_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load venue profile")

    rows = response.data or []
    if not rows:
        return {
            "owner_user_id": user_id,
            "has_venue": False,
            "message": "No venue found for this user. Create a venue in Supabase to see it here.",
        }

    venue = rows[0]
    return {
        "owner_user_id": user_id,
        "has_venue": True,
        "venue": venue,
    }


@router.post("/events", response_model=EventCreated)
def create_venue_event(
    payload: EventCreate,
    user_id: str = Depends(require_user_id),
    _: str = Depends(require_role("venue")),
) -> EventCreated:
    client = get_supabase_client()

    if client is None:
        # Preserve existing behavior if Supabase is not configured yet.
        return EventCreated(
            id=f"fallback-{int(datetime.now(timezone.utc).timestamp())}",
            status="created",
        )

    try:
        venue_response = (
            client.table("venues")
            .select("id")
            .eq("owner_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to resolve venue")

    venues = venue_response.data or []
    if not venues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No venue found for this user. Create a venue record before publishing events.",
        )

    venue_id = venues[0]["id"]

    event_payload = {
        "venue_id": venue_id,
        "created_by": user_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "start_time": payload.start_time.isoformat(),
        "end_time": payload.end_time.isoformat(),
        "zip_code": payload.zip_code,
        "ticket_url": payload.ticket_url,
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create event")

    row = insert_response.data or {}
    event_id = row.get("id")
    if not event_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Event created without id")

    return EventCreated(id=str(event_id), status="created")

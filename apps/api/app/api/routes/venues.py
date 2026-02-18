from datetime import timezone, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.core.auth import require_role, require_user_id
from app.models.schemas import EventCreate, EventCreated

router = APIRouter()


@router.get("/mine")
def get_my_venue(user_id: str = Depends(require_user_id), _: str = Depends(require_role("venue"))) -> dict:
    return {
        "owner_user_id": user_id,
        "verification_status": "pending",
        "message": "Venue profile scaffolded. Connect to Supabase table 'venues'.",
    }


@router.post("/events", response_model=EventCreated)
def create_venue_event(
    payload: EventCreate,
    user_id: str = Depends(require_user_id),
    _: str = Depends(require_role("venue")),
) -> EventCreated:
    _ = payload
    _ = user_id
    return EventCreated(id=f"evt_{uuid4().hex[:10]}", status="created")

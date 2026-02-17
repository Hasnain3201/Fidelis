from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from app.db.supabase import get_supabase_client
from app.models.schemas import EventSummary

router = APIRouter()

_SAMPLE_EVENTS = [
    {
        "id": "evt_100",
        "title": "Live Jazz Night",
        "venue_name": "Harbor House",
        "start_time": "2026-03-01T20:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_101",
        "title": "Stand-Up Open Mic",
        "venue_name": "Brick Room",
        "start_time": "2026-03-03T00:00:00+00:00",
        "category": "comedy",
        "zip_code": "10001",
    },
    {
        "id": "evt_102",
        "title": "Downtown Art Walk",
        "venue_name": "Metro Arts Co-op",
        "start_time": "2026-03-06T22:00:00+00:00",
        "category": "arts",
        "zip_code": "07030",
    },
]


@router.get("/search", response_model=list[EventSummary])
def search_events(
    zip_code: str = Query(..., pattern=r"^\d{5}$"),
    genre: Optional[str] = Query(default=None),
) -> list[EventSummary]:
    client = get_supabase_client()
    if client is not None:
        try:
            query = (
                client.table("events")
                .select("id,title,start_time,category,zip_code,venues(name)")
                .eq("zip_code", zip_code)
                .gte("start_time", datetime.now(timezone.utc).isoformat())
                .order("start_time")
                .limit(50)
            )
            if genre and genre != "all":
                query = query.eq("category", genre)

            response = query.execute()
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
        except Exception:
            # Fallback to sample data so local setup remains usable before Supabase wiring.
            pass

    results = [event for event in _SAMPLE_EVENTS if event["zip_code"] == zip_code]
    if genre and genre != "all":
        results = [event for event in results if event["category"] == genre]

    return [EventSummary(**event) for event in results]

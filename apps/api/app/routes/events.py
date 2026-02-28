from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.db.supabase import get_supabase_client
from app.models.schemas import EventSummary, EventSearchResponse, EventDetail

router = APIRouter()

_SAMPLE_EVENTS = [
    # PAST EVENT (should be excluded by default upcoming filter)
    {
        "id": "evt_090",
        "title": "Past Indie Show",
        "venue_name": "Old Town Hall",
        "start_time": "2025-01-01T20:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },

    # NEAR FUTURE
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
        "zip_code": "10001",
    },
    {
        "id": "evt_103",
        "title": "Indie Rock Showcase",
        "venue_name": "The Underground",
        "start_time": "2026-03-07T19:30:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_104",
        "title": "Latin Dance Social",
        "venue_name": "Pulse Studio",
        "start_time": "2026-03-08T21:00:00+00:00",
        "category": "dance",
        "zip_code": "10001",
    },
    {
        "id": "evt_105",
        "title": "Poetry Slam Night",
        "venue_name": "Verse Cafe",
        "start_time": "2026-03-10T20:00:00+00:00",
        "category": "arts",
        "zip_code": "10001",
    },
    {
        "id": "evt_106",
        "title": "Techno Warehouse Party",
        "venue_name": "Factory 47",
        "start_time": "2026-03-12T23:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_107",
        "title": "Acoustic Songwriter Night",
        "venue_name": "Harbor House",
        "start_time": "2026-03-14T19:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_108",
        "title": "Improv Comedy Jam",
        "venue_name": "Brick Room",
        "start_time": "2026-03-16T20:30:00+00:00",
        "category": "comedy",
        "zip_code": "10001",
    },
    {
        "id": "evt_109",
        "title": "Rooftop DJ Set",
        "venue_name": "Skyline Terrace",
        "start_time": "2026-03-18T22:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },

    {
        "id": "evt_111",
        "title": "Spring Beer Festival",
        "venue_name": "Central Plaza",
        "start_time": "2026-04-02T18:00:00+00:00",
        "category": "festival",
        "zip_code": "10001",
    },
    {
        "id": "evt_112",
        "title": "Blues & BBQ Night",
        "venue_name": "Harbor House",
        "start_time": "2026-04-05T19:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_113",
        "title": "Artisan Makers Market",
        "venue_name": "Metro Arts Co-op",
        "start_time": "2026-04-08T17:00:00+00:00",
        "category": "arts",
        "zip_code": "10001",
    },
    {
        "id": "evt_114",
        "title": "Hip-Hop Showcase",
        "venue_name": "The Underground",
        "start_time": "2026-04-10T21:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_115",
        "title": "Salsa Live Band",
        "venue_name": "Pulse Studio",
        "start_time": "2026-04-12T20:00:00+00:00",
        "category": "dance",
        "zip_code": "10001",
    },
    {
        "id": "evt_116",
        "title": "Trivia & Karaoke Night",
        "venue_name": "Verse Cafe",
        "start_time": "2026-04-15T19:30:00+00:00",
        "category": "comedy",
        "zip_code": "10001",
    },
    {
        "id": "evt_117",
        "title": "EDM Glow Party",
        "venue_name": "Factory 47",
        "start_time": "2026-04-18T23:30:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_118",
        "title": "Folk Music Brunch",
        "venue_name": "Harbor House",
        "start_time": "2026-04-20T16:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },

    # FAR FUTURE
    {
        "id": "evt_119",
        "title": "City Summer Kickoff",
        "venue_name": "Central Plaza",
        "start_time": "2026-06-01T18:00:00+00:00",
        "category": "festival",
        "zip_code": "10001",
    },
    {
        "id": "evt_110",
        "title": "Summer Rooftop Festival",
        "venue_name": "Skyline Terrace",
        "start_time": "2026-07-15T18:00:00+00:00",
        "category": "festival",
        "zip_code": "10001",
    },
    {
        "id": "evt_121",
        "title": "Late Summer Jazz Gala",
        "venue_name": "Harbor House",
        "start_time": "2026-08-10T20:00:00+00:00",
        "category": "live-music",
        "zip_code": "10001",
    },
    {
        "id": "evt_122",
        "title": "Outdoor Film Night",
        "venue_name": "Central Plaza",
        "start_time": "2026-08-20T20:30:00+00:00",
        "category": "arts",
        "zip_code": "10001",
    },
    {
        "id": "evt_123",
        "title": "Fall Comedy Festival",
        "venue_name": "Brick Room",
        "start_time": "2026-09-05T19:00:00+00:00",
        "category": "comedy",
        "zip_code": "10001",
    },
    {
    "id": "evt_124",
    "title": "Indie Film Premiere Night",
    "venue_name": "Metro Arts Co-op",
    "start_time": "2026-09-15T20:00:00+00:00",
    "category": "arts",
    "zip_code": "10001",
    },
]

@router.get("/search", response_model=EventSearchResponse)
def search_events(
    zip_code: str = Query(..., pattern=r"^\d{5}$"),
    genre: Optional[str] = Query(default=None),
    start_after: Optional[datetime] = Query(default=None),
    start_before: Optional[datetime] = Query(default=None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
) -> EventSearchResponse:
    offset = (page - 1) * limit

    client = get_supabase_client()
    if client is not None:
        try:

            query = (
                client.table("events")
                .select("id,title,start_time,category,zip_code,venues(name)", count="exact")
                .eq("zip_code", zip_code)
                .gte("start_time", datetime.now(timezone.utc).isoformat())
                .order("start_time")
            )

            if start_after:
                query = query.gte("start_time", start_after.isoformat())

            if start_before:
                query = query.lte("start_time", start_before.isoformat())

            if genre and genre != "all":
                query = query.eq("category", genre)

            query = query.range(offset, offset + limit - 1)

            response = query.execute()
            rows = response.data or []
            items = [
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
            
            return EventSearchResponse(
                items= items,
                page= page,
                limit= limit,
                total= response.count or 0,
            )
        except Exception:
            # Fallback to sample data so local setup remains usable before Supabase wiring.
            pass


    results = [event for event in _SAMPLE_EVENTS if event["zip_code"] == zip_code]

    current_datetime_iso = datetime.now(timezone.utc).isoformat()

    results = [event for event in results if event["start_time"] >= current_datetime_iso]
    if start_after:
        results = [e for e in results if e["start_time"] >= start_after.isoformat()]

    if start_before:
        results = [e for e in results if e["start_time"] <= start_before.isoformat()]

    if genre and genre != "all":
        results = [event for event in results if event["category"] == genre]

    total = len(results)

    paged = results[offset : offset + limit]
    items = [EventSummary(**event) for event in paged]

    return EventSearchResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
    )

@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str) -> EventDetail:
    client = get_supabase_client()
    if client is not None:
        try:
            response = (
                client.table("events")
                .select("id,title,description,start_time,end_time,category,zip_code,ticket_url,venues(name)")
                .eq("id", event_id)
                .single()
                .execute()
            )

            row = response.data

            if not row:
                raise HTTPException(status_code=404, detail="Event not found")
            
            return EventDetail(
                id=row["id"],
                title=row["title"],
                description=row.get("description", ""),
                venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
                start_time=row["start_time"],
                end_time=row["end_time"],
                category=row["category"],
                zip_code=row["zip_code"],
                ticket_url=row.get("ticket_url"),
            )

        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=404, detail="Event not found")
        
    for event in _SAMPLE_EVENTS:
        if event["id"] == event_id:
            return EventDetail(
                id=event["id"],
                title=event["title"],
                description="",
                venue_name=event["venue_name"],
                start_time=event["start_time"],
                end_time=event["start_time"],  # placeholder
                category=event["category"],
                zip_code=event["zip_code"],
                ticket_url=None,
            )
        
    raise HTTPException(status_code=404, detail="Event not found")

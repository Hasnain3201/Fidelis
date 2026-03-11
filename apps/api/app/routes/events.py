from datetime import datetime, timezone
from typing import Any, Optional

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

_SEARCH_SORT_OPTIONS = {"recommended", "dateSoonest", "dateLatest"}


def _get_optional_supabase_client():
    """Return a Supabase client when configured; otherwise allow sample fallback."""
    try:
        return get_supabase_client()
    except Exception:
        return None


def _normalize_text(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _parse_type_filters(raw_types: Optional[str]) -> list[str]:
    if not raw_types:
        return []
    return [token.strip().lower() for token in raw_types.split(",") if token.strip()]


def _to_utc_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        normalized = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _map_row_to_event_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row.get("description", "") or "",
        "venue_name": row.get("venue_name")
        or (row.get("venues") or {}).get("name", "Unknown Venue"),
        "start_time": row["start_time"],
        "category": row["category"],
        "zip_code": row["zip_code"],
    }


def _matches_search_filters(
    row: dict[str, Any],
    query_text: str,
    venue_text: str,
    type_filters: list[str],
) -> bool:
    title = _normalize_text(row.get("title"))
    description = _normalize_text(row.get("description"))
    category = _normalize_text(row.get("category"))
    venue_name = _normalize_text(row.get("venue_name"))
    searchable = " ".join([title, description, category, venue_name]).strip()

    if query_text and query_text not in searchable:
        return False

    if venue_text and venue_text not in venue_name:
        return False

    if type_filters and not any(token in searchable for token in type_filters):
        return False

    return True


def _sort_search_results(rows: list[dict[str, Any]], sort: str) -> list[dict[str, Any]]:
    reverse = sort == "dateLatest"
    return sorted(rows, key=lambda row: _to_utc_datetime(row["start_time"]), reverse=reverse)


@router.get("/search", response_model=EventSearchResponse)
def search_events(
    zip_code: str = Query(..., pattern=r"^\d{5}$"),
    query: Optional[str] = Query(default=None, max_length=120),
    venue: Optional[str] = Query(default=None, max_length=120),
    genre: Optional[str] = Query(default=None),
    types: Optional[str] = Query(default=None, max_length=200),
    sort: str = Query(default="recommended"),
    start_after: Optional[datetime] = Query(default=None),
    start_before: Optional[datetime] = Query(default=None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> EventSearchResponse:
    if sort not in _SEARCH_SORT_OPTIONS:
        raise HTTPException(status_code=422, detail="sort must be one of recommended, dateSoonest, dateLatest")

    offset = (page - 1) * limit
    now_utc = datetime.now(timezone.utc)
    normalized_query = _normalize_text(query)
    normalized_venue = _normalize_text(venue)
    normalized_type_filters = _parse_type_filters(types)
    normalized_genre = _normalize_text(genre)
    if normalized_genre == "all":
        normalized_genre = ""

    client = _get_optional_supabase_client()
    if client is not None:
        try:
            supabase_query = (
                client.table("events")
                .select("id,title,description,start_time,category,zip_code,venues(name)")
                .eq("zip_code", zip_code)
                .gte("start_time", now_utc.isoformat())
            )

            if start_after:
                supabase_query = supabase_query.gte("start_time", start_after.isoformat())

            if start_before:
                supabase_query = supabase_query.lte("start_time", start_before.isoformat())

            if normalized_genre:
                supabase_query = supabase_query.eq("category", normalized_genre)

            response = supabase_query.execute()
            rows = response.data or []
            normalized_rows = [_map_row_to_event_record(row) for row in rows]
            filtered_rows = [
                row
                for row in normalized_rows
                if _matches_search_filters(
                    row,
                    query_text=normalized_query,
                    venue_text=normalized_venue,
                    type_filters=normalized_type_filters,
                )
            ]
            sorted_rows = _sort_search_results(filtered_rows, sort)
            paged_rows = sorted_rows[offset : offset + limit]

            items = [
                EventSummary(
                    id=row["id"],
                    title=row["title"],
                    venue_name=row["venue_name"],
                    start_time=row["start_time"],
                    category=row["category"],
                    zip_code=row["zip_code"],
                )
                for row in paged_rows
            ]

            return EventSearchResponse(
                items=items,
                page=page,
                limit=limit,
                total=len(sorted_rows),
            )
        except Exception:
            # Fallback to sample data so local setup remains usable before Supabase wiring.
            pass

    sample_rows = [_map_row_to_event_record(event) for event in _SAMPLE_EVENTS if event["zip_code"] == zip_code]
    sample_rows = [event for event in sample_rows if _to_utc_datetime(event["start_time"]) >= now_utc]
    if start_after:
        sample_rows = [event for event in sample_rows if _to_utc_datetime(event["start_time"]) >= start_after]

    if start_before:
        sample_rows = [event for event in sample_rows if _to_utc_datetime(event["start_time"]) <= start_before]

    if normalized_genre:
        sample_rows = [event for event in sample_rows if _normalize_text(event["category"]) == normalized_genre]

    sample_rows = [
        event
        for event in sample_rows
        if _matches_search_filters(
            event,
            query_text=normalized_query,
            venue_text=normalized_venue,
            type_filters=normalized_type_filters,
        )
    ]
    sample_rows = _sort_search_results(sample_rows, sort)

    total = len(sample_rows)
    paged_rows = sample_rows[offset : offset + limit]
    items = [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=row["venue_name"],
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
        )
        for row in paged_rows
    ]

    return EventSearchResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str) -> EventDetail:
    client = _get_optional_supabase_client()
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

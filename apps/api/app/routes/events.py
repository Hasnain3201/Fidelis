from datetime import datetime, timezone
from typing import Optional, List, Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Query, HTTPException, Depends, status

from app.db.supabase import get_supabase_client
from app.models.event_schemas import EventSummary, EventSearchResponse, EventDetail

from app.core.auth import require_user_id

router = APIRouter()

EventSort = Literal["recommended", "dateSoonest", "dateLatest"]


def _get_supabase_client_or_503():
    try:
        return get_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _parse_uuid(value: str) -> Optional[UUID]:
    try:
        return UUID(value)
    except ValueError:
        return None


def _parse_type_tokens(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [token.strip().lower() for token in value.split(",") if token.strip()]


def _matches_type_tokens(title: str, category: str, type_tokens: List[str]) -> bool:
    if not type_tokens:
        return True

    haystack = f"{title} {category}".lower()
    return any(token in haystack for token in type_tokens)


def _sort_event_rows(rows: List[dict[str, Any]], sort: EventSort) -> List[dict[str, Any]]:
    if sort == "recommended":
        return rows

    sorted_rows = list(rows)
    sorted_rows.sort(key=lambda row: row.get("start_time") or "")
    if sort == "dateLatest":
        sorted_rows.reverse()
    return sorted_rows


def build_event_query(
    client: Any,
    query: Optional[str] = None,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    start_after: Optional[datetime] = None,
    start_before: Optional[datetime] = None,
    categories: Optional[List[str]] = None,
    venue: Optional[str] = None,
    include_count: bool = False,
):
    table = client.table("events")
    if include_count:
        q = table.select(
            "id,title,start_time,category,zip_code,venues(name, city, state)",
            count="exact",
        )
    else:
        q = table.select("id,title,start_time,category,zip_code,venues(name, city, state)")

    q = q.order("start_time")

    if zip_code:
        q = q.eq("zip_code", zip_code)

    if city:
        q = q.filter("venues.city", "ilike", f"%{city}%")

    if state:
        q = q.filter("venues.state", "ilike", f"%{state}%")

    if venue:
        q = q.filter("venues.name", "ilike", f"%{venue}%")

    if start_after:
        q = q.gte("start_time", start_after.isoformat())

    if start_before:
        q = q.lte("start_time", start_before.isoformat())

    if not start_after and not start_before:
        now_utc = datetime.now(timezone.utc)
        q = q.gte("start_time", now_utc.isoformat())

    if categories:
        q = q.in_("category", categories)

    if query:
        q = q.ilike("title", f"%{query}%")

    return q

@router.get("/", response_model=list[EventSummary])
def list_events(
    zip_code: Optional[str] = Query(default=None, pattern=r"^\d{5}$"),
    limit: int = Query(20, ge=1, le=100),
):
    client = _get_supabase_client_or_503()

    query = (
        client.table("events")
        .select("id,title,start_time,category,zip_code,venues(name)")
        .order("start_time")
        .limit(limit)
    )

    if zip_code:
        query = query.eq("zip_code", zip_code)

    try:
        response = query.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load events",
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

@router.get("/search", response_model=EventSearchResponse)
def search_events(
    query: Optional[str] = Query(default=None),

    zip_code: Optional[str] = Query(default=None, pattern=r"^\d{5}$"),
    city: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),

    start_after: Optional[datetime] = Query(default=None),
    start_before: Optional[datetime] = Query(default=None),

    categories: Optional[List[str]] = Query(default=None),

    venue: Optional[str] = Query(default=None),
    types: Optional[str] = Query(default=None),
    sort: str = Query(default="recommended"),

    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    type_tokens = _parse_type_tokens(types)
    allowed_sorts: set[EventSort] = {"recommended", "dateSoonest", "dateLatest"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=422, detail="Invalid sort value. Use recommended, dateSoonest, or dateLatest.")
    sort_value = cast(EventSort, sort)

    client = _get_supabase_client_or_503()

    offset = (page - 1) * limit

    supabase_query = build_event_query(
        client,
        query=query,
        zip_code=zip_code,
        city=city,
        state=state,
        start_after=start_after,
        start_before=start_before,
        categories=categories,
        venue=venue,
        include_count=True,
    ).range(offset, offset + limit - 1)

    try:
        response = supabase_query.execute()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to search events",
        )
    rows = response.data or []
    if type_tokens:
        rows = [
            row
            for row in rows
            if _matches_type_tokens(
                str(row.get("title", "")),
                str(row.get("category", "")),
                type_tokens,
            )
        ]
    total = response.count if isinstance(response.count, int) else len(rows)
    if type_tokens:
        total = len(rows)

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
    if sort_value != "recommended":
        items = [
            EventSummary(**row)
            for row in _sort_event_rows([item.model_dump(mode="json") for item in items], sort_value)
        ]

    return EventSearchResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
    )

@router.get("/recommended", response_model=list[EventSummary])
async def get_recommended_events(user_id: UUID = Depends(require_user_id)):
    client = _get_supabase_client_or_503()
    
    user_location = (
        client
        .table("profiles")
        .select("home_zip,city,state")
        .eq("id", user_id)
        .single()
        .execute()
    ).data or {}

    user_favorite_events = (
        client
        .table("favorites")
        .select("events(category)")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    user_followed_artists = (
        client
        .table("artist_follows")
        .select("artist_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    categories = list({
        fav.get("events", {}).get("category")
        for fav in user_favorite_events
        if fav.get("events")
    })

    artist_ids = [a["artist_id"] for a in user_followed_artists]

    base_query = build_event_query(
        client=client,
        zip_code=user_location.get("home_zip"),
        city=user_location.get("city"),
        state=user_location.get("state"),
        categories=categories if categories else None
    ).limit(50)

    base_events = base_query.execute().data or []

    artist_events = []
    if artist_ids:
        artist_response = (
            client
            .table("event_artists")
            .select("events(id,title,start_time,category,zip_code,venues(name))")
            .in_("artist_id", artist_ids)
            .execute()
        ).data or []

        for row in artist_response:
            event = row.get("events") or {}
            artist_events.append(event)

    seen = set()
    combined = []

    for event in base_events + artist_events:
        if not event or event.get("id") in seen:
            continue

        seen.add(event["id"])
        combined.append(event)
    
    combined.sort(key=lambda x: x["start_time"])

    items = [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"]
        )
        for row in combined
    ]

    return items

@router.get("/trending", response_model=list[EventSummary])
async def get_trending_events():
    client = _get_supabase_client_or_503()

    response = (
        client
        .rpc("get_popular_events", {"limit_count": 20})
        .execute()
    )

    if response.data is None:
        raise HTTPException(status_code=500, detail="Failed to fetch trending events")

    rows = response.data

    return [
        EventSummary(
            id=row["event_id"],
            title=row.get("title", "Untitled Event"),
            venue_name=row["venue_name"],
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
        )
        for row in rows
    ]

@router.get("/{event_id}/artists")
async def get_event_artists(event_id: str):
    parsed_event_id = _parse_uuid(event_id)
    if parsed_event_id is None:
        return []

    client = _get_supabase_client_or_503()

    try:
        response = (
            client
            .table("event_artists")
            .select("artists(id, stage_name, genre, media_url)")
            .eq("event_id", str(parsed_event_id))
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load event artists",
        )

    data = response.data or []

    artists = []

    for row in data:
        artist = row.get("artists") or {}

        artists.append({
            "id": artist.get("id"),
            "stage_name": artist.get("stage_name"),
            "genre": artist.get("genre"),
            "media_url": artist.get("media_url")
        })

    return artists

@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str):
    parsed_event_id = _parse_uuid(event_id)
    if parsed_event_id is None:
        raise HTTPException(status_code=404, detail="Event not found")

    client = _get_supabase_client_or_503()

    try:
        response = (
            client.table("events")
            .select("id,title,description,start_time,end_time,category,zip_code,ticket_url,venues(name)")
            .eq("id", str(parsed_event_id))
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load event",
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
        end_time=row.get("end_time") or row["start_time"],
        category=row["category"],
        zip_code=row["zip_code"],
        ticket_url=row.get("ticket_url"),
    )

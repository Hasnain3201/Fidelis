from collections import Counter
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Query, HTTPException, Depends

from app.db.supabase import get_supabase_client
from app.models.schemas import EventSummary, EventSearchResponse, EventDetail

from app.core.auth import require_user_id

router = APIRouter()

def build_event_query(
    client,
    query=None,
    zip_code=None,
    city=None,
    state=None,
    start_after=None,
    start_before=None,
    categories=None,
):
    q = (
        client.table("events")
        .select("id,title,start_time,category,zip_code,venues(name, city, state)")
        .order("start_time")
    )

    if zip_code:
        q = q.eq("zip_code", zip_code)

    if city:
        q = q.filter("venues.city", "ilike", f"%{city}%")

    if state:
        q = q.filter("venues.state", "ilike", f"%{state}%")

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
    client = get_supabase_client()

    query = (
        client.table("events")
        .select("id,title,start_time,category,zip_code,venues(name)")
        .order("start_time")
        .limit(limit)
    )

    if zip_code:
        query = query.eq("zip_code", zip_code)

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

    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    client = get_supabase_client()

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
    ).range(offset, offset + limit - 1)

    if zip_code:
        supabase_query = supabase_query.eq("zip_code", zip_code)

    if start_after:
        supabase_query = supabase_query.gte("start_time", start_after.isoformat())

    if start_before:
        supabase_query = supabase_query.lte("start_time", start_before.isoformat())

    if not start_after and not start_before:
        now_utc = datetime.now(timezone.utc)
        supabase_query = supabase_query.gte("start_time", now_utc.isoformat())

    if categories:
        supabase_query = supabase_query.in_("category", categories)

    if query:
        supabase_query = supabase_query.ilike("title", f"%{query}%")

    response = supabase_query.execute()
    rows = response.data or []

    if venue:
        venue = venue.lower()
        rows = [
            row for row in rows
            if venue in ((row.get("venues") or {}).get("name", "").lower())
        ]

    if city:
        city = city.lower()
        rows = [
            row for row in rows
            if city in ((row.get("venues") or {}).get("city", "").lower())
        ]

    if state:
        state = state.lower()
        rows = [
            row for row in rows
            if state in ((row.get("venues") or {}).get("state", "").lower())
        ]

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
        items=items,
        page=page,
        limit=limit,
        total=len(items),
    )

@router.get("/recommended", response_model=list[EventSummary])
async def get_recommended_events(user_id: UUID = Depends(require_user_id)):
    client = get_supabase_client()
    
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

    combined.sort(key=lambda x: x["start_time"])

    return items

@router.get("/trending", response_model=list[EventSummary])
async def get_trending_events():
    client = get_supabase_client()

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
async def get_event_artists(event_id: UUID):
    client = get_supabase_client()

    response = (
        client
        .table("event_artists")
        .select("artists(id, stage_name, genre, media_url)")
        .eq("event_id", event_id)
        .execute()
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
def get_event(event_id: UUID):
    client = get_supabase_client()

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
        end_time=row.get("end_time"),
        category=row["category"],
        zip_code=row["zip_code"],
        ticket_url=row.get("ticket_url"),
    )
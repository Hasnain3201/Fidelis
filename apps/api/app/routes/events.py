from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.db.supabase import get_supabase_client
from app.models.schemas import EventSummary, EventSearchResponse, EventDetail

router = APIRouter()

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
    zip_code: str = Query(..., pattern=r"^\d{5}$"),
    query: Optional[str] = Query(default=None),
    venue: Optional[str] = Query(default=None),
    genre: Optional[str] = Query(default=None),
    start_after: Optional[datetime] = Query(default=None),
    start_before: Optional[datetime] = Query(default=None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    client = get_supabase_client()

    offset = (page - 1) * limit
    now_utc = datetime.now(timezone.utc)

    supabase_query = (
        client.table("events")
        .select("id,title,start_time,category,zip_code,venues(name)")
        .eq("zip_code", zip_code)
        .gte("start_time", now_utc.isoformat())
        .order("start_time")
        .range(offset, offset + limit - 1)
    )

    if start_after:
        supabase_query = supabase_query.gte("start_time", start_after.isoformat())

    if start_before:
        supabase_query = supabase_query.lte("start_time", start_before.isoformat())

    if genre:
        supabase_query = supabase_query.eq("category", genre)

    if query:
        supabase_query = supabase_query.ilike("title", f"%{query}%")

    if venue:
        supabase_query = supabase_query.ilike("venues.name", f"%{venue}%")

    response = supabase_query.execute()
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
        items=items,
        page=page,
        limit=limit,
        total=len(items),
    )

@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str):
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
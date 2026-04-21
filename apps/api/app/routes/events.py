from datetime import datetime, timezone
from typing import Any, List, Literal, Optional, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import require_user_id
from app.db.supabase import get_supabase_client
from app.models.event_schemas import EventDetail, EventSearchResponse, EventSummary, TrendingContentItem

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


def _coerce_event_lookup_id(event_id: str) -> str:
    parsed = _parse_uuid(event_id)
    if parsed is not None:
        return str(parsed)
    return event_id


def _is_invalid_uuid_lookup_error(exc: Exception) -> bool:
    return "invalid input syntax for type uuid" in str(exc).lower()


_EVENT_DETAIL_BASE_SELECT = (
    "id,title,description,start_time,end_time,category,zip_code,ticket_url,cover_image_url,venues(name)"
)
_EVENT_DETAIL_EXTENDED_SELECT = (
    "id,title,description,start_time,end_time,category,zip_code,ticket_url,cover_image_url,price,age_requirement,capacity,venues(name)"
)
_EVENT_OPTIONAL_COLUMNS = ("price", "age_requirement", "capacity")


def _is_missing_optional_event_column_error(exc: Exception) -> bool:
    message = str(exc).lower()
    missing_column_markers = (
        "does not exist",
        "could not find the",
        "unknown column",
    )
    if not any(marker in message for marker in missing_column_markers):
        return False
    return any(column in message for column in _EVENT_OPTIONAL_COLUMNS)


def _fetch_event_row_with_optional_fallback(client: Any, lookup_event_id: str):
    try:
        return (
            client.table("events")
            .select(_EVENT_DETAIL_EXTENDED_SELECT)
            .eq("id", lookup_event_id)
            .single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_optional_event_column_error(exc):
            raise
        return (
            client.table("events")
            .select(_EVENT_DETAIL_BASE_SELECT)
            .eq("id", lookup_event_id)
            .single()
            .execute()
        )


_EVENT_SUMMARY_SELECT = "id,title,start_time,category,zip_code,is_promoted,cover_image_url,venues(name)"


def _fetch_fallback_trending_rows(client: Any, limit_count: int = 20) -> list[dict[str, Any]]:
    now_utc = datetime.now(timezone.utc).isoformat()

    try:
        upcoming = (
            client.table("events")
            .select(_EVENT_SUMMARY_SELECT)
            .gte("start_time", now_utc)
            .order("start_time")
            .limit(limit_count)
            .execute()
        ).data or []
    except Exception:
        upcoming = []

    if upcoming:
        return upcoming

    try:
        recent = (
            client.table("events")
            .select(_EVENT_SUMMARY_SELECT)
            .order("start_time", desc=True)
            .limit(limit_count)
            .execute()
        ).data or []
    except Exception:
        recent = []

    return recent


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
    is_promoted: Optional[bool] = None,
):
    select_clause = (
        "id,title,start_time,category,zip_code,is_promoted,cover_image_url,venues(name, city, state)"
    )

    table = client.table("events")
    if include_count:
        q = table.select(select_clause, count="exact")
    else:
        q = table.select(select_clause)

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

    if is_promoted is not None:
        q = q.eq("is_promoted", is_promoted)

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
        .select("id,title,start_time,category,zip_code,is_promoted,cover_image_url,venues(name)")
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
            is_promoted=bool(row.get("is_promoted", False)),
            cover_image_url=row.get("cover_image_url"),
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
    is_promoted: Optional[bool] = Query(default=None),
):
    type_tokens = _parse_type_tokens(types)

    allowed_sorts: set[EventSort] = {"recommended", "dateSoonest", "dateLatest"}
    if sort not in allowed_sorts:
        raise HTTPException(
            status_code=422,
            detail="Invalid sort value. Use recommended, dateSoonest, or dateLatest.",
        )
    sort_value = cast(EventSort, sort)

    client = _get_supabase_client_or_503()
    offset = (page - 1) * limit

    if type_tokens:
        # For type token filtering, fetch the full candidate set first so total/pagination
        # reflect post-filtered results rather than only the current DB page.
        full_query = build_event_query(
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
            is_promoted=is_promoted,
        )

        try:
            full_response = full_query.execute()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to search events",
            )

        matched_rows = [
            row
            for row in (full_response.data or [])
            if _matches_type_tokens(
                str(row.get("title", "")),
                str(row.get("category", "")),
                type_tokens,
            )
        ]

        if sort_value != "recommended":
            matched_rows = _sort_event_rows(matched_rows, sort_value)

        total = len(matched_rows)
        rows = matched_rows[offset : offset + limit]
    else:
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
            is_promoted=is_promoted,
        ).range(offset, offset + limit - 1)

        try:
            response = supabase_query.execute()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to search events",
            )

        rows = response.data or []
        total = response.count if isinstance(response.count, int) else len(rows)

    items = [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
            is_promoted=bool(row.get("is_promoted", False)),
            cover_image_url=row.get("cover_image_url"),
        )
        for row in rows
    ]

    if sort_value != "recommended" and not type_tokens:
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
        client.table("profiles")
        .select("home_zip,city,state")
        .eq("id", user_id)
        .single()
        .execute()
    ).data or {}

    user_favorite_events = (
        client.table("favorites")
        .select("events(category)")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    user_followed_artists = (
        client.table("artist_follows")
        .select("artist_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    categories = list(
        {
            fav.get("events", {}).get("category")
            for fav in user_favorite_events
            if fav.get("events")
        }
    )

    artist_ids = [a["artist_id"] for a in user_followed_artists]

    base_query = build_event_query(
        client=client,
        zip_code=user_location.get("home_zip"),
        city=user_location.get("city"),
        state=user_location.get("state"),
        categories=categories if categories else None,
    ).limit(50)

    base_events = base_query.execute().data or []

    artist_events: list[dict[str, Any]] = []
    if artist_ids:
        artist_response = (
            client.table("event_artists")
            .select("events(id,title,start_time,category,zip_code,is_promoted,cover_image_url,venues(name))")
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

    combined.sort(key=lambda x: x.get("start_time") or "")

    items = [
        EventSummary(
            id=row["id"],
            title=row["title"],
            venue_name=(row.get("venues") or {}).get("name", "Unknown Venue"),
            start_time=row["start_time"],
            category=row["category"],
            zip_code=row["zip_code"],
            is_promoted=bool(row.get("is_promoted", False)),
            cover_image_url=row.get("cover_image_url"),
        )
        for row in combined
    ]

    return items


@router.get("/trending/content", response_model=list[TrendingContentItem])
async def get_trending_content(limit: int = Query(10, ge=1, le=50)):
    client = _get_supabase_client_or_503()

    response = client.rpc("get_popular_content", {"limit_count": limit}).execute()
    rows = response.data or []

    return [
        TrendingContentItem(
            item_type=row["item_type"],
            item_id=row["item_id"],
            label=row["label"],
            start_time=row.get("start_time"),
            category=row.get("category"),
            zip_code=row.get("zip_code"),
            venue_name=row.get("venue_name"),
            popularity_count=row.get("popularity_count", 0),
        )
        for row in rows
    ]


@router.get("/trending", response_model=list[EventSummary])
async def get_trending_events():
    client = _get_supabase_client_or_503()

    rows: list[dict[str, Any]] = []
    try:
        response = client.rpc("get_popular_events", {"limit_count": 20}).execute()
        rows = response.data or []
    except Exception:
        rows = []

    if not rows:
        rows = _fetch_fallback_trending_rows(client, limit_count=20)

    items: list[EventSummary] = []
    for row in rows:
        event_id = row.get("event_id") or row.get("id")
        if event_id is None:
            continue

        start_time = row.get("start_time")
        zip_code = row.get("zip_code")
        if not start_time or not zip_code:
            continue

        items.append(
            EventSummary(
                id=str(event_id),
                title=row.get("title", "Untitled Event"),
                venue_name=row.get("venue_name")
                or (row.get("venues") or {}).get("name", "Unknown Venue"),
                start_time=start_time,
                category=row.get("category", "live-event"),
                zip_code=zip_code,
                is_promoted=bool(row.get("is_promoted", False)),
                cover_image_url=row.get("cover_image_url"),
            )
        )

    return items


@router.get("/{event_id}/artists")
async def get_event_artists(event_id: str):
    parsed_event_id = _parse_uuid(event_id)
    lookup_event_id = _coerce_event_lookup_id(event_id)

    try:
        client = _get_supabase_client_or_503()
    except HTTPException as exc:
        if parsed_event_id is None and exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            return []
        raise

    try:
        response = (
            client.table("event_artists")
            .select("artists(id, stage_name, genre, media_url)")
            .eq("event_id", lookup_event_id)
            .execute()
        )
    except Exception as exc:
        if _is_invalid_uuid_lookup_error(exc):
            return []
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load event artists",
        ) from exc

    data = response.data or []
    artists = []

    for row in data:
        artist = row.get("artists") or {}

        artists.append(
            {
                "id": artist.get("id"),
                "stage_name": artist.get("stage_name"),
                "genre": artist.get("genre"),
                "media_url": artist.get("media_url"),
            }
        )

    return artists


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str):
    parsed_event_id = _parse_uuid(event_id)
    lookup_event_id = _coerce_event_lookup_id(event_id)

    try:
        client = _get_supabase_client_or_503()
    except HTTPException as exc:
        if parsed_event_id is None and exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            raise HTTPException(status_code=404, detail="Event not found") from exc
        raise

    try:
        response = _fetch_event_row_with_optional_fallback(client, lookup_event_id)
    except Exception as exc:
        if _is_invalid_uuid_lookup_error(exc):
            raise HTTPException(status_code=404, detail="Event not found") from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to load event",
        ) from exc

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
        cover_image_url=row.get("cover_image_url"),
        price=row.get("price"),
        age_requirement=row.get("age_requirement"),
        capacity=row.get("capacity"),
    )

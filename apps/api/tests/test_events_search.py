from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import MagicMock, patch

from app.services.scraper.utils import map_event_to_supabase


def _event(
    event_id: str,
    *,
    title: str,
    venue: str,
    category: str,
    start: datetime,
    zip_code: Optional[str] = "10001",
    venue_zip_code: Optional[str] = None,
    price: Any = None,
):
    return {
        "id": event_id,
        "title": title,
        "venue_name": venue,
        "venues": {"name": venue, "zip_code": venue_zip_code},
        "start_time": start.isoformat(),
        "category": category,
        "zip_code": zip_code,
        "price": price,
    }


@patch("app.routes.events.build_event_query")
@patch("app.routes.events.get_supabase_client")
def test_search_filters_query_venue_and_types(mock_get_client, mock_build_event_query, anon_client):
    now = datetime.now(timezone.utc)
    response_rows = [
        _event(
            "evt_a",
            title="Acoustic Sunrise Session",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=1),
        ),
        _event(
            "evt_b",
            title="Late Night DJ Set",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=2),
        ),
        _event(
            "evt_c",
            title="Comedy Open Mic",
            venue="Brick Room",
            category="comedy",
            start=now + timedelta(days=3),
        ),
    ]

    query = MagicMock()
    query.range.return_value = query
    query.execute.return_value = SimpleNamespace(data=response_rows, count=3)
    mock_get_client.return_value = MagicMock()
    mock_build_event_query.return_value = query

    resp = anon_client.get(
        "/api/v1/events/search",
        params={
            "zip_code": "10001",
            "query": "night",
            "venue": "blue",
            "types": "dj",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == "evt_b"
    _, kwargs = mock_build_event_query.call_args
    assert kwargs["query"] == "night"
    assert kwargs["zip_code"] == "10001"
    assert kwargs["venue"] == "blue"
    assert kwargs["include_count"] is True


@patch("app.routes.events.build_event_query")
@patch("app.routes.events.get_supabase_client")
def test_search_sort_date_latest(mock_get_client, mock_build_event_query, anon_client):
    now = datetime.now(timezone.utc)
    response_rows = [
        _event(
            "evt_older",
            title="Early Show",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=1),
        ),
        _event(
            "evt_newer",
            title="Late Show",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=5),
        ),
    ]

    query = MagicMock()
    query.range.return_value = query
    query.execute.return_value = SimpleNamespace(data=response_rows, count=2)
    mock_get_client.return_value = MagicMock()
    mock_build_event_query.return_value = query

    resp = anon_client.get(
        "/api/v1/events/search",
        params={
            "zip_code": "10001",
            "sort": "dateLatest",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert [item["id"] for item in body["items"]] == ["evt_newer", "evt_older"]


@patch("app.routes.events.build_event_query")
@patch("app.routes.events.get_supabase_client")
def test_search_falls_back_to_venue_zip_when_event_zip_missing(mock_get_client, mock_build_event_query, anon_client):
    now = datetime.now(timezone.utc)
    response_rows = [
        _event(
            "evt_missing_zip",
            title="Venue ZIP Show",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=1),
            zip_code=None,
            venue_zip_code="10003",
        )
    ]

    query = MagicMock()
    query.range.return_value = query
    query.execute.return_value = SimpleNamespace(data=response_rows, count=1)
    mock_get_client.return_value = MagicMock()
    mock_build_event_query.return_value = query

    resp = anon_client.get("/api/v1/events/search")

    assert resp.status_code == 200
    body = resp.json()
    assert body["items"][0]["zip_code"] == "10003"


@patch("app.routes.events.build_event_query")
@patch("app.routes.events.get_supabase_client")
def test_search_includes_price_in_summary(mock_get_client, mock_build_event_query, anon_client):
    now = datetime.now(timezone.utc)
    response_rows = [
        _event(
            "evt_priced",
            title="Priced Show",
            venue="Blue Room",
            category="live-music",
            start=now + timedelta(days=1),
            price={"amount": 25.0, "currency": "USD"},
        )
    ]

    query = MagicMock()
    query.range.return_value = query
    query.execute.return_value = SimpleNamespace(data=response_rows, count=1)
    mock_get_client.return_value = MagicMock()
    mock_build_event_query.return_value = query

    resp = anon_client.get("/api/v1/events/search", params={"zip_code": "10001"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["items"][0]["price"] == 25.0


def test_scraped_event_inherits_venue_zip_when_event_zip_missing():
    mapped = map_event_to_supabase(
        {
            "title": "Venue ZIP Show",
            "start_datetime": "2026-05-01T20:00:00-04:00",
            "types": ["Music"],
        },
        venue_id="venue-id",
        venue_name="Blue Room",
        venue_zip_code="10003",
    )

    assert mapped["zip_code"] == "10003"


def test_search_invalid_sort_returns_422(anon_client):
    resp = anon_client.get(
        "/api/v1/events/search",
        params={
            "zip_code": "10001",
            "sort": "latest-first",
        },
    )

    assert resp.status_code == 422
    assert "sort" in resp.json()["detail"].lower()


@patch("app.routes.events.get_supabase_client", side_effect=RuntimeError("not configured"))
def test_search_returns_503_when_database_unavailable(_mock_client, anon_client):
    resp = anon_client.get(
        "/api/v1/events/search",
        params={"zip_code": "10001"},
    )

    assert resp.status_code == 503


@patch("app.routes.events.build_event_query")
@patch("app.routes.events.get_supabase_client")
def test_search_returns_503_when_query_execution_fails(mock_get_client, mock_build_event_query, anon_client):
    query = MagicMock()
    query.range.return_value = query
    query.execute.side_effect = RuntimeError("network unavailable")

    mock_get_client.return_value = MagicMock()
    mock_build_event_query.return_value = query

    resp = anon_client.get("/api/v1/events/search", params={"zip_code": "10001"})
    assert resp.status_code == 503

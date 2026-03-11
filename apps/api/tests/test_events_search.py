from datetime import datetime, timedelta, timezone
from unittest.mock import patch


def _event(
    event_id: str,
    *,
    title: str,
    venue: str,
    category: str,
    start: datetime,
    zip_code: str = "10001",
):
    return {
        "id": event_id,
        "title": title,
        "venue_name": venue,
        "start_time": start.isoformat(),
        "category": category,
        "zip_code": zip_code,
    }


@patch("app.routes.events.get_supabase_client", side_effect=RuntimeError("not configured"))
def test_search_filters_query_venue_and_types(_mock_client, anon_client):
    now = datetime.now(timezone.utc)
    sample_events = [
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

    with patch("app.routes.events._SAMPLE_EVENTS", sample_events):
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


@patch("app.routes.events.get_supabase_client", side_effect=RuntimeError("not configured"))
def test_search_sort_date_latest(_mock_client, anon_client):
    now = datetime.now(timezone.utc)
    sample_events = [
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

    with patch("app.routes.events._SAMPLE_EVENTS", sample_events):
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


@patch("app.routes.events.get_supabase_client", side_effect=RuntimeError("not configured"))
def test_search_invalid_sort_returns_422(_mock_client, anon_client):
    resp = anon_client.get(
        "/api/v1/events/search",
        params={
            "zip_code": "10001",
            "sort": "latest-first",
        },
    )

    assert resp.status_code == 422
    assert "sort" in resp.json()["detail"].lower()

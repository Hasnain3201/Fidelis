"""Regression coverage for event ID compatibility across legacy/text and UUID backends."""

from unittest.mock import MagicMock, patch


def _mock_query(response_data):
    query = MagicMock()
    response = MagicMock()
    response.data = response_data
    query.execute.return_value = response

    for method in ("select", "eq", "single"):
        getattr(query, method).return_value = query

    return query


def _mock_list_query(response_data):
    query = MagicMock()
    response = MagicMock()
    response.data = response_data
    query.execute.return_value = response

    for method in ("select", "gte", "order", "limit"):
        getattr(query, method).return_value = query

    return query


@patch("app.routes.events.get_supabase_client")
def test_get_event_supports_legacy_text_id(mock_sb, anon_client):
    query = _mock_query(
        {
            "id": "evt_legacy_101",
            "title": "Legacy Event",
            "description": "Legacy ID event row",
            "start_time": "2026-06-01T18:00:00+00:00",
            "end_time": "2026-06-01T21:00:00+00:00",
            "category": "live-music",
            "zip_code": "10001",
            "ticket_url": None,
            "cover_image_url": None,
            "price": None,
            "age_requirement": None,
            "capacity": None,
            "venues": {"name": "Legacy Venue"},
        }
    )

    client = MagicMock()
    client.table.return_value = query
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/evt_legacy_101")
    assert resp.status_code == 200
    assert resp.json()["id"] == "evt_legacy_101"
    query.eq.assert_called_with("id", "evt_legacy_101")


@patch("app.routes.events.get_supabase_client")
def test_get_event_returns_404_for_invalid_uuid_cast_errors(mock_sb, anon_client):
    query = _mock_query({})
    query.execute.side_effect = Exception('invalid input syntax for type uuid: "evt_legacy_101"')

    client = MagicMock()
    client.table.return_value = query
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/evt_legacy_101")
    assert resp.status_code == 404


@patch("app.routes.events.get_supabase_client")
def test_get_event_artists_supports_legacy_text_id(mock_sb, anon_client):
    query = _mock_query(
        [
            {
                "artists": {
                    "id": "artist_1",
                    "stage_name": "DJ Legacy",
                    "genre": "electronic",
                    "media_url": None,
                }
            }
        ]
    )

    client = MagicMock()
    client.table.return_value = query
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/evt_legacy_101/artists")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "artist_1"
    query.eq.assert_called_with("event_id", "evt_legacy_101")


@patch("app.routes.events.get_supabase_client")
def test_trending_accepts_id_alias(mock_sb, anon_client):
    rpc_query = MagicMock()
    rpc_response = MagicMock()
    rpc_response.data = [
        {
            "id": "evt_legacy_101",
            "title": "Trending Legacy",
            "start_time": "2026-06-01T18:00:00+00:00",
            "category": "live-music",
            "zip_code": "10001",
            "venue_name": "Legacy Venue",
        }
    ]
    rpc_query.execute.return_value = rpc_response

    client = MagicMock()
    client.rpc.return_value = rpc_query
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/trending")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "evt_legacy_101"


@patch("app.routes.events.get_supabase_client")
def test_trending_falls_back_when_rpc_empty(mock_sb, anon_client):
    rpc_query = MagicMock()
    rpc_response = MagicMock()
    rpc_response.data = []
    rpc_query.execute.return_value = rpc_response

    fallback_query = _mock_list_query(
        [
            {
                "id": "30000000-0000-0000-0000-000000000001",
                "title": "Fallback Event",
                "start_time": "2026-06-01T18:00:00+00:00",
                "category": "live-music",
                "zip_code": "10001",
                "is_promoted": False,
                "cover_image_url": None,
                "venues": {"name": "Fallback Venue"},
            }
        ]
    )

    client = MagicMock()
    client.rpc.return_value = rpc_query
    client.table.return_value = fallback_query
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/trending")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "30000000-0000-0000-0000-000000000001"
    assert resp.json()[0]["venue_name"] == "Fallback Venue"


@patch("app.routes.events.get_supabase_client")
def test_get_event_falls_back_when_optional_columns_missing(mock_sb, anon_client):
    first_query = _mock_query({})
    first_query.execute.side_effect = Exception("column events.price does not exist")

    fallback_query = _mock_query(
        {
            "id": "30000000-0000-0000-0000-000000000001",
            "title": "Event Without Optional Columns",
            "description": "Uses fallback select",
            "start_time": "2026-06-01T18:00:00+00:00",
            "end_time": "2026-06-01T21:00:00+00:00",
            "category": "live-music",
            "zip_code": "10001",
            "ticket_url": None,
            "cover_image_url": None,
            "venues": {"name": "Fallback Venue"},
        }
    )

    client = MagicMock()
    client.table.side_effect = [first_query, fallback_query]
    mock_sb.return_value = client

    resp = anon_client.get("/api/v1/events/30000000-0000-0000-0000-000000000001")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "30000000-0000-0000-0000-000000000001"
    assert body["price"] is None
    assert body["age_requirement"] is None
    assert body["capacity"] is None

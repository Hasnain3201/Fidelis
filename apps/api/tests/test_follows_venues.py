"""Venue follow endpoint coverage."""

from unittest.mock import MagicMock, patch


def _mock_supabase_response(data):
    resp = MagicMock()
    resp.data = data
    return resp


def _chain_mock(return_data):
    mock = MagicMock()
    mock.execute.return_value = _mock_supabase_response(return_data)
    for method in ("select", "eq", "single", "order", "limit", "insert", "delete"):
        getattr(mock, method).return_value = mock
    return mock


@patch("app.routes.follows.get_supabase_admin_client")
def test_list_venue_follows(mock_admin, user_client):
    rows = [
        {
            "venue_id": "v1",
            "created_at": "2026-03-01T00:00:00+00:00",
            "venues": {"name": "Blue Room"},
        }
    ]
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(rows)
    mock_admin.return_value = admin_mock

    resp = user_client.get("/api/v1/follows/venues")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["venue_id"] == "v1"
    assert body[0]["venue_name"] == "Blue Room"


@patch("app.routes.follows.get_supabase_admin_client")
def test_create_venue_follow(mock_admin, user_client):
    venue_follows_table = MagicMock()
    venue_follows_table.select.return_value = venue_follows_table
    venue_follows_table.eq.return_value = venue_follows_table
    venue_follows_table.insert.return_value = venue_follows_table
    venue_follows_table.execute.side_effect = [
        _mock_supabase_response([]),
        _mock_supabase_response([{"venue_id": "v1", "created_at": "2026-03-01T00:00:00+00:00"}]),
    ]

    venues_table = _chain_mock({"name": "Blue Room"})

    admin_mock = MagicMock()

    def _table_dispatch(name):
        if name == "venue_follows":
            return venue_follows_table
        if name == "venues":
            return venues_table
        return _chain_mock([])

    admin_mock.table.side_effect = _table_dispatch
    mock_admin.return_value = admin_mock

    resp = user_client.post("/api/v1/follows/venues", json={"venue_id": "v1"})
    assert resp.status_code == 201
    assert resp.json()["venue_id"] == "v1"
    assert resp.json()["venue_name"] == "Blue Room"


@patch("app.routes.follows.get_supabase_admin_client")
def test_delete_venue_follow(mock_admin, user_client):
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock([])
    mock_admin.return_value = admin_mock

    resp = user_client.delete("/api/v1/follows/venues/v1")
    assert resp.status_code == 204


def test_venue_role_cannot_use_venue_follows(venue_client):
    resp = venue_client.get("/api/v1/follows/venues")
    assert resp.status_code == 403


@patch("app.routes.follows.get_supabase_admin_client", return_value=None)
def test_venue_follows_returns_503_when_admin_client_missing(_mock_admin, user_client):
    resp = user_client.get("/api/v1/follows/venues")
    assert resp.status_code == 503

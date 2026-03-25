"""Happy-path profile / favorites / follows / venue / artist CRUD with mocked Supabase."""

from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_supabase_response(data):
    resp = MagicMock()
    resp.data = data
    resp.count = len(data) if isinstance(data, list) else 1
    return resp


def _chain_mock(return_data):
    """Return a MagicMock where any chained method ultimately returns
    ``return_data`` when ``.execute()`` is called."""
    mock = MagicMock()
    mock.execute.return_value = _mock_supabase_response(return_data)
    for method in ("select", "eq", "single", "order", "limit", "insert",
                   "update", "delete", "range", "gte", "lte", "in_"):
        getattr(mock, method).return_value = mock
    return mock


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@patch("app.routes.users.get_supabase_client_for_user")
def test_get_user_profile(mock_sb, user_client):
    profile_row = {
        "id": "test-user-id", "role": "user", "display_name": "Test",
        "home_zip": "10001",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(profile_row)
    mock_sb.return_value = client_mock

    resp = user_client.get("/api/v1/users/me")
    assert resp.status_code == 200
    assert resp.json()["id"] == "test-user-id"


@patch("app.routes.users.get_supabase_client_for_user")
def test_update_user_profile(mock_sb, user_client):
    updated_row = {
        "id": "test-user-id", "role": "user", "display_name": "New Name",
        "home_zip": "90210",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock([updated_row])
    mock_sb.return_value = client_mock

    resp = user_client.patch("/api/v1/users/me", json={"display_name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "New Name"


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

@patch("app.routes.users.get_supabase_client_for_user")
def test_list_favorites(mock_sb, user_client):
    rows = [{"event_id": "evt_1", "created_at": "2026-01-01T00:00:00+00:00"}]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(rows)
    mock_sb.return_value = client_mock

    resp = user_client.get("/api/v1/users/favorites")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("app.routes.users.get_supabase_client_for_user")
def test_add_favorite(mock_sb, user_client):
    inserted = [{"event_id": "evt_1", "created_at": "2026-01-01T00:00:00+00:00"}]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(inserted)
    mock_sb.return_value = client_mock

    resp = user_client.post("/api/v1/users/favorites", json={"event_id": "evt_1"})
    assert resp.status_code == 201


@patch("app.routes.users.get_supabase_client_for_user")
def test_remove_favorite(mock_sb, user_client):
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock([])
    mock_sb.return_value = client_mock

    resp = user_client.delete("/api/v1/users/favorites/evt_1")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Follows
# ---------------------------------------------------------------------------

@patch("app.routes.users.get_supabase_client_for_user")
def test_list_follows(mock_sb, user_client):
    rows = [{"artist_id": "art_1", "created_at": "2026-01-01T00:00:00+00:00"}]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(rows)
    mock_sb.return_value = client_mock

    resp = user_client.get("/api/v1/users/follows")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("app.routes.users.get_supabase_client_for_user")
def test_follow_artist(mock_sb, user_client):
    inserted = [{"artist_id": "art_1", "created_at": "2026-01-01T00:00:00+00:00"}]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(inserted)
    mock_sb.return_value = client_mock

    resp = user_client.post("/api/v1/users/follows", json={"artist_id": "art_1"})
    assert resp.status_code == 201


@patch("app.routes.users.get_supabase_client_for_user")
def test_unfollow_artist(mock_sb, user_client):
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock([])
    mock_sb.return_value = client_mock

    resp = user_client.delete("/api/v1/users/follows/art_1")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Venue profile (with mocked claim resolution)
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_client_for_user")
def test_get_venue_profile(mock_sb, mock_ids, venue_client):
    venue_row = {
        "id": "v1", "name": "My Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(venue_row)
    mock_sb.return_value = client_mock

    resp = venue_client.get("/api/v1/venues/mine")
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Venue"


@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue(mock_admin, venue_client):
    created_row = {
        "id": "v-new", "name": "New Venue", "description": "A great place",
        "address_line": None, "city": None, "state": None,
        "zip_code": "90210", "verified": False,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock([created_row])
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "New Venue", "description": "A great place", "zip_code": "90210"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Venue"


# ---------------------------------------------------------------------------
# Artist profile (with mocked claim resolution)
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_artist_ids", return_value=["a1"])
@patch("app.routes.artists.get_supabase_client_for_user")
def test_get_artist_profile(mock_sb, mock_ids, artist_client):
    artist_row = {
        "id": "a1", "stage_name": "DJ Test", "genre": "electronic",
        "bio": None, "media_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(artist_row)
    mock_sb.return_value = client_mock

    resp = artist_client.get("/api/v1/artists/mine")
    assert resp.status_code == 200
    assert resp.json()["stage_name"] == "DJ Test"


@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile(mock_admin, artist_client):
    created_row = {
        "id": "a-new", "stage_name": "New Artist", "genre": "rock",
        "bio": "Bio here", "media_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock([created_row])
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "New Artist", "genre": "rock", "bio": "Bio here"},
    )
    assert resp.status_code == 201
    assert resp.json()["stage_name"] == "New Artist"


# ---------------------------------------------------------------------------
# Venue event creation permissions
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_client_for_user")
def test_create_venue_event_requires_verified_venue(mock_sb, mock_ids, venue_client):
    venue_lookup = _chain_mock({"verified": False})
    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: venue_lookup if name == "venues" else _chain_mock([])
    mock_sb.return_value = client_mock

    resp = venue_client.post(
        "/api/v1/venues/events",
        json={
            "title": "Open Mic Night",
            "description": "A local talent night with rotating artists.",
            "category": "live-music",
            "start_time": "2030-06-01T18:00:00Z",
            "end_time": "2030-06-01T22:00:00Z",
            "zip_code": "10001",
        },
    )

    assert resp.status_code == 403
    assert "verified venues" in resp.json()["detail"].lower()


@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_client_for_user")
def test_create_venue_event_verified_venue_succeeds(mock_sb, mock_ids, venue_client):
    venue_lookup = _chain_mock({"verified": True})
    event_insert = _chain_mock({"id": "evt_new"})

    client_mock = MagicMock()
    client_mock.table.side_effect = lambda name: venue_lookup if name == "venues" else event_insert
    mock_sb.return_value = client_mock

    resp = venue_client.post(
        "/api/v1/venues/events",
        json={
            "title": "Open Mic Night",
            "description": "A local talent night with rotating artists.",
            "category": "live-music",
            "start_time": "2030-06-01T18:00:00Z",
            "end_time": "2030-06-01T22:00:00Z",
            "zip_code": "10001",
        },
    )

    assert resp.status_code == 200
    assert resp.json()["id"] == "evt_new"

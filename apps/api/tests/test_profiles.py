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
    for method in ("select", "eq", "single", "order", "limit", "insert", "upsert",
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
# Venue profile (with mocked managed-profile resolution)
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_admin_client")
def test_get_venue_profile(mock_admin, mock_ids, venue_client):
    venue_row = {
        "id": "v1", "name": "My Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(venue_row)
    mock_admin.return_value = admin_mock

    resp = venue_client.get("/api/v1/venues/mine")
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Venue"


@patch("app.routes.venues.get_managed_venue_ids", side_effect=[[], ["v-new"]])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue(mock_admin, mock_managed_ids, venue_client):
    created_row = {
        "id": "v-new", "name": "New Venue", "description": "A great place",
        "address_line": None, "city": None, "state": None,
        "zip_code": "90210", "verified": False,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    venues_chain = _chain_mock([created_row])
    venues_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        _mock_supabase_response(created_row),    # managed reload
    ]
    claims_chain = _chain_mock([])
    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "venues": venues_chain,
        "venue_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "New Venue", "description": "A great place", "zip_code": "90210"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Venue"


@patch("app.routes.venues.get_managed_venue_ids", return_value=["v-existing"])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_returns_existing_managed_profile(mock_admin, mock_managed_ids, venue_client):
    existing_row = {
        "id": "v-existing", "name": "Existing Venue", "description": "Already linked",
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    venues_chain = _chain_mock(existing_row)
    admin_mock = MagicMock()
    admin_mock.table.return_value = venues_chain
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Should Not Create", "zip_code": "10001"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "v-existing"
    venues_chain.insert.assert_not_called()


@patch("app.routes.venues.get_managed_venue_ids", return_value=["v-stale", "v-existing"])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_returns_first_resolvable_existing_profile(mock_admin, mock_managed_ids, venue_client):
    existing_row = {
        "id": "v-existing", "name": "Existing Venue", "description": "Already linked",
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    venues_chain = _chain_mock(None)
    venues_chain.execute.side_effect = [
        _mock_supabase_response(None),         # stale id lookup
        _mock_supabase_response(existing_row), # resolvable id lookup
    ]
    admin_mock = MagicMock()
    admin_mock.table.return_value = venues_chain
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Should Not Create", "zip_code": "10001"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "v-existing"
    venues_chain.insert.assert_not_called()


@patch("app.routes.venues.get_managed_venue_ids", side_effect=[[], ["v-new-2"]])
@patch("app.routes.venues.get_supabase_client_for_user")
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_claim_fallback_non_fatal(mock_admin, mock_user_sb, mock_managed_ids, venue_client):
    created_row = {
        "id": "v-new-2", "name": "Fallback Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    venues_chain = _chain_mock([created_row])
    venues_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        _mock_supabase_response(created_row),    # managed reload
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("insert blocked")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "venues": venues_chain,
        "venue_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    user_claim_chain = _chain_mock([{
        "id": "claim-v1",
        "venue_id": "v-new-2",
        "user_id": "test-user-id",
        "status": "pending",
    }])
    user_client = MagicMock()
    user_client.table.return_value = user_claim_chain
    mock_user_sb.return_value = user_client

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Fallback Venue", "zip_code": "10001"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "v-new-2"


@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_admin_client")
def test_update_venue_uses_admin_client(mock_admin, mock_ids, venue_client):
    updated_row = {
        "id": "v1", "name": "Venue Updated", "description": "Updated",
        "address_line": "123 Main St", "city": "Brooklyn", "state": "NY",
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(updated_row)
    mock_admin.return_value = admin_mock

    resp = venue_client.patch(
        "/api/v1/venues/mine",
        json={"name": "Venue Updated", "description": "Updated"},
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "Venue Updated"


@patch("app.routes.venues.get_managed_venue_ids", side_effect=[[], []])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_succeeds_when_direct_owner_link_is_confirmed(mock_admin, mock_managed_ids, venue_client):
    created_row = {
        "id": "v-direct", "name": "Direct Link Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    venues_chain = _chain_mock([created_row])
    venues_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),                                # insert
        _mock_supabase_response({"id": "v-direct", "owner_id": "test-user-id"}),  # owner link check
        _mock_supabase_response(created_row),                                  # direct reload
    ]
    claims_chain = _chain_mock([])

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "venues": venues_chain,
        "venue_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Direct Link Venue", "zip_code": "10001"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "v-direct"
    assert not venues_chain.delete.called


@patch("app.routes.venues.get_managed_venue_ids", side_effect=[[], []])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_succeeds_when_owner_inserted_but_link_check_query_fails(mock_admin, mock_managed_ids, venue_client):
    created_row = {
        "id": "v-owner-only", "name": "Owner Insert Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    venues_chain = _chain_mock([created_row])
    venues_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        Exception("owner link check failed"),    # owner link query
        _mock_supabase_response(created_row),    # fallback reload
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("claim insert failed")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "venues": venues_chain,
        "venue_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Owner Insert Venue", "zip_code": "10001"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "v-owner-only"
    assert not venues_chain.delete.called


@patch("app.routes.venues.get_managed_venue_ids", side_effect=[[], []])
@patch("app.routes.venues.get_supabase_admin_client")
def test_create_venue_returns_error_when_linkage_cannot_be_confirmed(mock_admin, mock_managed_ids, venue_client):
    created_row = {
        "id": "v-unlinked", "name": "Unlinked Venue", "description": None,
        "address_line": None, "city": None, "state": None,
        "zip_code": "10001", "verified": False,
        "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    venues_chain = _chain_mock([created_row])
    venues_chain.execute.side_effect = [
        Exception('column "owner_id" does not exist'),  # owner insert path fails
        _mock_supabase_response([created_row]),         # fallback insert without owner_id
        Exception("owner link check failed"),           # owner link query
        _mock_supabase_response([]),             # cleanup delete
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("claim insert failed")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "venues": venues_chain,
        "venue_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = venue_client.post(
        "/api/v1/venues/mine",
        json={"name": "Unlinked Venue", "zip_code": "10001"},
    )

    assert resp.status_code == 500
    assert "could not be linked" in resp.json()["detail"].lower()
    assert venues_chain.delete.called


# ---------------------------------------------------------------------------
# Artist profile (with mocked managed-profile resolution)
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_artist_ids", return_value=["a1"])
@patch("app.routes.artists.get_supabase_admin_client")
def test_get_artist_profile(mock_admin, mock_ids, artist_client):
    artist_row = {
        "id": "a1", "stage_name": "DJ Test", "genre": "electronic",
        "bio": None, "media_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(artist_row)
    mock_admin.return_value = admin_mock

    resp = artist_client.get("/api/v1/artists/mine")
    assert resp.status_code == 200
    assert resp.json()["stage_name"] == "DJ Test"


@patch("app.routes.artists.get_managed_artist_ids", side_effect=[[], ["a-new"]])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile(mock_admin, mock_managed_ids, artist_client):
    created_row = {
        "id": "a-new", "stage_name": "New Artist", "genre": "rock",
        "bio": "Bio here", "media_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    artists_chain = _chain_mock([created_row])
    artists_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        _mock_supabase_response(created_row),    # managed reload
    ]
    claims_chain = _chain_mock([])
    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "artists": artists_chain,
        "artist_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "New Artist", "genre": "rock", "bio": "Bio here"},
    )
    assert resp.status_code == 201
    assert resp.json()["stage_name"] == "New Artist"


@patch("app.routes.artists.get_managed_artist_ids", return_value=["a-existing"])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile_returns_existing_managed_profile(mock_admin, mock_managed_ids, artist_client):
    existing_row = {
        "id": "a-existing", "stage_name": "Existing Artist", "genre": "jazz",
        "bio": "Already linked", "media_url": None, "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    artists_chain = _chain_mock(existing_row)
    admin_mock = MagicMock()
    admin_mock.table.return_value = artists_chain
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Should Not Create", "genre": "rock"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "a-existing"
    artists_chain.insert.assert_not_called()


@patch("app.routes.artists.get_managed_artist_ids", return_value=["a-stale", "a-existing"])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_returns_first_resolvable_existing_profile(mock_admin, mock_managed_ids, artist_client):
    existing_row = {
        "id": "a-existing", "stage_name": "Existing Artist", "genre": "jazz",
        "bio": "Already linked", "media_url": None, "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    artists_chain = _chain_mock(None)
    artists_chain.execute.side_effect = [
        _mock_supabase_response(None),         # stale id lookup
        _mock_supabase_response(existing_row), # resolvable id lookup
    ]
    admin_mock = MagicMock()
    admin_mock.table.return_value = artists_chain
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Should Not Create", "genre": "rock"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "a-existing"
    artists_chain.insert.assert_not_called()


@patch("app.routes.artists.get_managed_artist_ids", side_effect=[[], ["a-new-2"]])
@patch("app.routes.artists.get_supabase_client_for_user")
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile_claim_fallback_non_fatal(mock_admin, mock_user_sb, mock_managed_ids, artist_client):
    created_row = {
        "id": "a-new-2", "stage_name": "Fallback Artist", "genre": "rock",
        "bio": None, "media_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    artists_chain = _chain_mock([created_row])
    artists_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        _mock_supabase_response(created_row),    # managed reload
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("insert blocked")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "artists": artists_chain,
        "artist_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    user_claim_chain = _chain_mock([{
        "id": "claim1",
        "artist_id": "a-new-2",
        "user_id": "test-user-id",
        "status": "pending",
    }])
    user_client = MagicMock()
    user_client.table.return_value = user_claim_chain
    mock_user_sb.return_value = user_client

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Fallback Artist", "genre": "rock"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "a-new-2"


@patch("app.core.auth.get_managed_artist_ids", return_value=["a1"])
@patch("app.routes.artists.get_supabase_admin_client")
def test_update_artist_profile_uses_admin_client(mock_admin, mock_ids, artist_client):
    updated_row = {
        "id": "a1",
        "stage_name": "Updated Artist",
        "genre": "electronic",
        "bio": "Updated bio",
        "media_url": None,
        "cover_image_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(updated_row)
    mock_admin.return_value = admin_mock

    resp = artist_client.patch(
        "/api/v1/artists/mine",
        json={"stage_name": "Updated Artist", "bio": "Updated bio"},
    )

    assert resp.status_code == 200
    assert resp.json()["stage_name"] == "Updated Artist"


@patch("app.routes.artists.get_managed_artist_ids", side_effect=[[], []])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile_succeeds_when_direct_owner_link_is_confirmed(mock_admin, mock_managed_ids, artist_client):
    created_row = {
        "id": "a-direct", "stage_name": "Direct Link Artist", "genre": "indie",
        "bio": None, "media_url": None, "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    artists_chain = _chain_mock([created_row])
    artists_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),                                # insert
        _mock_supabase_response({"id": "a-direct", "owner_id": "test-user-id"}),  # owner link check
        _mock_supabase_response(created_row),                                  # direct reload
    ]
    claims_chain = _chain_mock([])

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "artists": artists_chain,
        "artist_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Direct Link Artist", "genre": "indie"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "a-direct"
    assert not artists_chain.delete.called


@patch("app.routes.artists.get_managed_artist_ids", side_effect=[[], []])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile_succeeds_when_owner_inserted_but_link_check_query_fails(mock_admin, mock_managed_ids, artist_client):
    created_row = {
        "id": "a-owner-only", "stage_name": "Owner Insert Artist", "genre": "indie",
        "bio": None, "media_url": None, "cover_image_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    artists_chain = _chain_mock([created_row])
    artists_chain.execute.side_effect = [
        _mock_supabase_response([created_row]),  # insert
        Exception("owner link check failed"),    # owner link query
        _mock_supabase_response(created_row),    # fallback reload
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("claim insert failed")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "artists": artists_chain,
        "artist_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Owner Insert Artist", "genre": "indie"},
    )

    assert resp.status_code == 201
    assert resp.json()["id"] == "a-owner-only"
    assert not artists_chain.delete.called


@patch("app.routes.artists.get_managed_artist_ids", side_effect=[[], []])
@patch("app.routes.artists.get_supabase_admin_client")
def test_create_artist_profile_returns_error_when_linkage_cannot_be_confirmed(mock_admin, mock_managed_ids, artist_client):
    created_row = {
        "id": "a-unlinked", "stage_name": "Unlinked Artist", "genre": "rock",
        "bio": None, "media_url": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }

    profiles_chain = _chain_mock([{"id": "test-user-id"}])
    artists_chain = _chain_mock([created_row])
    artists_chain.execute.side_effect = [
        Exception('column "owner_id" does not exist'),  # owner insert path fails
        _mock_supabase_response([created_row]),         # fallback insert without owner_id
        Exception("owner link check failed"),           # owner link query
        _mock_supabase_response([]),             # cleanup delete
    ]
    claims_chain = _chain_mock([])
    claims_chain.execute.side_effect = Exception("claim insert failed")

    admin_mock = MagicMock()
    admin_mock.table.side_effect = lambda name: {
        "profiles": profiles_chain,
        "artists": artists_chain,
        "artist_claims": claims_chain,
    }[name]
    mock_admin.return_value = admin_mock

    resp = artist_client.post(
        "/api/v1/artists/mine",
        json={"stage_name": "Unlinked Artist", "genre": "rock"},
    )

    assert resp.status_code == 500
    assert "could not be linked" in resp.json()["detail"].lower()
    assert artists_chain.delete.called


# ---------------------------------------------------------------------------
# Venue event creation permissions
# ---------------------------------------------------------------------------

@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
@patch("app.routes.venues.get_supabase_client_for_user")
def test_create_venue_event_succeeds_without_verification_gate(mock_sb, mock_ids, venue_client):
    event_insert = _chain_mock({"id": "evt_new"})

    client_mock = MagicMock()
    client_mock.table.return_value = event_insert
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

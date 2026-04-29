"""Claim lifecycle tests: submit, list, admin review, access after approval."""

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
    mock = MagicMock()
    mock.execute.return_value = _mock_supabase_response(return_data)
    for method in ("select", "eq", "single", "order", "limit", "insert",
                   "update", "delete", "range", "gte", "lte", "in_"):
        getattr(mock, method).return_value = mock
    return mock


# ---------------------------------------------------------------------------
# Submit claims
# ---------------------------------------------------------------------------

@patch("app.routes.claims.get_supabase_client_for_user")
def test_submit_venue_claim(mock_sb, venue_client):
    inserted = [{
        "id": "vc1", "venue_id": "v1", "user_id": "test-user-id",
        "status": "pending", "reviewed_by": None, "reviewed_at": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(inserted)
    mock_sb.return_value = client_mock

    resp = venue_client.post("/api/v1/claims/venue-claims", json={"venue_id": "v1"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["venue_id"] == "v1"


@patch("app.routes.claims.get_supabase_client_for_user")
def test_submit_artist_claim(mock_sb, artist_client):
    inserted = [{
        "id": "ac1", "artist_id": "a1", "user_id": "test-user-id",
        "status": "pending", "reviewed_by": None, "reviewed_at": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }]
    client_mock = MagicMock()
    client_mock.table.return_value = _chain_mock(inserted)
    mock_sb.return_value = client_mock

    resp = artist_client.post("/api/v1/claims/artist-claims", json={"artist_id": "a1"})
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


# ---------------------------------------------------------------------------
# List own claims
# ---------------------------------------------------------------------------

@patch("app.routes.claims.get_supabase_client_for_user")
def test_list_my_claims(mock_sb, venue_client):
    vc_rows = [{
        "id": "vc1", "venue_id": "v1", "user_id": "test-user-id",
        "status": "pending", "reviewed_by": None, "reviewed_at": None,
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-01T00:00:00+00:00",
    }]

    client_mock = MagicMock()

    def _table_dispatch(name):
        if name == "venue_claims":
            return _chain_mock(vc_rows)
        return _chain_mock([])

    client_mock.table.side_effect = _table_dispatch
    mock_sb.return_value = client_mock

    resp = venue_client.get("/api/v1/claims/mine")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["venue_claims"]) == 1
    assert body["artist_claims"] == []


# ---------------------------------------------------------------------------
# Admin review
# ---------------------------------------------------------------------------

@patch("app.routes.claims.get_supabase_admin_client")
def test_admin_approve_venue_claim(mock_admin, admin_client):
    approved_row = [{
        "id": "vc1", "venue_id": "v1", "user_id": "test-user-id",
        "status": "approved", "reviewed_by": "admin-user-id",
        "reviewed_at": "2026-03-08T12:00:00+00:00",
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-08T12:00:00+00:00",
    }]
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(approved_row)
    mock_admin.return_value = admin_mock

    resp = admin_client.patch(
        "/api/v1/claims/venue-claims/vc1/review",
        json={"status": "approved"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["reviewed_by"] == "admin-user-id"


@patch("app.routes.claims.get_supabase_admin_client")
def test_admin_reject_artist_claim(mock_admin, admin_client):
    rejected_row = [{
        "id": "ac1", "artist_id": "a1", "user_id": "test-user-id",
        "status": "rejected", "reviewed_by": "admin-user-id",
        "reviewed_at": "2026-03-08T12:00:00+00:00",
        "created_at": "2026-03-01T00:00:00+00:00",
        "updated_at": "2026-03-08T12:00:00+00:00",
    }]
    admin_mock = MagicMock()
    admin_mock.table.return_value = _chain_mock(rejected_row)
    mock_admin.return_value = admin_mock

    resp = admin_client.patch(
        "/api/v1/claims/artist-claims/ac1/review",
        json={"status": "rejected"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


# -- Non-admin cannot review -----------------------------------------------

def test_venue_user_cannot_review_venue_claim(venue_client):
    resp = venue_client.patch(
        "/api/v1/claims/venue-claims/vc1/review",
        json={"status": "approved"},
    )
    assert resp.status_code == 403


def test_artist_user_cannot_review_artist_claim(artist_client):
    resp = artist_client.patch(
        "/api/v1/claims/artist-claims/ac1/review",
        json={"status": "approved"},
    )
    assert resp.status_code == 403


# -- Wrong role cannot submit claim ----------------------------------------

def test_user_role_cannot_submit_venue_claim(user_client):
    resp = user_client.post("/api/v1/claims/venue-claims", json={"venue_id": "v1"})
    assert resp.status_code == 403


def test_user_role_cannot_submit_artist_claim(user_client):
    resp = user_client.post("/api/v1/claims/artist-claims", json={"artist_id": "a1"})
    assert resp.status_code == 403


# -- No managed profile link denies venue/artist edit access ----------------

@patch("app.core.auth.get_managed_venue_ids", return_value=[])
def test_pending_claim_denied_venue_edit(mock_ids, venue_client):
    resp = venue_client.get("/api/v1/venues/mine")
    assert resp.status_code == 403
    assert "managed venue profile" in resp.json()["detail"].lower()


@patch("app.core.auth.get_managed_artist_ids", return_value=[])
def test_pending_claim_denied_artist_edit(mock_ids, artist_client):
    resp = artist_client.get("/api/v1/artists/mine")
    assert resp.status_code == 403
    assert "managed artist profile" in resp.json()["detail"].lower()

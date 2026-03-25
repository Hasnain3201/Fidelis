"""Verify that auth + role enforcement works across all endpoint groups."""

from unittest.mock import patch


# -- Public endpoints remain accessible without auth -----------------------

def test_health_no_auth(anon_client):
    resp = anon_client.get("/api/v1/health/")
    assert resp.status_code == 200


def test_events_search_no_auth(anon_client):
    resp = anon_client.get("/api/v1/events/search", params={"zip_code": "10001"})
    # Public endpoint should not require auth; if DB config is missing, service may return 503.
    assert resp.status_code in (200, 503)


def test_event_detail_no_auth(anon_client):
    resp = anon_client.get("/api/v1/events/evt_100")
    assert resp.status_code in (200, 404)


# -- Protected endpoints reject unauthenticated requests -------------------

def test_users_me_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/users/me")
    assert resp.status_code == 403  # HTTPBearer returns 403 when no creds


def test_venues_mine_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/venues/mine")
    assert resp.status_code == 403


def test_artists_mine_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/artists/mine")
    assert resp.status_code == 403


def test_favorites_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/users/favorites")
    assert resp.status_code == 403


def test_new_favorites_route_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/favorites/")
    assert resp.status_code == 403


def test_follows_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/users/follows")
    assert resp.status_code == 403


def test_claims_mine_requires_auth(anon_client):
    resp = anon_client.get("/api/v1/claims/mine")
    assert resp.status_code == 403


# -- Role mismatch returns 403 --------------------------------------------

def test_user_cannot_access_venue_mine(user_client):
    resp = user_client.get("/api/v1/venues/mine")
    assert resp.status_code == 403
    assert "venue" in resp.json()["detail"].lower()


def test_user_cannot_access_artist_mine(user_client):
    resp = user_client.get("/api/v1/artists/mine")
    assert resp.status_code == 403
    assert "artist" in resp.json()["detail"].lower()


def test_venue_cannot_access_favorites(venue_client):
    resp = venue_client.get("/api/v1/users/favorites")
    assert resp.status_code == 403


def test_venue_cannot_access_new_favorites_route(venue_client):
    resp = venue_client.get("/api/v1/favorites/")
    assert resp.status_code == 403


def test_artist_cannot_access_favorites(artist_client):
    resp = artist_client.get("/api/v1/users/favorites")
    assert resp.status_code == 403


def test_artist_cannot_access_new_favorites_route(artist_client):
    resp = artist_client.get("/api/v1/favorites/")
    assert resp.status_code == 403


def test_artist_cannot_create_venue_event(artist_client):
    resp = artist_client.post(
        "/api/v1/venues/events",
        json={
            "title": "Fake Event",
            "category": "live-music",
            "start_time": "2026-06-01T18:00:00Z",
            "end_time": "2026-06-01T22:00:00Z",
            "zip_code": "10001",
        },
    )
    assert resp.status_code == 403


def test_venue_cannot_access_artist_mine(venue_client):
    resp = venue_client.get("/api/v1/artists/mine")
    assert resp.status_code == 403


# -- Venue/artist without approved claim get 403 ---------------------------

@patch("app.core.auth.get_managed_venue_ids", return_value=[])
def test_venue_no_claim_denied(mock_ids, venue_client):
    resp = venue_client.get("/api/v1/venues/mine")
    assert resp.status_code == 403
    assert "claim" in resp.json()["detail"].lower()


@patch("app.core.auth.get_managed_artist_ids", return_value=[])
def test_artist_no_claim_denied(mock_ids, artist_client):
    resp = artist_client.get("/api/v1/artists/mine")
    assert resp.status_code == 403
    assert "claim" in resp.json()["detail"].lower()


# -- Correct role + claim is accepted (may 500 on unmocked Supabase) -------

@patch("app.core.auth.get_managed_venue_ids", return_value=["v1"])
def test_venue_with_claim_reaches_handler(mock_ids, venue_client):
    resp = venue_client.get("/api/v1/venues/mine")
    assert resp.status_code not in (401, 403)


@patch("app.core.auth.get_managed_artist_ids", return_value=["a1"])
def test_artist_with_claim_reaches_handler(mock_ids, artist_client):
    resp = artist_client.get("/api/v1/artists/mine")
    assert resp.status_code not in (401, 403)


def test_user_can_reach_profile(user_client):
    resp = user_client.get("/api/v1/users/me")
    assert resp.status_code not in (401, 403)


# -- Non-admin cannot review claims ----------------------------------------

def test_venue_cannot_review_claim(venue_client):
    resp = venue_client.patch(
        "/api/v1/claims/venue-claims/fake-id/review",
        json={"status": "approved"},
    )
    assert resp.status_code == 403


def test_user_cannot_review_claim(user_client):
    resp = user_client.patch(
        "/api/v1/claims/artist-claims/fake-id/review",
        json={"status": "approved"},
    )
    assert resp.status_code == 403

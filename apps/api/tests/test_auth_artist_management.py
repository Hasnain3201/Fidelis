from uuid import UUID
from unittest.mock import MagicMock, patch

from app.core.auth import get_managed_artist_ids


def _mock_response(data):
    resp = MagicMock()
    resp.data = data
    return resp


def _table_chain(data):
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = _mock_response(data)
    return chain


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_prefers_owner_ids_before_claim_ids(mock_get_admin):
    claims_chain = _table_chain([{"artist_id": "artist-claim"}])
    owners_chain = _table_chain([{"id": "artist-owner"}])
    existing_chain = _table_chain([{"id": "artist-owner"}, {"id": "artist-claim"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-owner", "artist-claim"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_accepts_pending_claims(mock_get_admin):
    claims_chain = _table_chain([{"artist_id": "artist-pending"}])
    owners_chain = _table_chain([])
    existing_chain = _table_chain([{"id": "artist-pending"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-pending"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_falls_back_to_owner_id(mock_get_admin):
    claims_chain = _table_chain([])
    owners_chain = _table_chain([{"id": "artist-owned"}])
    existing_chain = _table_chain([{"id": "artist-owned"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-owned"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_dedupes_claim_and_owner_records(mock_get_admin):
    claims_chain = _table_chain([{"artist_id": "artist-shared"}])
    owners_chain = _table_chain([{"id": "artist-shared"}])
    existing_chain = _table_chain([{"id": "artist-shared"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-shared"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_filters_stale_records(mock_get_admin):
    claims_chain = _table_chain([{"artist_id": "artist-stale-claim"}])
    owners_chain = _table_chain([{"id": "artist-live-owner"}, {"id": "artist-stale-owner"}])
    existing_chain = _table_chain([{"id": "artist-live-owner"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-live-owner"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_normalizes_uuid_ids(mock_get_admin):
    artist_id = UUID("11111111-1111-1111-1111-111111111111")
    claims_chain = _table_chain([{"artist_id": artist_id}])
    owners_chain = _table_chain([])
    existing_chain = _table_chain([{"id": str(artist_id)}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == [str(artist_id)]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_artist_ids_falls_back_to_profile_managed_link(mock_get_admin):
    claims_chain = _table_chain([])
    owners_chain = _table_chain([])
    profiles_chain = _table_chain([])
    profiles_chain.execute.return_value = _mock_response({"managed_artist_id": "artist-profile-link"})
    existing_chain = _table_chain([{"id": "artist-profile-link"}])

    admin = MagicMock()
    artists_calls = {"count": 0}

    def _table(name: str):
        if name == "artist_claims":
            return claims_chain
        if name == "profiles":
            return profiles_chain
        if name == "artists":
            artists_calls["count"] += 1
            return owners_chain if artists_calls["count"] == 1 else existing_chain
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_artist_ids("user-1") == ["artist-profile-link"]

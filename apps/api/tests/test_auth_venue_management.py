from uuid import UUID
from unittest.mock import MagicMock, patch

from app.core.auth import get_managed_venue_ids


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
def test_get_managed_venue_ids_prefers_owner_ids_before_claim_ids(mock_get_admin):
    claims_chain = _table_chain([{"venue_id": "venue-claim"}])
    owners_chain = _table_chain([{"id": "venue-owner"}])
    existing_chain = _table_chain([{"id": "venue-owner"}, {"id": "venue-claim"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-owner", "venue-claim"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_accepts_pending_claims(mock_get_admin):
    claims_chain = _table_chain([{"venue_id": "venue-pending"}])
    owners_chain = _table_chain([])
    existing_chain = _table_chain([{"id": "venue-pending"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-pending"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_falls_back_to_owner_id(mock_get_admin):
    claims_chain = _table_chain([])
    owners_chain = _table_chain([{"id": "venue-owned"}])
    existing_chain = _table_chain([{"id": "venue-owned"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-owned"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_dedupes_claim_and_owner_records(mock_get_admin):
    claims_chain = _table_chain([{"venue_id": "venue-shared"}])
    owners_chain = _table_chain([{"id": "venue-shared"}])
    existing_chain = _table_chain([{"id": "venue-shared"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-shared"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_filters_stale_records(mock_get_admin):
    claims_chain = _table_chain([{"venue_id": "venue-stale-claim"}])
    owners_chain = _table_chain([{"id": "venue-live-owner"}, {"id": "venue-stale-owner"}])
    existing_chain = _table_chain([{"id": "venue-live-owner"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-live-owner"]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_normalizes_uuid_ids(mock_get_admin):
    venue_id = UUID("22222222-2222-2222-2222-222222222222")
    claims_chain = _table_chain([{"venue_id": venue_id}])
    owners_chain = _table_chain([])
    existing_chain = _table_chain([{"id": str(venue_id)}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        if name == "profiles":
            return _table_chain([])
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == [str(venue_id)]


@patch("app.db.supabase_admin.get_supabase_admin_client")
def test_get_managed_venue_ids_falls_back_to_profile_managed_link(mock_get_admin):
    claims_chain = _table_chain([])
    owners_chain = _table_chain([])
    profiles_chain = _table_chain([])
    profiles_chain.execute.return_value = _mock_response({"managed_venue_id": "venue-profile-link"})
    existing_chain = _table_chain([{"id": "venue-profile-link"}])

    admin = MagicMock()
    venues_calls = {"count": 0}

    def _table(name: str):
        if name == "venue_claims":
            return claims_chain
        if name == "profiles":
            return profiles_chain
        if name == "venues":
            venues_calls["count"] += 1
            return owners_chain if venues_calls["count"] == 1 else existing_chain
        raise AssertionError(f"Unexpected table lookup: {name}")

    admin.table.side_effect = _table
    mock_get_admin.return_value = admin

    assert get_managed_venue_ids("user-1") == ["venue-profile-link"]

from unittest.mock import MagicMock, patch


def _mock_supabase_response(data):
    response = MagicMock()
    response.data = data
    return response


def _chain_mock(return_data):
    chain = MagicMock()
    chain.execute.return_value = _mock_supabase_response(return_data)
    for method in ("select", "order", "limit", "eq", "ilike"):
        getattr(chain, method).return_value = chain
    return chain


@patch("app.routes.venues.get_supabase_client")
def test_public_list_venues(mock_get_client, anon_client):
    rows = [
        {
            "id": "v1",
            "name": "Blue Room",
            "description": None,
            "address_line": None,
            "city": "New York",
            "state": "NY",
            "zip_code": "10001",
            "verified": True,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        }
    ]
    client = MagicMock()
    client.table.return_value = _chain_mock(rows)
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("app.routes.venues.get_supabase_client")
def test_public_list_venues_returns_503_on_query_failure(mock_get_client, anon_client):
    failing_chain = MagicMock()
    for method in ("select", "order", "limit", "eq", "ilike"):
        getattr(failing_chain, method).return_value = failing_chain
    failing_chain.execute.side_effect = RuntimeError("network unavailable")

    client = MagicMock()
    client.table.return_value = failing_chain
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/")
    assert resp.status_code == 503


@patch("app.routes.artists.get_supabase_client")
def test_public_list_artists(mock_get_client, anon_client):
    rows = [
        {
            "id": "a1",
            "stage_name": "DJ Nova",
            "genre": "electronic",
            "bio": None,
            "media_url": None,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        }
    ]
    client = MagicMock()
    client.table.return_value = _chain_mock(rows)
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/artists/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@patch("app.routes.artists.get_supabase_client")
def test_public_list_artists_returns_503_on_query_failure(mock_get_client, anon_client):
    failing_chain = MagicMock()
    for method in ("select", "order", "limit", "eq", "ilike"):
        getattr(failing_chain, method).return_value = failing_chain
    failing_chain.execute.side_effect = RuntimeError("network unavailable")

    client = MagicMock()
    client.table.return_value = failing_chain
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/artists/")
    assert resp.status_code == 503

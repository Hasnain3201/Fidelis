from unittest.mock import MagicMock, patch


def _mock_supabase_response(data):
    response = MagicMock()
    response.data = data
    return response


def _chain_mock(return_data):
    chain = MagicMock()
    chain.execute.return_value = _mock_supabase_response(return_data)
    for method in ("select", "order", "limit", "range", "eq", "ilike"):
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
def test_public_list_venues_allows_scraped_venue_without_zip(mock_get_client, anon_client):
    rows = [
        {
            "id": "v1",
            "name": "Scraped Venue",
            "description": None,
            "address_line": None,
            "city": None,
            "state": None,
            "zip_code": None,
            "verified": False,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        }
    ]
    client = MagicMock()
    client.table.return_value = _chain_mock(rows)
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/")

    assert resp.status_code == 200
    assert resp.json()[0]["zip_code"] is None


@patch("app.routes.venues.get_supabase_client")
def test_public_list_venues_returns_503_on_query_failure(mock_get_client, anon_client):
    failing_chain = MagicMock()
    for method in ("select", "order", "limit", "range", "eq", "ilike"):
        getattr(failing_chain, method).return_value = failing_chain
    failing_chain.execute.side_effect = RuntimeError("network unavailable")

    client = MagicMock()
    client.table.return_value = failing_chain
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/")
    assert resp.status_code == 503


@patch("app.routes.venues.get_supabase_client")
def test_search_venues_ignores_verified_filter_param_for_compat(mock_get_client, anon_client):
    rows = [
        {
            "id": "v1",
            "name": "Blue Room",
            "description": None,
            "address_line": None,
            "city": "New York",
            "state": "NY",
            "zip_code": "10001",
            "verified": False,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        },
        {
            "id": "v2",
            "name": "Red Hall",
            "description": None,
            "address_line": None,
            "city": "Brooklyn",
            "state": "NY",
            "zip_code": "11201",
            "verified": True,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        },
    ]
    chain = _chain_mock(rows)
    client = MagicMock()
    client.table.return_value = chain
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/search", params={"verified": "true"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 2

    eq_calls = [call.args for call in chain.eq.call_args_list]
    assert not any(args and args[0] == "verified" for args in eq_calls)


@patch("app.routes.venues.get_supabase_client")
def test_search_venues_allows_scraped_venue_without_zip(mock_get_client, anon_client):
    rows = [
        {
            "id": "v1",
            "name": "Scraped Venue",
            "description": None,
            "address_line": None,
            "city": None,
            "state": None,
            "zip_code": None,
            "verified": False,
            "created_at": "2026-03-01T00:00:00+00:00",
            "updated_at": "2026-03-01T00:00:00+00:00",
        }
    ]
    chain = _chain_mock(rows)
    chain.execute.return_value.count = 1
    client = MagicMock()
    client.table.return_value = chain
    mock_get_client.return_value = client

    resp = anon_client.get("/api/v1/venues/search", params={"query": "scraped"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["items"][0]["zip_code"] is None
    assert body["total"] == 1


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

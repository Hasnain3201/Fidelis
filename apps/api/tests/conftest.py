from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthContext, get_auth_context
from main import app


def _auth_override(user_id: str = "test-user-id", role: str = "user"):
    """Return a dependency override that injects a fake AuthContext."""

    def _override():
        return AuthContext(
            user_id=user_id,
            role=role,
            claims={"sub": user_id},
            access_token="fake-test-token",
        )

    return _override


@pytest.fixture()
def anon_client():
    """Client with *no* auth override — requests carry no token."""
    app.dependency_overrides.pop(get_auth_context, None)
    yield TestClient(app)
    app.dependency_overrides.pop(get_auth_context, None)


@pytest.fixture()
def user_client():
    """Client authenticated as role=user."""
    app.dependency_overrides[get_auth_context] = _auth_override(role="user")
    yield TestClient(app)
    app.dependency_overrides.pop(get_auth_context, None)


@pytest.fixture()
def venue_client():
    """Client authenticated as role=venue."""
    app.dependency_overrides[get_auth_context] = _auth_override(role="venue")
    yield TestClient(app)
    app.dependency_overrides.pop(get_auth_context, None)


@pytest.fixture()
def artist_client():
    """Client authenticated as role=artist."""
    app.dependency_overrides[get_auth_context] = _auth_override(role="artist")
    yield TestClient(app)
    app.dependency_overrides.pop(get_auth_context, None)


@pytest.fixture()
def admin_client():
    """Client authenticated as role=admin."""
    app.dependency_overrides[get_auth_context] = _auth_override(
        user_id="admin-user-id", role="admin",
    )
    yield TestClient(app)
    app.dependency_overrides.pop(get_auth_context, None)

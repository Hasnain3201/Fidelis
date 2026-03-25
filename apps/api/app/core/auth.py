from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.jwks import verify_supabase_jwt

bearer = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user_id: str
    role: str
    claims: dict
    access_token: str


def _resolve_role_from_db(user_id: str) -> Optional[str]:
    """Fetch the canonical role from the profiles table.  Returns None when
    the lookup cannot be performed (missing admin client, missing row, etc.)."""
    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return None
        response = (
            admin.table("profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = response.data
        if data and "role" in data:
            return data["role"]
        return None
    except Exception:
        return None


def get_auth_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> AuthContext:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authenticated",
        )

    token = credentials.credentials

    try:
        payload = verify_supabase_jwt(token)
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise ValueError("Missing sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    db_role = _resolve_role_from_db(sub)
    if db_role is not None:
        role = db_role
    else:
        meta = payload.get("user_metadata") or {}
        role = meta.get("role", "user") if isinstance(meta, dict) else "user"

    return AuthContext(user_id=sub, role=role, claims=payload, access_token=token)


def require_user_id(auth: AuthContext = Depends(get_auth_context)) -> str:
    """Backward-compatible dependency that returns just the user_id string."""
    return auth.user_id


def require_role(required_role: str):
    """Return a dependency that enforces the caller has *required_role* (admin
    is always allowed).  Returns the full AuthContext on success."""

    def _role_dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if auth.role != required_role and auth.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required",
            )
        return auth

    return _role_dependency


# ---------------------------------------------------------------------------
# Claim helpers
# ---------------------------------------------------------------------------

def _get_approved_claim_ids(
    user_id: str, claim_table: str, entity_id_column: str,
) -> list[str]:
    """Return entity IDs for which the user holds an approved claim.
    Uses the admin client so the query is not limited by per-user RLS."""
    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return []
        response = (
            admin.table(claim_table)
            .select(entity_id_column)
            .eq("user_id", user_id)
            .eq("status", "approved")
            .execute()
        )
        return [row[entity_id_column] for row in (response.data or [])]
    except Exception:
        return []


def get_managed_venue_ids(user_id: str) -> list[str]:
    """Venue IDs the user has an approved claim for."""
    return _get_approved_claim_ids(user_id, "venue_claims", "venue_id")


def get_managed_artist_ids(user_id: str) -> list[str]:
    """Artist IDs the user has an approved claim for."""
    return _get_approved_claim_ids(user_id, "artist_claims", "artist_id")


def require_managed_venue(auth: AuthContext = Depends(require_role("venue"))) -> tuple[AuthContext, str]:
    """Dependency that enforces role=venue AND at least one approved venue
    claim.  Returns (auth, venue_id) for the first managed venue."""
    ids = get_managed_venue_ids(auth.user_id)
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No approved venue claim found. Submit and get a claim approved first.",
        )
    return auth, ids[0]


def require_managed_artist(auth: AuthContext = Depends(require_role("artist"))) -> tuple[AuthContext, str]:
    """Dependency that enforces role=artist AND at least one approved artist
    claim.  Returns (auth, artist_id) for the first managed artist."""
    ids = get_managed_artist_ids(auth.user_id)
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No approved artist claim found. Submit and get a claim approved first.",
        )
    return auth, ids[0]

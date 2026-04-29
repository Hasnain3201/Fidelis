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

def _normalize_id(value: object) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    return normalized


def _get_claim_ids(
    user_id: str,
    claim_table: str,
    entity_id_column: str,
    *,
    status_filter: Optional[str] = "approved",
) -> list[str]:
    """Return entity IDs for claims owned by the user.

    By default this returns only approved claims. Pass ``status_filter=None``
    to return all claims regardless of status.
    """
    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return []
        base_query = (
            admin.table(claim_table)
            .select(entity_id_column)
            .eq("user_id", user_id)
        )
        if status_filter is not None:
            base_query = base_query.eq("status", status_filter)

        try:
            response = base_query.order("created_at", desc=True).execute()
        except Exception:
            # Compatibility fallback for environments that do not expose
            # created_at on claim tables.
            response = base_query.execute()

        ids: list[str] = []
        for row in (response.data or []):
            if not isinstance(row, dict):
                continue
            entity_id = _normalize_id(row.get(entity_id_column))
            if entity_id:
                ids.append(entity_id)
        return ids
    except Exception:
        return []


def _get_owned_ids(user_id: str, entity_table: str) -> list[str]:
    """Return legacy owner-linked entity IDs for the user."""
    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return []
        base_query = (
            admin.table(entity_table)
            .select("id")
            .eq("owner_id", user_id)
        )

        try:
            response = base_query.order("updated_at", desc=True).execute()
        except Exception:
            # Compatibility fallback for environments that do not expose
            # updated_at on owner-linked entities.
            response = base_query.execute()

        ids: list[str] = []
        for row in (response.data or []):
            if not isinstance(row, dict):
                continue
            entity_id = _normalize_id(row.get("id"))
            if entity_id:
                ids.append(entity_id)
        return ids
    except Exception:
        # owner_id may not exist in every migrated environment
        return []


def _get_profile_managed_id(user_id: str, column: str) -> Optional[str]:
    """Read managed entity fallback from the user's profile row."""
    if column not in {"managed_venue_id", "managed_artist_id"}:
        return None

    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return None

        response = (
            admin.table("profiles")
            .select(column)
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = response.data or {}
        if not isinstance(data, dict):
            return None
        return _normalize_id(data.get(column))
    except Exception:
        return None


def _merge_unique_ids(*id_lists: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for ids in id_lists:
        for raw_entity_id in ids:
            entity_id = _normalize_id(raw_entity_id)
            if not entity_id:
                continue
            if entity_id in seen:
                continue
            seen.add(entity_id)
            merged.append(entity_id)
    return merged


def _get_existing_entity_ids(entity_table: str, ids: list[str]) -> list[str]:
    """Best-effort filter for stale IDs that no longer exist."""
    normalized_ids = _merge_unique_ids(ids)
    if not normalized_ids:
        return []

    try:
        from app.db.supabase_admin import get_supabase_admin_client

        admin = get_supabase_admin_client()
        if admin is None:
            return normalized_ids

        response = (
            admin.table(entity_table)
            .select("id")
            .in_("id", normalized_ids)
            .execute()
        )
        existing_ids = {
            normalized
            for row in (response.data or [])
            if isinstance(row, dict)
            for normalized in [_normalize_id(row.get("id"))]
            if normalized
        }
        return [entity_id for entity_id in normalized_ids if entity_id in existing_ids]
    except Exception:
        # Fall back to original IDs if existence check cannot be performed.
        return normalized_ids


def get_managed_venue_ids(user_id: str) -> list[str]:
    """Venue IDs the user can manage.

    Compatibility behavior:
    1) legacy owner link via ``venues.owner_id`` (preferred)
    2) any claim status in ``venue_claims`` (approval not required)
    """
    owned_ids = _get_owned_ids(user_id, "venues")
    claim_ids = _get_claim_ids(user_id, "venue_claims", "venue_id", status_filter=None)
    profile_linked_id = _get_profile_managed_id(user_id, "managed_venue_id")
    profile_linked_ids = [profile_linked_id] if profile_linked_id else []
    merged = _merge_unique_ids(owned_ids, claim_ids, profile_linked_ids)
    return _get_existing_entity_ids("venues", merged)


def get_managed_artist_ids(user_id: str) -> list[str]:
    """Artist IDs the user can manage.

    Compatibility behavior:
    1) legacy owner link via ``artists.owner_id`` (preferred)
    2) any claim status in ``artist_claims`` (approval not required)
    """
    owned_ids = _get_owned_ids(user_id, "artists")
    claim_ids = _get_claim_ids(user_id, "artist_claims", "artist_id", status_filter=None)
    profile_linked_id = _get_profile_managed_id(user_id, "managed_artist_id")
    profile_linked_ids = [profile_linked_id] if profile_linked_id else []
    merged = _merge_unique_ids(owned_ids, claim_ids, profile_linked_ids)
    return _get_existing_entity_ids("artists", merged)


def require_managed_venue(auth: AuthContext = Depends(require_role("venue"))) -> tuple[AuthContext, str]:
    """Dependency that enforces role=venue and resolves the first managed venue."""
    ids = get_managed_venue_ids(auth.user_id)
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managed venue profile not found. Create your venue profile first.",
        )
    return auth, ids[0]


def require_managed_artist(auth: AuthContext = Depends(require_role("artist"))) -> tuple[AuthContext, str]:
    """Dependency that enforces role=artist and resolves the first managed artist."""
    ids = get_managed_artist_ids(auth.user_id)
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Managed artist profile not found. Create your artist profile first.",
        )
    return auth, ids[0]

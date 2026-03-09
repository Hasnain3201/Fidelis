from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

from app.core.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url)


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    jwk_client = _jwks_client()
    signing_key = jwk_client.get_signing_key_from_jwt(token).key

    return jwt.decode(
        token,
        signing_key,
        algorithms=["ES256", "RS256"],
        issuer=f"{settings.supabase_url}/auth/v1",
        options={"verify_aud": False},
    )

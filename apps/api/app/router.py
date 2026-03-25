from fastapi import APIRouter, Depends

from app.core.auth import get_auth_context
from app.routes import profiles, favorites, follows, artists, claims, events, health, venues, auth, users

api_router = APIRouter()

# Public route groups (no auth required)
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(auth.router)

# Authenticated route groups
_auth_required = [Depends(get_auth_context)]

api_router.include_router(
    profiles.router, prefix="/profiles", tags=["profiles"], dependencies=_auth_required
)
api_router.include_router(
    users.router, prefix="/users", tags=["users"], dependencies=_auth_required
)
api_router.include_router(
    favorites.router, prefix="/favorites", tags=["favorites"], dependencies=_auth_required
)
api_router.include_router(
    follows.router, prefix="/follows", tags=["follows"], dependencies=_auth_required
)
api_router.include_router(
    venues.router, prefix="/venues", tags=["venues"], dependencies=_auth_required,
)
api_router.include_router(
    artists.router, prefix="/artists", tags=["artists"],
)
api_router.include_router(
    claims.router, prefix="/claims", tags=["claims"], dependencies=_auth_required,
)

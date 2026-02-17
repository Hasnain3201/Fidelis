from fastapi import APIRouter

from app.api.routes import artists, events, health, users, venues

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(venues.router, prefix="/venues", tags=["venues"])
api_router.include_router(artists.router, prefix="/artists", tags=["artists"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

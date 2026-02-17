from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

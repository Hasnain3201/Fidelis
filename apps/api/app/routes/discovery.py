"""Admin-only endpoints for venue + event auto-discovery by ZIP code and radius."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import require_role
from app.services.scraper.queue_service import QueueService

router = APIRouter()
logger = logging.getLogger(__name__)

_admin = Depends(require_role("admin"))


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class DiscoveryRunRequest(BaseModel):
    zip_code: str = Field(..., min_length=3, max_length=10, description="US ZIP code")
    radius_miles: int = Field(default=10, ge=1, le=200, description="Search radius in miles")
    upcoming_only: bool = Field(default=False, description="If true, only return future events from Ticketmaster")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run", dependencies=[_admin])
async def run_discovery(body: DiscoveryRunRequest):
    """Discover venues and events near a ZIP code.

    Queries Ticketmaster, Foursquare, and OpenStreetMap in parallel.
    Ticketmaster data is saved immediately. All discovered venue website
    URLs are queued for AI scraping by the background worker.
    """
    from app.services.discovery_service import DiscoveryService
    import asyncio

    try:
        svc = DiscoveryService()
        result = await asyncio.to_thread(svc.run, body.zip_code, body.radius_miles, body.upcoming_only)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Discovery run failed for ZIP %s", body.zip_code)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Discovery failed: {exc}",
        )


@router.get("/status/{batch_id}", dependencies=[_admin])
async def discovery_status(batch_id: str):
    """Return the scrape job statuses for a discovery batch.

    Uses the existing scrape_jobs queue — no new table needed.
    """
    try:
        queue = QueueService()
        jobs = queue.list_jobs(batch_id=batch_id, limit=500)
        total = len(jobs)
        by_status: dict[str, int] = {}
        for job in jobs:
            s = job.get("status") or "unknown"
            by_status[s] = by_status.get(s, 0) + 1
        return {
            "batch_id": batch_id,
            "total_jobs": total,
            "by_status": by_status,
            "jobs": jobs,
        }
    except Exception as exc:
        logger.exception("Failed to fetch discovery status for batch %s", batch_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

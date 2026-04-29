"""Admin-only endpoints that trigger web scraping and manage notifications."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl

from app.core.auth import AuthContext, require_role

router = APIRouter()
logger = logging.getLogger(__name__)

_admin = Depends(require_role("admin"))


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    url: HttpUrl
    venue_id: Optional[str] = None  # optional hint when scraping for an existing venue
    enable_render: bool = False
    multi_page: bool = True


class UnifiedScrapeResult(BaseModel):
    success: bool
    detail: str | None = None
    venue_id: str | None = None
    venue_action: str | None = None  # "created" | "merged" | None
    saved: int = 0       # new events inserted
    updated: int = 0     # existing events merged
    skipped: int = 0     # stale/invalid events
    event_ids: list[str] = []
    artists_created: int = 0
    artists_merged: int = 0
    artist_ids: list[str] = []
    links_created: int = 0
    data: dict | None = None  # raw AI extraction (venue/events/artists) — useful for debugging
    content_preview: dict | None = None


class ScrapePreviewResponse(BaseModel):
    success: bool
    content_preview: dict
    detail: str | None = None


class WorkerStatusResponse(BaseModel):
    is_running: bool
    jobs_processed: int
    max_jobs: Optional[int] = None
    current_url: Optional[str] = None


class WorkerStartRequest(BaseModel):
    max_jobs: Optional[int] = Field(None, ge=1)


class WorkerStartResponse(BaseModel):
    started: bool
    is_running: bool
    max_jobs: Optional[int] = None


# ---------------------------------------------------------------------------
# Scrape endpoints
# ---------------------------------------------------------------------------

@router.post("/scrape/preview", response_model=ScrapePreviewResponse)
def scrape_content_preview_only(
    body: ScrapeRequest,
    auth: AuthContext = _admin,
) -> ScrapePreviewResponse:
    """Fetch and parse URL only (no AI, no DB). Used by the admin Content Preview tab."""
    from app.services.scraper import ScraperService
    from app.services.scraper.utils import build_content_preview

    url = str(body.url)
    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render)
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

    preview = build_content_preview(raw)
    return ScrapePreviewResponse(success=True, content_preview=preview)


def _run_unified_scrape(body: ScrapeRequest, dry_run: bool, user_id: str | None = None) -> UnifiedScrapeResult:
    """Synchronous unified scrape — used by both /scrape/venues and /scrape/events."""
    from app.services.scraper.worker import _run_job

    job = {
        "url": str(body.url),
        "mode": "unified",
        "enable_render": body.enable_render,
        "multi_page": body.multi_page,
        "dry_run": dry_run,
        "venue_id_hint": body.venue_id,
    }

    try:
        result = _run_job(job)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if result.get("unreachable"):
        raise HTTPException(status_code=502, detail=result.get("reason") or "URL unreachable")

    if dry_run:
        return UnifiedScrapeResult(
            success=True,
            detail="dry_run=true (no Supabase writes)",
            data={
                "venue": result.get("venue"),
                "events": result.get("events") or [],
                "artists": result.get("artists") or [],
            },
            content_preview=result.get("content_preview"),
        )

    return UnifiedScrapeResult(
        success=True,
        venue_id=result.get("venue_id"),
        venue_action=result.get("venue_action"),
        saved=result.get("saved", 0),
        updated=result.get("updated", 0),
        skipped=result.get("skipped", 0),
        event_ids=result.get("event_ids") or [],
        artists_created=result.get("artists_created", 0),
        artists_merged=result.get("artists_merged", 0),
        artist_ids=result.get("artist_ids") or [],
        links_created=result.get("links_created", 0),
        data={
            "events": result.get("events") or [],
            "artists": result.get("artists") or [],
        },
        content_preview=result.get("content_preview"),
    )


@router.post("/scrape", response_model=UnifiedScrapeResult)
def scrape_unified(
    body: ScrapeRequest,
    dry_run: bool = Query(False, description="If true, do not write to Supabase; return AI extraction only."),
    auth: AuthContext = _admin,
) -> UnifiedScrapeResult:
    """Unified scrape: extract venue + events + artists from any URL in one call."""
    return _run_unified_scrape(body, dry_run, user_id=auth.user_id)


# Legacy aliases — both old endpoints now run the unified flow.
@router.post("/scrape/venues", response_model=UnifiedScrapeResult)
def scrape_venue_legacy(
    body: ScrapeRequest,
    dry_run: bool = Query(False),
    auth: AuthContext = _admin,
) -> UnifiedScrapeResult:
    return _run_unified_scrape(body, dry_run, user_id=auth.user_id)


@router.post("/scrape/events", response_model=UnifiedScrapeResult)
def scrape_events_legacy(
    body: ScrapeRequest,
    dry_run: bool = Query(False),
    auth: AuthContext = _admin,
) -> UnifiedScrapeResult:
    return _run_unified_scrape(body, dry_run, user_id=auth.user_id)


# ---------------------------------------------------------------------------
# Queue endpoints (durable, worker-driven scraping)
# ---------------------------------------------------------------------------


class EnqueueBatchRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1)
    enable_render: bool = False
    multi_page: bool = True
    dry_run: bool = False
    venue_id: Optional[str] = None  # optional hint forwarded to the worker


class EnqueueBatchResponse(BaseModel):
    success: bool = True
    batch_id: str
    job_ids: list[str]


class JobListResponse(BaseModel):
    jobs: list[dict]
    count: int


@router.post("/queue", response_model=EnqueueBatchResponse)
def enqueue_scrape_batch(
    body: EnqueueBatchRequest,
    auth: AuthContext = _admin,
) -> EnqueueBatchResponse:
    """Enqueue a batch of URLs for the worker to scrape one-by-one (unified extraction)."""
    from app.services.scraper.queue_service import QueueService

    try:
        result = QueueService().enqueue_batch(
            urls=body.urls,
            enable_render=body.enable_render,
            multi_page=body.multi_page,
            dry_run=body.dry_run,
            venue_id_hint=body.venue_id,
            created_by=auth.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return EnqueueBatchResponse(
        success=True,
        batch_id=result["batch_id"],
        job_ids=result["job_ids"],
    )


@router.get("/queue", response_model=JobListResponse)
def list_scrape_jobs(
    status: Optional[str] = Query(None, description="Filter by status (pending|in_progress|completed|failed)"),
    batch_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    auth: AuthContext = _admin,
) -> JobListResponse:
    from app.services.scraper.queue_service import QueueService

    try:
        jobs = QueueService().list_jobs(status=status, batch_id=batch_id, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return JobListResponse(jobs=jobs, count=len(jobs))


@router.get("/queue/counts")
def queue_counts(auth: AuthContext = _admin) -> dict[str, int]:
    """Total row counts per status — used by the UI to show truncation."""
    from app.services.scraper.queue_service import QueueService

    return QueueService().count_by_status()


@router.get("/queue/{job_id}")
def get_scrape_job(
    job_id: str,
    auth: AuthContext = _admin,
) -> dict:
    from app.services.scraper.queue_service import QueueService

    job = QueueService().get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found")
    return job


@router.post("/queue/{job_id}/rescrape")
def rescrape_scrape_job(
    job_id: str,
    auth: AuthContext = _admin,
) -> dict:
    """Re-run an existing scrape job synchronously (in-place) and return the updated row.

    Unlike enqueue, this does NOT create a new queue entry — it updates the existing
    row's status, result, and content_preview so the UI shows fresh data on the same card.
    """
    from app.services.scraper.queue_service import QueueService
    from app.services.scraper.worker import _run_job

    queue = QueueService()
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        result = _run_job(job)
        content_preview = result.pop("content_preview", None) if isinstance(result, dict) else None
        queue.mark_completed(job_id, result=result, content_preview=content_preview)
    except Exception as exc:
        queue.mark_failed(job_id, str(exc))
        updated = queue.get_job(job_id)
        return {"success": False, "job": updated, "error": str(exc)}

    updated = queue.get_job(job_id)
    return {"success": True, "job": updated}


@router.delete("/queue/{job_id}")
def delete_scrape_job(
    job_id: str,
    auth: AuthContext = _admin,
) -> dict:
    from app.services.scraper.queue_service import QueueService

    ok = QueueService().delete_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scrape job not found")
    return {"success": True}


@router.delete("/queue")
def clear_scrape_queue(
    status: Optional[str] = Query(None, description="Only clear jobs with this status. Omit to clear all."),
    auth: AuthContext = _admin,
) -> dict:
    from app.services.scraper.queue_service import QueueService

    try:
        deleted = QueueService().clear_jobs(status=status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# Worker control endpoints
# ---------------------------------------------------------------------------


@router.get("/worker/status", response_model=WorkerStatusResponse)
async def get_worker_status(auth: AuthContext = _admin) -> WorkerStatusResponse:
    """Return the current state of the in-process scrape worker."""
    from app.services.scraper.worker import get_worker

    w = get_worker()
    return WorkerStatusResponse(
        is_running=w.is_running,
        jobs_processed=w.jobs_processed,
        max_jobs=w.max_jobs,
        current_url=w.current_url,
    )


@router.post("/worker/start", response_model=WorkerStartResponse)
async def start_worker_endpoint(
    body: Optional[WorkerStartRequest] = Body(default=None),
    auth: AuthContext = _admin,
) -> WorkerStartResponse:
    """Start the scrape worker. No-op if already running.
    Pass max_jobs to auto-stop after N jobs (stop first to change a running limit)."""
    from app.services.scraper.worker import get_worker

    w = get_worker()
    max_jobs = body.max_jobs if body else None
    started = await w.start(max_jobs=max_jobs)
    return WorkerStartResponse(started=started, is_running=w.is_running, max_jobs=w.max_jobs)


@router.post("/worker/stop", response_model=WorkerStatusResponse)
async def stop_worker_endpoint(auth: AuthContext = _admin) -> WorkerStatusResponse:
    """Stop the scrape worker gracefully (waits up to 10s for current job)."""
    from app.services.scraper.worker import get_worker

    w = get_worker()
    await w.stop()
    return WorkerStatusResponse(
        is_running=w.is_running,
        jobs_processed=w.jobs_processed,
        max_jobs=w.max_jobs,
        current_url=w.current_url,
    )


# ---------------------------------------------------------------------------
# Notifications CRUD
# ---------------------------------------------------------------------------

@router.get("/notifications")
def list_notifications(
    limit: int = Query(50, ge=1, le=500),
    unread_only: bool = Query(False),
    auth: AuthContext = _admin,
) -> dict:
    from app.repositories.notifications import NotificationRepository

    items = NotificationRepository().list(limit=limit, unread_only=unread_only)
    return {"notifications": items, "count": len(items)}


@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    auth: AuthContext = _admin,
) -> dict:
    from app.repositories.notifications import NotificationRepository

    ok = NotificationRepository().mark_read(notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    auth: AuthContext = _admin,
) -> dict:
    from app.repositories.notifications import NotificationRepository

    ok = NotificationRepository().delete(notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

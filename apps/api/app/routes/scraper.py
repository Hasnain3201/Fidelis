"""Admin-only endpoints that trigger web scraping and manage notifications."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, HttpUrl

from app.core.auth import AuthContext, require_role

router = APIRouter()
logger = logging.getLogger(__name__)

_admin = Depends(require_role("admin"))


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ScrapeVenueRequest(BaseModel):
    url: HttpUrl
    enable_render: bool = False
    multi_page: bool = True


class ScrapeEventsRequest(BaseModel):
    url: HttpUrl
    venue_id: Optional[str] = None
    enable_render: bool = False
    multi_page: bool = True


class ScrapeResult(BaseModel):
    success: bool
    detail: str | None = None
    venue_id: str | None = None
    action: str | None = None
    data: dict | None = None
    # Raw page snapshot (text, contacts, meta, JSON-LD) for admin content preview.
    content_preview: dict | None = None


class ScrapeEventsResult(BaseModel):
    success: bool
    detail: str | None = None
    venue_id: str | None = None
    saved: int = 0
    updated: int = 0
    skipped: int = 0
    event_ids: list[str] = []
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
    current_mode: Optional[str] = None


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
    body: ScrapeVenueRequest,
    auth: AuthContext = _admin,
) -> ScrapePreviewResponse:
    """Fetch and parse URL only (no AI, no DB). Same raw fields as scraper-old Content Preview step."""
    from app.services.scraper import ScraperService
    from app.services.scraper.utils import build_content_preview

    url = str(body.url)
    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render)
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

    preview = build_content_preview(raw)
    return ScrapePreviewResponse(success=True, content_preview=preview)


@router.post("/scrape/venues", response_model=ScrapeResult)
def scrape_venue(
    body: ScrapeVenueRequest,
    dry_run: bool = Query(False, description="If true, do not write to Supabase; return would-be insert payload."),
    auth: AuthContext = _admin,
) -> ScrapeResult:
    """Scrape a venue URL, extract structured data via AI, and save to Supabase."""
    from app.services.scraper import ScraperService, AIService
    from app.services.scraper.utils import build_content_preview, map_venue_to_supabase
    from app.repositories.venues import VenueRepository
    from app.repositories.notifications import NotificationRepository

    url = str(body.url)

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render, multi_page=body.multi_page, mode="venue")
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

    content_preview = build_content_preview(raw)

    ai = AIService()
    structured = ai.process_venue_data(raw)
    if "error" in structured:
        raise HTTPException(status_code=502, detail=structured["error"])

    structured["scraped_at"] = datetime.now(timezone.utc).isoformat()
    structured["source_url"] = url

    if not structured.get("description") and content_preview.get("description"):
        structured["description"] = content_preview["description"]

    if dry_run:
        payload = map_venue_to_supabase(structured, url)
        logger.info("SCRAPER_DRY_RUN venue payload: %s", payload)
        return ScrapeResult(
            success=True,
            detail="dry_run=true (no Supabase writes)",
            data=payload,
            content_preview=content_preview,
        )

    repo = VenueRepository()
    result = repo.save_venue(structured, url)

    try:
        NotificationRepository().create(
            type=f"venue_{result['action']}",
            entity_type="venue",
            entity_id=result["venue_id"],
            entity_name=structured.get("venue_name") or structured.get("name"),
            message=f"Venue {result['action']} from {url}",
        )
    except Exception:
        logger.warning("Failed to create notification", exc_info=True)

    return ScrapeResult(
        success=True,
        venue_id=result["venue_id"],
        action=result["action"],
        data=structured,
        content_preview=content_preview,
    )


@router.post("/scrape/events", response_model=ScrapeEventsResult)
def scrape_events(
    body: ScrapeEventsRequest,
    dry_run: bool = Query(False, description="If true, do not write to Supabase; return would-be insert payloads."),
    auth: AuthContext = _admin,
) -> ScrapeEventsResult:
    """Scrape an events-listing URL, extract via AI, and save to Supabase."""
    from app.services.scraper import ScraperService, AIService
    from app.services.scraper.utils import (
        build_content_preview,
        map_event_to_supabase,
        map_venue_to_supabase,
    )
    from app.repositories.venues import VenueRepository
    from app.repositories.events import EventRepository
    from app.repositories.notifications import NotificationRepository

    url = str(body.url)

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render, multi_page=body.multi_page, mode="events")
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

    content_preview = build_content_preview(raw)

    ai = AIService()
    ai_result = ai.process_events_data(raw)
    if "error" in ai_result:
        raise HTTPException(status_code=502, detail=ai_result["error"])

    venue_id = body.venue_id
    venue_name: str | None = None
    venue_repo = VenueRepository()

    # If the AI found venue info, save/merge it first to get a UUID
    ai_venue = ai_result.get("venue")
    if ai_venue and not venue_id:
        venue_desc = ai_venue.get("description") or content_preview.get("description") or None
        mapped_venue = {
            "venue_name": ai_venue.get("name") or ai_venue.get("venue_name"),
            "description": venue_desc,
            "venue_address": ai_venue.get("address") or {},
            "website": ai_venue.get("website") or url,
            "source_url": url,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if dry_run:
            venue_payload = map_venue_to_supabase(mapped_venue, url)
        else:
            v_result = venue_repo.save_venue(mapped_venue, url)
            venue_id = v_result["venue_id"]
            venue_name = mapped_venue.get("venue_name")
    elif venue_id:
        v = venue_repo.get_venue(venue_id)
        venue_name = v["name"] if v else None

    events = ai_result.get("events") or []

    if dry_run:
        event_payloads = [
            map_event_to_supabase(ev, venue_id, venue_name, url)
            for ev in events
            if isinstance(ev, dict)
        ]
        logger.info("SCRAPER_DRY_RUN venue_payload: %s", locals().get("venue_payload"))
        logger.info("SCRAPER_DRY_RUN event_payloads: %s", event_payloads)
        return ScrapeEventsResult(
            success=True,
            detail="dry_run=true (no Supabase writes)",
            venue_id=venue_id,
            saved=0,
            updated=0,
            skipped=0,
            event_ids=[],
            content_preview=content_preview,
        )

    event_repo = EventRepository()
    summary = event_repo.save_events(events, venue_id, venue_name, url)

    try:
        notif = NotificationRepository()
        for eid in summary.get("event_ids", []):
            notif.create(
                type="event_created",
                entity_type="event",
                entity_id=eid,
                message=f"Event saved from {url}",
            )
    except Exception:
        logger.warning("Failed to create notifications", exc_info=True)

    return ScrapeEventsResult(
        success=True,
        venue_id=venue_id,
        saved=summary["saved"],
        updated=summary["updated"],
        skipped=summary["skipped"],
        event_ids=summary["event_ids"],
        content_preview=content_preview,
    )


# ---------------------------------------------------------------------------
# Queue endpoints (durable, worker-driven scraping)
# ---------------------------------------------------------------------------


class EnqueueBatchRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1)
    mode: Literal["venue", "events"]
    enable_render: bool = False
    multi_page: bool = True
    dry_run: bool = False
    venue_id: Optional[str] = None  # only meaningful for events mode


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
    """Enqueue a batch of URLs for the worker to scrape one-by-one."""
    from app.services.scraper.queue_service import QueueService

    try:
        result = QueueService().enqueue_batch(
            urls=body.urls,
            mode=body.mode,
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
        current_mode=w.current_mode,
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
        current_mode=w.current_mode,
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

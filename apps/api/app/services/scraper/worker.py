"""In-process async worker that drains the scrape_jobs queue.

Started from FastAPI's lifespan hook (see main.py). Uses a single asyncio
task that runs scraper jobs strictly one at a time, matching the user
requirement of sequential processing. Synchronous scraper code is offloaded
to a thread via ``asyncio.to_thread`` so it doesn't block the event loop.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


_IDLE_SLEEP_SECONDS = 2.0


# ---------------------------------------------------------------------------
# Sync entry point: runs in a worker thread for one job
# ---------------------------------------------------------------------------


def _run_job(job: dict) -> dict:
    """Execute a single scrape job synchronously. Returns the result dict to
    persist on the row. Raises on failure (worker catches)."""
    from app.repositories.events import EventRepository
    from app.repositories.notifications import NotificationRepository
    from app.repositories.venues import VenueRepository
    from app.services.scraper import AIService, ScraperService
    from app.services.scraper.utils import (
        build_content_preview,
        map_event_to_supabase,
        map_venue_to_supabase,
    )

    url = job["url"]
    mode = job["mode"]
    enable_render = bool(job.get("enable_render", False))
    dry_run = bool(job.get("dry_run", False))
    venue_id_hint = job.get("venue_id_hint")

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=enable_render)
    if "error" in raw:
        raise RuntimeError(f"fetch_failed: {raw['error']}")

    content_preview = build_content_preview(raw)

    ai = AIService()

    if mode == "venue":
        structured = ai.process_venue_data(raw)
        if "error" in structured:
            raise RuntimeError(f"ai_failed: {structured['error']}")

        structured["scraped_at"] = datetime.now(timezone.utc).isoformat()
        structured["source_url"] = url

        if not structured.get("description") and content_preview.get("description"):
            structured["description"] = content_preview["description"]

        if dry_run:
            payload = map_venue_to_supabase(structured, url)
            return {
                "mode": "venue",
                "dry_run": True,
                "structured": structured,
                "payload": payload,
                "content_preview": content_preview,
            }

        repo = VenueRepository()
        save_result = repo.save_venue(structured, url)

        try:
            NotificationRepository().create(
                type=f"venue_{save_result['action']}",
                entity_type="venue",
                entity_id=save_result["venue_id"],
                entity_name=structured.get("venue_name") or structured.get("name"),
                message=f"Venue {save_result['action']} from {url}",
            )
        except Exception:
            logger.warning("Failed to create venue notification", exc_info=True)

        return {
            "mode": "venue",
            "dry_run": False,
            "venue_id": save_result["venue_id"],
            "action": save_result["action"],
            "structured": structured,
            "content_preview": content_preview,
        }

    if mode == "events":
        ai_result = ai.process_events_data(raw)
        if "error" in ai_result:
            raise RuntimeError(f"ai_failed: {ai_result['error']}")

        venue_id = venue_id_hint
        venue_name: str | None = None
        venue_repo = VenueRepository()

        ai_venue = ai_result.get("venue")
        if ai_venue and not venue_id:
            venue_desc = ai_venue.get("description") or content_preview.get("description") or None
            mapped_venue = {
                "venue_name": ai_venue.get("venue_name") or ai_venue.get("name"),
                "venue_address": ai_venue.get("venue_address") or ai_venue.get("address") or {},
                "website": ai_venue.get("website") or url,
                "description": venue_desc,
                "venue_type": ai_venue.get("venue_type"),
                "primary_contact": ai_venue.get("primary_contact") or {},
                "social_links": ai_venue.get("social_links") or {},
                "phone_number": ai_venue.get("phone_number"),
                "email": ai_venue.get("email"),
                "capacity": ai_venue.get("capacity"),
                "confidence_score": ai_venue.get("confidence_score"),
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
            return {
                "mode": "events",
                "dry_run": True,
                "venue_id": venue_id,
                "events": events,
                "event_payloads": event_payloads,
                "content_preview": content_preview,
            }

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
            logger.warning("Failed to create event notifications", exc_info=True)

        return {
            "mode": "events",
            "dry_run": False,
            "venue_id": venue_id,
            "saved": summary["saved"],
            "updated": summary["updated"],
            "skipped": summary["skipped"],
            "event_ids": summary["event_ids"],
            "events": events,
            "content_preview": content_preview,
        }

    raise ValueError(f"Unknown mode '{mode}'")


# ---------------------------------------------------------------------------
# Async worker loop
# ---------------------------------------------------------------------------


class ScrapeWorker:
    """Owns the asyncio task that drains the queue."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        # Reset stale in_progress jobs from any previous run.
        try:
            from app.services.scraper.queue_service import QueueService

            reset_count = await asyncio.to_thread(QueueService().reset_stale_in_progress)
            if reset_count:
                logger.info("Reset %d stale in_progress scrape jobs", reset_count)
        except Exception:
            logger.warning("Failed to reset stale scrape jobs", exc_info=True)

        self._task = asyncio.create_task(self._run_loop(), name="scrape-worker")
        logger.info("Scrape worker started")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=10)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()
            self._task = None
        logger.info("Scrape worker stopped")

    async def _run_loop(self) -> None:
        from app.services.scraper.queue_service import QueueService

        queue = QueueService()
        while not self._stop_event.is_set():
            try:
                job = await asyncio.to_thread(queue.claim_next_pending)
            except Exception:
                logger.exception("Queue claim failed; sleeping before retry")
                await self._sleep_or_stop(_IDLE_SLEEP_SECONDS * 2)
                continue

            if not job:
                await self._sleep_or_stop(_IDLE_SLEEP_SECONDS)
                continue

            job_id = job["id"]
            logger.info("Scrape worker picked up job %s (%s %s)", job_id, job["mode"], job["url"])

            try:
                result = await asyncio.to_thread(_run_job, job)
                content_preview = result.pop("content_preview", None) if isinstance(result, dict) else None
                await asyncio.to_thread(
                    queue.mark_completed,
                    job_id,
                    result=result,
                    content_preview=content_preview,
                )
                logger.info("Scrape job %s completed", job_id)
            except Exception as exc:
                logger.exception("Scrape job %s failed", job_id)
                try:
                    await asyncio.to_thread(queue.mark_failed, job_id, str(exc))
                except Exception:
                    logger.exception("Also failed to record failure for job %s", job_id)

    async def _sleep_or_stop(self, seconds: float) -> None:
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            return


_worker: ScrapeWorker | None = None


def get_worker() -> ScrapeWorker:
    global _worker
    if _worker is None:
        _worker = ScrapeWorker()
    return _worker


async def start_worker() -> None:
    await get_worker().start()


async def stop_worker() -> None:
    await get_worker().stop()

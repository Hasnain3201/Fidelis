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
    from app.repositories.artists import ArtistRepository
    from app.repositories.events import EventRepository
    from app.repositories.notifications import NotificationRepository
    from app.repositories.venues import VenueRepository
    from app.services.scraper import AIService, ScraperService
    from app.services.scraper.utils import (
        build_content_preview,
        compute_fingerprint,
    )

    url = job["url"]
    enable_render = bool(job.get("enable_render", False))
    multi_page = bool(job.get("multi_page", True))
    dry_run = bool(job.get("dry_run", False))
    venue_id_hint = job.get("venue_id_hint")

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=enable_render, multi_page=multi_page)
    if "error" in raw:
        # The scrape ran but the URL is unreachable (404, DNS, timeout, etc.).
        # Mark as completed-but-unreachable rather than failed: the worker did its job.
        return {
            "unreachable": True,
            "reason": raw["error"],
            "content_preview": None,
        }

    content_preview = build_content_preview(raw)

    ai = AIService()
    unified = ai.process_unified_data(raw)
    if "error" in unified:
        raise RuntimeError(f"ai_failed: {unified['error']}")

    scraped_at = datetime.now(timezone.utc).isoformat()
    venue_payload = unified.get("venue")
    events = unified.get("events") or []
    artists = unified.get("artists") or []

    if dry_run:
        return {
            "dry_run": True,
            "venue": venue_payload,
            "events": events,
            "artists": artists,
            "content_preview": content_preview,
        }

    # ------------------------------------------------------------------
    # 1) Venue: upsert if extracted, otherwise fall back to job hint
    # ------------------------------------------------------------------
    venue_id: str | None = venue_id_hint
    venue_name: str | None = None
    venue_action: str | None = None
    venue_repo = VenueRepository()

    if venue_payload:
        venue_data = dict(venue_payload)
        if not venue_data.get("description") and content_preview.get("description"):
            venue_data["description"] = content_preview["description"]
        venue_data["source_url"] = url
        venue_data["scraped_at"] = scraped_at
        v_result = venue_repo.save_venue(venue_data, url)
        venue_id = v_result["venue_id"]
        venue_action = v_result["action"]
        venue_name = venue_data.get("venue_name") or venue_data.get("name")
    elif venue_id:
        v = venue_repo.get_venue(venue_id)
        venue_name = v["name"] if v else None

    # ------------------------------------------------------------------
    # 2) Events: bulk dedup + smart merge
    # ------------------------------------------------------------------
    event_repo = EventRepository()
    event_summary = event_repo.save_events(events, venue_id, venue_name, url)

    # ------------------------------------------------------------------
    # 3) Artists: upsert each, building stage_name -> artist_id map
    # ------------------------------------------------------------------
    artist_repo = ArtistRepository()
    artist_lookup: dict[str, str] = {}
    artists_created = 0
    artists_merged = 0
    for a in artists:
        if not isinstance(a, dict):
            continue
        result = artist_repo.upsert_artist(a)
        if not result:
            continue
        stage_name = (a.get("stage_name") or "").strip().lower()
        if stage_name:
            artist_lookup[stage_name] = result["artist_id"]
        if result["action"] == "created":
            artists_created += 1
        elif result["action"] == "merged":
            artists_merged += 1

    # ------------------------------------------------------------------
    # 4) Linking: for each saved event, link known artists via event_artists
    # ------------------------------------------------------------------
    links_created = 0
    for ev in events:
        if not isinstance(ev, dict):
            continue
        artist_names = ev.get("artists") or []
        if not artist_names:
            continue
        title = ev.get("title") or ev.get("name") or "Untitled"
        start = ev.get("start_datetime") or ev.get("start_time") or ev.get("start") or ""
        ev_venue = ev.get("venue_name") or venue_name or ""
        fp = compute_fingerprint(title, start, ev_venue)
        saved_row = event_repo._find_by_fingerprint(fp)
        if not saved_row:
            continue
        event_id = saved_row["id"]
        for name in artist_names:
            if not isinstance(name, str):
                continue
            artist_id = artist_lookup.get(name.strip().lower())
            if not artist_id:
                continue
            if artist_repo.link_event_artist(event_id, artist_id):
                links_created += 1

    # ------------------------------------------------------------------
    # 5) Notifications (best-effort)
    # ------------------------------------------------------------------
    try:
        notif = NotificationRepository()
        if venue_id and venue_action:
            notif.create(
                type=f"venue_{venue_action}",
                entity_type="venue",
                entity_id=venue_id,
                entity_name=venue_name,
                message=f"Venue {venue_action} from {url}",
            )
        for eid in event_summary.get("event_ids", []):
            notif.create(
                type="event_created",
                entity_type="event",
                entity_id=eid,
                message=f"Event saved from {url}",
            )
    except Exception:
        logger.warning("Failed to create scrape notifications", exc_info=True)

    return {
        "dry_run": False,
        "venue_id": venue_id,
        "venue_action": venue_action,
        "saved": event_summary["saved"],
        "updated": event_summary["updated"],
        "skipped": event_summary["skipped"],
        "event_ids": event_summary["event_ids"],
        "artists_created": artists_created,
        "artists_merged": artists_merged,
        "artist_ids": list(artist_lookup.values()),
        "links_created": links_created,
        "events": events,
        "artists": artists,
        "content_preview": content_preview,
    }


# ---------------------------------------------------------------------------
# Async worker loop
# ---------------------------------------------------------------------------


class ScrapeWorker:
    """Owns the asyncio task that drains the queue."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._max_jobs: Optional[int] = None
        self._jobs_processed: int = 0
        self._current_url: Optional[str] = None

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def jobs_processed(self) -> int:
        return self._jobs_processed

    @property
    def max_jobs(self) -> Optional[int]:
        return self._max_jobs

    @property
    def current_url(self) -> Optional[str]:
        return self._current_url

    async def start(self, max_jobs: Optional[int] = None) -> bool:
        if self._task and not self._task.done():
            return False
        self._stop_event.clear()
        self._jobs_processed = 0
        self._max_jobs = max_jobs
        # Reset stale in_progress jobs from any previous run.
        try:
            from app.services.scraper.queue_service import QueueService

            reset_count = await asyncio.to_thread(QueueService().reset_stale_in_progress)
            if reset_count:
                logger.info("Reset %d stale in_progress scrape jobs", reset_count)
        except Exception:
            logger.warning("Failed to reset stale scrape jobs", exc_info=True)

        self._task = asyncio.create_task(self._run_loop(), name="scrape-worker")
        logger.info("Scrape worker started (max_jobs=%s)", max_jobs)
        return True

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
            logger.info("Scrape worker picked up job %s (%s)", job_id, job["url"])
            self._current_url = job.get("url")

            job_processed = False
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
            finally:
                job_processed = True
                self._current_url = None

            if job_processed:
                self._jobs_processed += 1
                if self._max_jobs is not None and self._jobs_processed >= self._max_jobs:
                    logger.info("Scrape worker reached max_jobs=%d; stopping.", self._max_jobs)
                    self._stop_event.set()
                    break

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


async def start_worker(max_jobs: Optional[int] = None) -> bool:
    return await get_worker().start(max_jobs=max_jobs)


async def stop_worker() -> None:
    await get_worker().stop()

"""Admin-only endpoints that trigger web scraping and manage notifications."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, HttpUrl

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


class ScrapeEventsRequest(BaseModel):
    url: HttpUrl
    venue_id: Optional[str] = None
    enable_render: bool = False


class ScrapeResult(BaseModel):
    success: bool
    detail: str | None = None
    venue_id: str | None = None
    action: str | None = None
    data: dict | None = None


class ScrapeEventsResult(BaseModel):
    success: bool
    detail: str | None = None
    venue_id: str | None = None
    saved: int = 0
    updated: int = 0
    skipped: int = 0
    event_ids: list[str] = []


# ---------------------------------------------------------------------------
# Scrape endpoints
# ---------------------------------------------------------------------------

@router.post("/scrape/venues", response_model=ScrapeResult)
def scrape_venue(
    body: ScrapeVenueRequest,
    dry_run: bool = Query(False, description="If true, do not write to Supabase; return would-be insert payload."),
    auth: AuthContext = _admin,
) -> ScrapeResult:
    """Scrape a venue URL, extract structured data via AI, and save to Supabase."""
    from app.services.scraper import ScraperService, AIService
    from app.services.scraper.utils import map_venue_to_supabase
    from app.repositories.venues import VenueRepository
    from app.repositories.notifications import NotificationRepository

    url = str(body.url)

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render)
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

    ai = AIService()
    structured = ai.process_venue_data(raw)
    if "error" in structured:
        raise HTTPException(status_code=502, detail=structured["error"])

    structured["scraped_at"] = datetime.now(timezone.utc).isoformat()
    structured["source_url"] = url

    if dry_run:
        payload = map_venue_to_supabase(structured, url)
        logger.info("SCRAPER_DRY_RUN venue payload: %s", payload)
        return ScrapeResult(success=True, detail="dry_run=true (no Supabase writes)", data=payload)

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
    )


@router.post("/scrape/events", response_model=ScrapeEventsResult)
def scrape_events(
    body: ScrapeEventsRequest,
    dry_run: bool = Query(False, description="If true, do not write to Supabase; return would-be insert payloads."),
    auth: AuthContext = _admin,
) -> ScrapeEventsResult:
    """Scrape an events-listing URL, extract via AI, and save to Supabase."""
    from app.services.scraper import ScraperService, AIService
    from app.services.scraper.utils import map_event_to_supabase, map_venue_to_supabase
    from app.repositories.venues import VenueRepository
    from app.repositories.events import EventRepository
    from app.repositories.notifications import NotificationRepository

    url = str(body.url)

    scraper = ScraperService()
    raw = scraper.extract_venue_data(url, enable_render=body.enable_render)
    if "error" in raw:
        raise HTTPException(status_code=502, detail=raw["error"])

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
        mapped_venue = {
            "venue_name": ai_venue.get("name") or ai_venue.get("venue_name"),
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

"""Fetch nearby events from Ticketmaster Discovery API and Eventbrite (preview only, no DB)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

TICKETMASTER_EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
EVENTBRITE_SEARCH_URL = "https://www.eventbriteapi.com/v3/events/search/"


def _ticketmaster_event_brief(ev: dict[str, Any]) -> dict[str, Any]:
    dates = ev.get("dates") or {}
    start = dates.get("start") or {}
    emb = ev.get("_embedded") or {}
    venues = emb.get("venues") or []
    venue_name = None
    if venues and isinstance(venues[0], dict):
        venue_name = venues[0].get("name")
    return {
        "id": ev.get("id"),
        "name": ev.get("name"),
        "url": ev.get("url"),
        "local_date": start.get("localDate"),
        "local_time": start.get("localTime"),
        "date_time_utc": start.get("dateTime"),
        "venue_name": venue_name,
    }


def summarize_ticketmaster_response(data: Any) -> dict[str, Any]:
    """Human-readable slice so clients see counts + titles without hunting in raw HAL JSON."""
    if not isinstance(data, dict):
        return {"note": "Response was not a JSON object; see raw data.", "events": []}
    page = data.get("page") or {}
    embedded = data.get("_embedded") or {}
    events = embedded.get("events")
    if not isinstance(events, list):
        events = []
    return {
        "page_number": page.get("number"),
        "page_size": page.get("size"),
        "total_elements": page.get("totalElements"),
        "total_pages": page.get("totalPages"),
        "events_in_response": len(events),
        "events": [_ticketmaster_event_brief(e) for e in events if isinstance(e, dict)],
    }


def _safe_json(response: requests.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return response.text


def fetch_ticketmaster_events_by_zip(
    zip_code: str,
    *,
    country_code: str = "US",
    size: int = 50,
    api_key: str | None = None,
    upcoming_only: bool = True,
) -> dict[str, Any]:
    """Call Ticketmaster Discovery event search by postal code.

    Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
    """
    key = (api_key or settings.ticketmaster_api_key or "").strip()
    if not key:
        return {
            "ok": False,
            "error": "Missing TICKETMASTER_API_KEY or TICKETMASTER_CONSUMER_KEY in environment.",
        }

    z = zip_code.strip()
    if not z:
        return {"ok": False, "error": "zip_code is required"}

    params: dict[str, str | int] = {
        "apikey": key,
        "postalCode": z,
        "size": min(max(size, 1), 200),
        "sort": "date,asc",
        "radius": "100",
        "unit": "miles",
    }
    if country_code:
        params["countryCode"] = country_code.upper()
    # Omitting startDateTime can return more rows (including undated TBA); stricter when True.
    if upcoming_only:
        start_after = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        params["startDateTime"] = start_after

    try:
        resp = requests.get(
            TICKETMASTER_EVENTS_URL,
            params=params,
            timeout=30,
        )
        body = _safe_json(resp)
        if resp.status_code >= 400:
            return {
                "ok": False,
                "status_code": resp.status_code,
                "error": body if isinstance(body, str) else body,
            }
        summary = summarize_ticketmaster_response(body)
        out: dict[str, Any] = {
            "ok": True,
            "status_code": resp.status_code,
            "data": body,
            "summary": summary,
        }
        if summary.get("total_elements") == 0 and upcoming_only:
            out["hint"] = (
                "Ticketmaster returned zero events for this ZIP with upcoming_only=true. "
                "Try ticketmaster_upcoming_only=false, confirm country_code matches the postal "
                "format, or widen search (another ZIP / city keyword)."
            )
        return out
    except requests.RequestException as e:
        logger.warning("Ticketmaster request failed: %s", e)
        return {"ok": False, "error": str(e)}


EVENTBRITE_DEPRECATED_SEARCH_NOTE = (
    "Eventbrite public GET /v3/events/search/ is deprecated or restricted for many tokens. "
    "You can still use the Eventbrite API for organizations you own (list org events), "
    "orders, webhooks, etc. - see https://www.eventbrite.com/platform/api - not the event-schedule "
    "reference you linked (that is for managing schedules on events you control)."
)


def fetch_eventbrite_organization_events(
    organization_id: str,
    *,
    page_size: int = 50,
    token: str | None = None,
) -> dict[str, Any]:
    """GET /v3/organizations/{id}/events/ — events for an org your token can access."""
    tok = (token or settings.eventbrite_api_token or "").strip()
    oid = organization_id.strip()
    if not tok:
        return {
            "ok": False,
            "error": "Missing EVENTBRITE_API_KEY (OAuth private token) in environment.",
        }
    if not oid:
        return {"ok": False, "error": "organization_id is required"}

    url = f"https://www.eventbriteapi.com/v3/organizations/{oid}/events/"
    params: dict[str, str | int] = {
        "page_size": min(max(page_size, 1), 50),
        "status": "live",
        "order_by": "start_asc",
    }
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {tok}"},
            params=params,
            timeout=30,
        )
        body = _safe_json(resp)
        if resp.status_code >= 400:
            return {
                "ok": False,
                "status_code": resp.status_code,
                "error": body if isinstance(body, str) else body,
                "note": EVENTBRITE_DEPRECATED_SEARCH_NOTE,
            }
        events: list[Any] = []
        if isinstance(body, dict) and isinstance(body.get("events"), list):
            events = body["events"]
        summary = {
            "source": "organization_events",
            "organization_id": oid,
            "events_in_response": len(events),
            "events": [
                {
                    "id": e.get("id") if isinstance(e, dict) else None,
                    "name": e.get("name") if isinstance(e, dict) else None,
                    "url": e.get("url") if isinstance(e, dict) else None,
                    "start": e.get("start") if isinstance(e, dict) else None,
                    "status": e.get("status") if isinstance(e, dict) else None,
                }
                for e in events
                if isinstance(e, dict)
            ],
        }
        return {
            "ok": True,
            "status_code": resp.status_code,
            "data": body,
            "summary": summary,
        }
    except requests.RequestException as e:
        logger.warning("Eventbrite org events request failed: %s", e)
        return {"ok": False, "error": str(e)}


def summarize_eventbrite_search(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {"note": "Response was not a JSON object.", "events": []}
    events = data.get("events")
    if not isinstance(events, list):
        events = []
    pagination = data.get("pagination") or {}
    return {
        "source": "events_search",
        "events_in_response": len(events),
        "object_count": pagination.get("object_count"),
        "page_count": pagination.get("page_count"),
        "events": [
            {
                "id": e.get("id"),
                "name": e.get("name"),
                "url": e.get("url"),
                "start": e.get("start"),
                "venue_id": e.get("venue_id"),
            }
            for e in events
            if isinstance(e, dict)
        ],
    }


def fetch_eventbrite_events_by_zip(
    zip_code: str,
    *,
    within: str = "25mi",
    page_size: int = 50,
    token: str | None = None,
) -> dict[str, Any]:
    """Deprecated public search: GET /v3/events/search/ with location.address = ZIP.

    Often returns 410/403 or empty for new integrations; prefer organization events for data you own.
    """
    tok = (token or settings.eventbrite_api_token or "").strip()
    if not tok:
        return {
            "ok": False,
            "error": "Missing EVENTBRITE_API_KEY (OAuth private token) in environment.",
        }

    z = zip_code.strip()
    if not z:
        return {"ok": False, "error": "zip_code is required"}

    now = datetime.now(timezone.utc)
    range_start = now.strftime("%Y-%m-%dT%H:%M:%S")
    range_end = (now + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S")

    params: dict[str, str | int] = {
        "location.address": z,
        "location.within": within,
        "expand": "venue",
        "page_size": min(max(page_size, 1), 50),
        "start_date.range_start": range_start,
        "start_date.range_end": range_end,
    }

    try:
        resp = requests.get(
            EVENTBRITE_SEARCH_URL,
            headers={"Authorization": f"Bearer {tok}"},
            params=params,
            timeout=30,
        )
        body = _safe_json(resp)
        if resp.status_code >= 400:
            out: dict[str, Any] = {
                "ok": False,
                "status_code": resp.status_code,
                "error": body if isinstance(body, str) else body,
                "note": EVENTBRITE_DEPRECATED_SEARCH_NOTE,
            }
            oid = (settings.eventbrite_organization_id or "").strip()
            if oid:
                out["fallback_attempted"] = "organization_events"
                out["organization_preview"] = fetch_eventbrite_organization_events(
                    oid, page_size=page_size, token=tok
                )
            return out
        summary = summarize_eventbrite_search(body)
        return {
            "ok": True,
            "status_code": resp.status_code,
            "data": body,
            "summary": summary,
            "info": (
                "Public location search is often deprecated; if this breaks, use EVENTBRITE_ORGANIZATION_ID "
                "and the org events call (see organization_preview when search errors)."
            ),
        }
    except requests.RequestException as e:
        logger.warning("Eventbrite request failed: %s", e)
        return {
            "ok": False,
            "error": str(e),
            "note": EVENTBRITE_DEPRECATED_SEARCH_NOTE,
        }

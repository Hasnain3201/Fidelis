"""Venue + event auto-discovery by ZIP code and radius.

Flow:
1. Convert ZIP → lat/lng (pgeocode, offline, no API key needed)
2. Query three free sources in parallel:
   - Ticketmaster Discovery API  → structured events + embedded venue data
   - Foursquare Places API       → venue candidates with website URLs
   - OpenStreetMap Overpass API  → venue candidates with website URLs
3. Save Ticketmaster events + venues directly to Supabase (already structured)
4. Collect website URLs from all three sources, deduplicate
5. Enqueue each URL as both a "venue" and "events" scrape job so the
   existing ScrapeWorker enriches them via HTML + Gemini AI
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.config import settings
from app.repositories.events import EventRepository
from app.repositories.venues import VenueRepository
from app.services.external_events import fetch_ticketmaster_events_by_zip
from app.services.scraper.queue_service import QueueService

logger = logging.getLogger(__name__)

# Foursquare category IDs for music / nightlife venues
_FSQ_CATEGORIES = "10032,10033,10034,10006,13003"
# 10032 Music Venue, 10033 Concert Hall, 10034 Nightclub, 10006 Theater, 13003 Bar

_METERS_PER_MILE = 1609

# Social-media / ticketing domains that are not venue websites
_SKIP_DOMAINS = {
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "tiktok.com", "youtube.com", "ticketmaster.com", "eventbrite.com",
    "bandsintown.com", "songkick.com", "linktr.ee", "linktree.com",
}


# ---------------------------------------------------------------------------
# ZIP → lat/lng
# ---------------------------------------------------------------------------

def _zip_to_latlong(zip_code: str) -> tuple[float, float]:
    """Return (lat, lng) for a US ZIP code using the offline pgeocode dataset."""
    try:
        import pgeocode  # type: ignore
        nomi = pgeocode.Nominatim("us")
        result = nomi.query_postal_code(zip_code.strip())
        lat = float(result.latitude)
        lng = float(result.longitude)
        if lat != lat or lng != lng:  # NaN check
            raise ValueError(f"No coordinates found for ZIP {zip_code}")
        return lat, lng
    except Exception as exc:
        raise ValueError(f"Could not geocode ZIP code '{zip_code}': {exc}") from exc


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def _is_valid_venue_url(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        return False
    try:
        domain = urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return False
    return not any(domain == skip or domain.endswith("." + skip) for skip in _SKIP_DOMAINS)


def _normalize_domain(url: str) -> str:
    """Return scheme + netloc for dedup key."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc.lower()}"


# ---------------------------------------------------------------------------
# Source: Ticketmaster
# ---------------------------------------------------------------------------

def _fetch_ticketmaster(zip_code: str, radius_miles: int, upcoming_only: bool = False) -> dict[str, Any]:
    """Call Ticketmaster and return the raw API result."""
    result = fetch_ticketmaster_events_by_zip(
        zip_code,
        size=200,
        upcoming_only=upcoming_only,
        radius_miles=radius_miles,
    )
    return result


def _save_ticketmaster_data(tm_result: dict[str, Any]) -> dict[str, Any]:
    """Persist Ticketmaster venues + events directly to Supabase.

    Returns summary counts and the set of venue website URLs found.
    """
    if not tm_result.get("ok"):
        logger.warning("Ticketmaster fetch failed: %s", tm_result.get("error"))
        return {"venues_saved": 0, "events_saved": 0, "venue_urls": []}

    embedded = (tm_result.get("data") or {}).get("_embedded") or {}
    raw_events: list[dict] = embedded.get("events") or []

    venue_repo = VenueRepository()
    event_repo = EventRepository()

    # venue_id_map: tm_venue_id → our venue_id (to link events)
    venue_id_map: dict[str, str] = {}
    venue_urls: list[str] = []
    venues_saved = 0
    events_saved = 0

    for event in raw_events:
        if not isinstance(event, dict):
            continue

        ev_embedded = event.get("_embedded") or {}
        tm_venues: list[dict] = ev_embedded.get("venues") or []

        for tm_venue in tm_venues:
            if not isinstance(tm_venue, dict):
                continue
            tm_venue_id = tm_venue.get("id") or ""
            if tm_venue_id in venue_id_map:
                continue  # already saved this venue

            venue_data = _map_tm_venue(tm_venue)
            try:
                save_result = venue_repo.save_venue(venue_data, venue_data.get("source_url"))
                venue_id_map[tm_venue_id] = save_result["venue_id"]
                if save_result.get("action") == "created":
                    venues_saved += 1
            except Exception as exc:
                logger.warning("Failed to save TM venue '%s': %s", tm_venue.get("name"), exc)

            # Collect the venue's own website URL (not its TM page)
            website = tm_venue.get("url") or ""
            if _is_valid_venue_url(website):
                venue_urls.append(website)

        # Save the event, linked to the first venue
        first_tm_venue = tm_venues[0] if tm_venues else {}
        first_tm_venue_id = first_tm_venue.get("id") or ""
        our_venue_id = venue_id_map.get(first_tm_venue_id)
        venue_name = first_tm_venue.get("name") or ""

        event_dict = _map_tm_event(event, venue_name)
        try:
            result = event_repo.save_events(
                [event_dict],
                venue_id=our_venue_id,
                venue_name=venue_name,
                source_url=event.get("url"),
            )
            events_saved += result.get("saved", 0)
        except Exception as exc:
            logger.warning("Failed to save TM event '%s': %s", event.get("name"), exc)

    return {
        "venues_saved": venues_saved,
        "events_saved": events_saved,
        "venue_urls": venue_urls,
    }


def _map_tm_venue(tm_venue: dict) -> dict:
    """Map a Ticketmaster embedded venue object to our venue schema."""
    addr = tm_venue.get("address") or {}
    city_obj = tm_venue.get("city") or {}
    state_obj = tm_venue.get("state") or {}
    country_obj = tm_venue.get("country") or {}
    loc = tm_venue.get("location") or {}

    geo: dict = {}
    if loc.get("latitude") and loc.get("longitude"):
        try:
            geo = {"lat": float(loc["latitude"]), "lng": float(loc["longitude"])}
        except (TypeError, ValueError):
            pass

    return {
        "venue_name": tm_venue.get("name") or "",
        "venue_address": {
            "street": addr.get("line1") or "",
            "city": city_obj.get("name") or "",
            "state": state_obj.get("stateCode") or "",
            "zip_code": tm_venue.get("postalCode") or "",
            "country": country_obj.get("countryCode") or "",
        },
        "website": tm_venue.get("url") or None,
        "geo": geo,
        "external_ids": {"ticketmaster_id": tm_venue.get("id") or ""},
        "source_url": tm_venue.get("url") or None,
        "confidence_score": 80,
    }


def _map_tm_event(event: dict, venue_name: str) -> dict:
    """Map a Ticketmaster event object to our event schema."""
    dates = event.get("dates") or {}
    start = dates.get("start") or {}

    classifications = event.get("classifications") or [{}]
    cls = classifications[0] if classifications else {}
    segment = (cls.get("segment") or {}).get("name") or ""
    genre = (cls.get("genre") or {}).get("name") or ""

    price_ranges = event.get("priceRanges") or []
    price: dict = {"has_cover": bool(price_ranges)}
    if price_ranges:
        pr = price_ranges[0]
        price["amount"] = pr.get("min")
        price["currency"] = pr.get("currency") or "USD"

    images = [
        img["url"] for img in (event.get("images") or [])
        if isinstance(img, dict) and img.get("url")
    ]

    return {
        "title": event.get("name") or "Untitled",
        "start_datetime": start.get("dateTime") or start.get("localDate"),
        "venue_name": venue_name,
        "types": [segment] if segment else [],
        "genres": [genre] if genre else [],
        "ticket_url": event.get("url"),
        "event_url": event.get("url"),
        "price": price,
        "images": images[:5],
        "source_domain": "ticketmaster.com",
        "source_url": event.get("url") or "",
        "target_audience": "All Ages",
        "confidence": 0.8,
    }


# ---------------------------------------------------------------------------
# Source: Foursquare
# ---------------------------------------------------------------------------

def _fetch_foursquare(lat: float, lng: float, radius_miles: int) -> dict[str, Any]:
    """Return structured result from Foursquare Places API."""
    api_key = settings.foursquare_api_key
    if not api_key:
        msg = "Foursquare API key not found. Set FOURSQUARE_SERVICE_API_KEY (or FOURSQUARE_API_KEY) in apps/api/.env. Use the Places v3 API key from your Foursquare project dashboard (starts with fsq3)."
        logger.info(msg)
        return {"ok": False, "error": msg, "venues": [], "status_code": None, "raw": None, "raw_error": None}

    radius_m = min(radius_miles * _METERS_PER_MILE, 100_000)
    params = {
        "ll": f"{lat},{lng}",
        "radius": radius_m,
        "categories": _FSQ_CATEGORIES,
        "fields": "name,website,location",
        "limit": 50,
    }
    try:
        resp = requests.get(
            "https://api.foursquare.com/v3/places/search",
            headers={"Authorization": api_key, "Accept": "application/json"},
            params=params,
            timeout=20,
        )
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        if resp.status_code != 200:
            msg = f"HTTP {resp.status_code}"
            # Extract human-readable error from Foursquare's response
            raw_error: Any = body
            if isinstance(body, dict):
                raw_error = body.get("message") or body.get("error") or body
            logger.warning("Foursquare returned %s: %s", resp.status_code, str(body)[:300])
            return {
                "ok": False,
                "error": msg,
                "venues": [],
                "status_code": resp.status_code,
                "raw": body,
                "raw_error": raw_error,
            }
        venues = body.get("results") or [] if isinstance(body, dict) else []
        return {"ok": True, "error": None, "venues": venues, "status_code": resp.status_code, "raw": body, "raw_error": None}
    except Exception as exc:
        logger.warning("Foursquare request failed: %s", exc)
        return {"ok": False, "error": str(exc), "venues": [], "status_code": None, "raw": None, "raw_error": None}


# ---------------------------------------------------------------------------
# Source: OpenStreetMap Overpass
# ---------------------------------------------------------------------------

# Try mirrors in order — overpass-api.de is the primary but frequently overloaded
_OSM_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]


def _fetch_osm(lat: float, lng: float, radius_miles: int) -> dict[str, Any]:
    """Return structured result from OpenStreetMap Overpass API.

    Tries multiple public mirrors in order so a single overloaded server
    doesn't cause a 504.
    """
    radius_m = radius_miles * _METERS_PER_MILE
    # Use [maxsize] to cap response so dense areas (e.g. Manhattan) don't time out.
    # Server timeout is set generously; per-request HTTP timeout is 35s.
    query = f"""
[out:json][timeout:30][maxsize:2000000];
(
  node["amenity"="bar"](around:{radius_m},{lat},{lng});
  node["amenity"="nightclub"](around:{radius_m},{lat},{lng});
  node["amenity"="music_venue"](around:{radius_m},{lat},{lng});
  node["amenity"="theatre"](around:{radius_m},{lat},{lng});
  node["amenity"="concert_hall"](around:{radius_m},{lat},{lng});
  way["amenity"="bar"](around:{radius_m},{lat},{lng});
  way["amenity"="nightclub"](around:{radius_m},{lat},{lng});
  way["amenity"="music_venue"](around:{radius_m},{lat},{lng});
);
out body;
""".strip()

    last_err: str = "no mirrors tried"
    last_status: int | None = None

    for mirror in _OSM_MIRRORS:
        try:
            resp = requests.post(mirror, data={"data": query}, timeout=35)
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            if resp.status_code == 200:
                elements = body.get("elements") or [] if isinstance(body, dict) else []
                logger.info("OSM: used mirror %s, got %d elements", mirror, len(elements))
                return {"ok": True, "error": None, "elements": elements, "status_code": 200, "raw": body}
            # 429 / 503 / 504 → try next mirror
            last_err = f"HTTP {resp.status_code} from {mirror}"
            last_status = resp.status_code
            logger.warning("OSM mirror %s returned %s — trying next", mirror, resp.status_code)
        except requests.exceptions.Timeout:
            last_err = f"Timeout from {mirror}"
            logger.warning("OSM mirror %s timed out — trying next", mirror)
        except Exception as exc:
            last_err = f"{mirror}: {exc}"
            logger.warning("OSM mirror %s error: %s — trying next", mirror, exc)

    logger.error("All OSM mirrors failed. Last error: %s", last_err)
    return {"ok": False, "error": last_err, "elements": [], "status_code": last_status, "raw": None}


# ---------------------------------------------------------------------------
# URL collection + deduplication
# ---------------------------------------------------------------------------

def _collect_venue_urls(
    tm_result: dict[str, Any],
    fsq_result: dict[str, Any],
    osm_result: dict[str, Any],
    tm_save: dict[str, Any] | None = None,
) -> list[str]:
    """Gather, filter, and deduplicate venue website URLs from all three sources."""
    raw_urls: list[str] = []

    # Ticketmaster: venue website URLs (from _save_ticketmaster_data result)
    if tm_save:
        raw_urls.extend(tm_save.get("venue_urls") or [])

    # Also pull from raw TM data in case save was skipped
    embedded = (tm_result.get("data") or {}).get("_embedded") or {}
    for event in embedded.get("events") or []:
        for v in (event.get("_embedded") or {}).get("venues") or []:
            if isinstance(v, dict) and v.get("url"):
                raw_urls.append(v["url"])

    # Foursquare
    for place in fsq_result.get("venues") or []:
        if isinstance(place, dict):
            raw_urls.append(place.get("website") or "")

    # OSM
    for element in osm_result.get("elements") or []:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags") or {}
        raw_urls.append(tags.get("website") or tags.get("contact:website") or "")

    # Filter + deduplicate by domain
    seen_domains: set[str] = set()
    result: list[str] = []
    for url in raw_urls:
        if not _is_valid_venue_url(url):
            continue
        domain_key = _normalize_domain(url)
        if domain_key in seen_domains:
            continue
        seen_domains.add(domain_key)
        result.append(url.strip())

    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

class DiscoveryService:
    """Orchestrate venue + event discovery for a given ZIP code and radius."""

    def run(self, zip_code: str, radius_miles: int = 10, upcoming_only: bool = False) -> dict[str, Any]:
        """Run the full discovery pipeline.

        Returns a summary dict with counts and a batch_id for status tracking.
        """
        zip_code = zip_code.strip()
        radius_miles = max(1, min(radius_miles, 200))

        # 1. ZIP → coordinates
        lat, lng = _zip_to_latlong(zip_code)
        logger.info("Discovery: ZIP %s → (%.4f, %.4f), radius %d mi", zip_code, lat, lng, radius_miles)

        # 2. Parallel HTTP calls
        tm_result: dict[str, Any] = {}
        fsq_result: dict[str, Any] = {"ok": False, "error": "not started", "venues": []}
        osm_result: dict[str, Any] = {"ok": False, "error": "not started", "elements": []}

        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {
                pool.submit(_fetch_ticketmaster, zip_code, radius_miles, upcoming_only): "ticketmaster",
                pool.submit(_fetch_foursquare, lat, lng, radius_miles): "foursquare",
                pool.submit(_fetch_osm, lat, lng, radius_miles): "osm",
            }
            for future in as_completed(futures):
                source = futures[future]
                try:
                    data = future.result()
                    if source == "ticketmaster":
                        tm_result = data
                    elif source == "foursquare":
                        fsq_result = data
                    else:
                        osm_result = data
                except Exception as exc:
                    logger.warning("Source '%s' raised an exception: %s", source, exc)
                    if source == "foursquare":
                        fsq_result = {"ok": False, "error": str(exc), "venues": []}
                    elif source == "osm":
                        osm_result = {"ok": False, "error": str(exc), "elements": []}
                    else:
                        tm_result = {"ok": False, "error": str(exc)}

        # 3. Save Ticketmaster data directly (already structured — no scraping needed)
        tm_save = _save_ticketmaster_data(tm_result)

        # 4. Collect + deduplicate venue website URLs
        venue_urls = _collect_venue_urls(tm_result, fsq_result, osm_result, tm_save)
        logger.info("Discovery: %d unique venue URLs collected", len(venue_urls))

        # 5. Enqueue each URL as a unified scrape job (venue + events + artists)
        batch_id: str | None = None
        if venue_urls:
            queue = QueueService()
            batch = queue.enqueue_batch(venue_urls, priority=1)
            batch_id = batch["batch_id"]

        # Build Foursquare debug summary (names + websites, skip giant raw blob)
        fsq_venue_previews = [
            {
                "name": p.get("name"),
                "website": p.get("website"),
                "city": (p.get("location") or {}).get("city"),
            }
            for p in (fsq_result.get("venues") or [])
            if isinstance(p, dict)
        ]

        # Build OSM debug summary (names + websites)
        osm_venue_previews = [
            {
                "name": (e.get("tags") or {}).get("name"),
                "amenity": (e.get("tags") or {}).get("amenity"),
                "website": (e.get("tags") or {}).get("website") or (e.get("tags") or {}).get("contact:website"),
            }
            for e in (osm_result.get("elements") or [])
            if isinstance(e, dict) and (e.get("tags") or {}).get("name")
        ]

        # Ticketmaster summary slice (first 20 events for display)
        tm_summary = tm_result.get("summary") or {}
        tm_events_preview = tm_summary.get("events") or []

        return {
            "zip_code": zip_code,
            "radius_miles": radius_miles,
            "coordinates": {"lat": lat, "lng": lng},
            "batch_id": batch_id,
            "venue_urls_queued": len(venue_urls),
            "venue_urls": venue_urls,
            "ticketmaster": {
                "venues_saved": tm_save.get("venues_saved", 0),
                "events_saved": tm_save.get("events_saved", 0),
            },
            "sources": {
                "ticketmaster_events": len(
                    ((tm_result.get("data") or {}).get("_embedded") or {}).get("events") or []
                ),
                "foursquare_venues": len(fsq_result.get("venues") or []),
                "osm_venues": len(osm_result.get("elements") or []),
            },
            "debug": {
                "ticketmaster": {
                    "ok": tm_result.get("ok"),
                    "error": tm_result.get("error"),
                    "hint": tm_result.get("hint"),
                    "total_elements": tm_summary.get("total_elements"),
                    "events_in_response": tm_summary.get("events_in_response"),
                    "events": tm_events_preview[:20],
                },
                "foursquare": {
                    "ok": fsq_result.get("ok"),
                    "error": fsq_result.get("error"),
                    "raw_error": fsq_result.get("raw_error"),
                    "status_code": fsq_result.get("status_code"),
                    "venue_count": len(fsq_result.get("venues") or []),
                    "venues": fsq_venue_previews[:20],
                },
                "osm": {
                    "ok": osm_result.get("ok"),
                    "error": osm_result.get("error"),
                    "status_code": osm_result.get("status_code"),
                    "element_count": len(osm_result.get("elements") or []),
                    "venues": osm_venue_previews[:20],
                },
            },
        }

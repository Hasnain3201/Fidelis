"""Normalization and fingerprint helpers for scraped data."""

import hashlib
import re
from typing import Any


def slugify(text: str) -> str:
    """Lowercase, replace non-alnum with hyphens, collapse repeats."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def normalize_title(title: str) -> str:
    """Trim, collapse whitespace, lowercase, strip trivial punctuation."""
    if not title:
        return ""
    title = title.strip()
    title = re.sub(r"\s+", " ", title)
    title = title.lower()
    title = re.sub(r"[^\w\s-]", "", title)
    return title


def compute_fingerprint(title: str, start_time: str, venue_name: str) -> str:
    """Stable SHA-1 fingerprint for event deduplication."""
    normalized = f"{normalize_title(title)}|{start_time or ''}|{(venue_name or '').lower().strip()}"
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def _coerce_list(val: Any) -> list:
    if isinstance(val, list):
        return val
    return []


def _coerce_dict(val: Any) -> dict:
    if isinstance(val, dict):
        return val
    return {}


def _first_or_none(lst: list) -> str | None:
    return lst[0] if lst else None


def map_venue_to_supabase(venue_data: dict, source_url: str | None = None) -> dict:
    """Map AI-extracted venue data to Supabase ``venues`` columns."""
    addr = venue_data.get("venue_address") or venue_data.get("address") or {}
    if isinstance(addr, str):
        addr = {}

    legal = {}
    if venue_data.get("legal_entity_name"):
        legal["name"] = venue_data["legal_entity_name"]
    if venue_data.get("legal_entity_address"):
        legal["address"] = venue_data["legal_entity_address"]
    if venue_data.get("federal_id_number"):
        legal["federal_id_number"] = venue_data["federal_id_number"]

    contact = _coerce_dict(venue_data.get("primary_contact"))

    return {
        "name": venue_data.get("venue_name") or venue_data.get("name") or "",
        "address_line": addr.get("street") or "",
        "city": addr.get("city") or "",
        "state": addr.get("state") or "",
        "zip_code": addr.get("zip_code") or None,
        "website": venue_data.get("website") or None,
        "phone": venue_data.get("phone_number") or venue_data.get("phone") or None,
        "email": venue_data.get("email") or None,
        "social_links": _coerce_dict(venue_data.get("social_links")),
        "legal_entity": legal or {},
        "primary_contact": contact,
        "geo": _coerce_dict(venue_data.get("geo")),
        "external_ids": _coerce_dict(venue_data.get("external_ids")),
        "source_url": source_url or venue_data.get("source_url") or None,
        "capacity": venue_data.get("capacity") or None,
        "data": venue_data,  # raw backup
    }


_TYPE_MAP = {"Music": "Live Music", "Party": "Specialty Entertainment"}


def map_event_to_supabase(
    event_data: dict,
    venue_id: str | None,
    venue_name: str | None,
    source_url: str | None = None,
) -> dict:
    """Map AI-extracted event data to Supabase ``events`` columns."""
    title = event_data.get("title") or event_data.get("name") or "Untitled"
    start = event_data.get("start_datetime") or event_data.get("start_time") or event_data.get("start")
    end = event_data.get("end_datetime") or event_data.get("end_time") or event_data.get("end")

    types_raw = _coerce_list(event_data.get("types"))
    types = [_TYPE_MAP.get(t.strip(), t.strip()) for t in types_raw if isinstance(t, str)]

    genres = _coerce_list(event_data.get("genres"))
    artists = _coerce_list(event_data.get("artists"))

    price = _coerce_dict(event_data.get("price"))
    if "has_cover" not in price:
        price["has_cover"] = bool(price.get("amount"))

    ev_venue_name = event_data.get("venue_name") or venue_name or ""
    fingerprint = compute_fingerprint(title, start or "", ev_venue_name)

    category = slugify(_first_or_none(types) or _first_or_none(genres) or "") or None

    conf = event_data.get("confidence") or 0.0
    if isinstance(conf, str):
        try:
            conf = float(conf)
        except ValueError:
            conf = 0.0

    return {
        "title": title,
        "description": event_data.get("description") or None,
        "start_time": start,
        "end_time": end or None,
        "venue_id": venue_id,
        "venue_name": ev_venue_name or None,
        "category": category,
        "zip_code": event_data.get("zip_code") or None,
        "ticket_url": event_data.get("ticket_url") or None,
        "target_audience": event_data.get("target_audience") or "All Ages",
        "types": types,
        "genres": genres,
        "social_media": _coerce_dict(event_data.get("social_media")),
        "timezone": event_data.get("timezone") or None,
        "when_text": event_data.get("when_text") or None,
        "where_text": event_data.get("where_text") or None,
        "artists_data": artists,
        "price": price,
        "food_available": event_data.get("food_available"),
        "age_restriction": event_data.get("age_restriction") or None,
        "categories": _coerce_list(event_data.get("categories")),
        "tags": _coerce_list(event_data.get("tags")),
        "event_url": event_data.get("event_url") or None,
        "images": _coerce_list(event_data.get("images")),
        "source_domain": event_data.get("source_domain") or None,
        "source_url": event_data.get("source_url") or source_url or None,
        "discovered_at": event_data.get("discovered_at") or None,
        "fingerprint": fingerprint,
        "confidence": conf,
    }

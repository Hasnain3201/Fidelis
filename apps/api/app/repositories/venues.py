"""Supabase-backed venue persistence with deduplication and smart merge."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.supabase_admin import get_supabase_admin_client
from app.services.scraper.utils import map_venue_to_supabase

logger = logging.getLogger(__name__)


def _smart_merge(new: dict, existing: dict) -> dict:
    """Merge *new* into *existing*: non-empty new values win."""
    merged = dict(existing)
    skip = {"id", "created_at"}
    for key, value in new.items():
        if key in skip:
            continue
        if value is None or value == "" or value == {} or value == []:
            continue
        merged[key] = value
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    return merged


class VenueRepository:

    def __init__(self) -> None:
        client = get_supabase_admin_client()
        if client is None:
            raise RuntimeError("Supabase admin client is not configured")
        self._client = client

    # ------------------------------------------------------------------
    # Save (with deduplication by name)
    # ------------------------------------------------------------------

    def save_venue(self, venue_data: dict, source_url: str | None = None) -> dict[str, Any]:
        """Insert or merge a scraped venue.  Returns ``{venue_id, action}``."""
        row = map_venue_to_supabase(venue_data, source_url)
        name = row.get("name") or ""
        if not name:
            raise ValueError("Venue name is required")

        existing = self._find_by_name(name)
        if existing:
            merged = _smart_merge(row, existing)
            self._client.table("venues").update(merged).eq("id", existing["id"]).execute()
            return {"venue_id": existing["id"], "action": "merged"}

        resp = self._client.table("venues").insert(row).execute()
        new_id = resp.data[0]["id"]
        return {"venue_id": new_id, "action": "created"}

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def get_venue(self, venue_id: str) -> dict | None:
        resp = self._client.table("venues").select("*").eq("id", venue_id).limit(1).execute()
        return resp.data[0] if resp.data else None

    def get_all_venues(self, limit: int = 200) -> list[dict]:
        resp = (
            self._client.table("venues")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []

    # ------------------------------------------------------------------
    # Deduplication helpers
    # ------------------------------------------------------------------

    def _find_by_name(self, name: str) -> dict | None:
        resp = (
            self._client.table("venues")
            .select("*")
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    def find_duplicate_candidates(
        self, name: str, website: str | None = None
    ) -> list[dict]:
        """Return venues whose name is a case-insensitive match or share a website domain."""
        candidates: list[dict] = []
        if name:
            resp = self._client.table("venues").select("id,name,website,city,state").ilike("name", f"%{name}%").limit(10).execute()
            candidates.extend(resp.data or [])
        if website:
            resp = self._client.table("venues").select("id,name,website,city,state").ilike("website", f"%{website}%").limit(10).execute()
            for row in resp.data or []:
                if row["id"] not in {c["id"] for c in candidates}:
                    candidates.append(row)
        return candidates

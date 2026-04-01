"""Supabase-backed event persistence with deduplication and smart merge."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.supabase_admin import get_supabase_admin_client
from app.services.scraper.utils import map_event_to_supabase

logger = logging.getLogger(__name__)

_STALE_DAYS = 7


def _smart_merge(new: dict, existing: dict) -> dict:
    """Merge *new* into *existing*: non-empty new values win."""
    merged = dict(existing)
    skip = {"id", "created_at", "created_by", "discovered_at"}
    for key, value in new.items():
        if key in skip:
            continue
        if value is None or value == "" or value == {} or value == []:
            continue
        # Confidence: keep highest
        if key == "confidence":
            merged[key] = max(merged.get(key) or 0, value or 0)
            continue
        merged[key] = value
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    return merged


class EventRepository:

    def __init__(self) -> None:
        client = get_supabase_admin_client()
        if client is None:
            raise RuntimeError("Supabase admin client is not configured")
        self._client = client

    # ------------------------------------------------------------------
    # Bulk save (used after a scrape)
    # ------------------------------------------------------------------

    def save_events(
        self,
        events: list[dict],
        venue_id: str | None,
        venue_name: str | None = None,
        source_url: str | None = None,
    ) -> dict[str, Any]:
        """Normalize, deduplicate, and upsert a batch of scraped events.

        Returns ``{saved, updated, skipped, event_ids}``.
        """
        saved = 0
        updated = 0
        skipped = 0
        event_ids: list[str] = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=_STALE_DAYS)

        for ev in events or []:
            if not isinstance(ev, dict):
                continue

            row = map_event_to_supabase(ev, venue_id, venue_name, source_url)
            fp = row.get("fingerprint")
            if not fp:
                continue

            existing = self._find_by_fingerprint(fp)

            if existing:
                start_str = existing.get("start_time") or ""
                try:
                    start_dt = datetime.fromisoformat(start_str)
                    if start_dt.tzinfo is None:
                        start_dt = start_dt.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    start_dt = None

                if start_dt and start_dt < cutoff:
                    skipped += 1
                    continue

                merged = _smart_merge(row, existing)
                self._client.table("events").update(merged).eq("id", existing["id"]).execute()
                event_ids.append(existing["id"])
                updated += 1
            else:
                if not row.get("discovered_at"):
                    row["discovered_at"] = datetime.now(timezone.utc).isoformat()
                resp = self._client.table("events").insert(row).execute()
                new_id = resp.data[0]["id"]
                event_ids.append(new_id)
                saved += 1

        return {
            "saved": saved,
            "updated": updated,
            "skipped": skipped,
            "event_ids": event_ids,
        }

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def get_event(self, event_id: str) -> dict | None:
        resp = self._client.table("events").select("*").eq("id", event_id).limit(1).execute()
        return resp.data[0] if resp.data else None

    def get_all_events(self, limit: int = 200) -> list[dict]:
        resp = (
            self._client.table("events")
            .select("*")
            .order("start_time", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []

    def get_events_by_date(self, date: str) -> list[dict]:
        """Return events whose start_time falls on *date* (YYYY-MM-DD)."""
        start = f"{date}T00:00:00+00:00"
        end = f"{date}T23:59:59+00:00"
        resp = (
            self._client.table("events")
            .select("*")
            .gte("start_time", start)
            .lte("start_time", end)
            .order("start_time")
            .execute()
        )
        return resp.data or []

    def get_venue_events(self, venue_id: str, limit: int = 100) -> list[dict]:
        resp = (
            self._client.table("events")
            .select("*")
            .eq("venue_id", venue_id)
            .order("start_time")
            .limit(limit)
            .execute()
        )
        return resp.data or []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _find_by_fingerprint(self, fingerprint: str) -> dict | None:
        resp = (
            self._client.table("events")
            .select("*")
            .eq("fingerprint", fingerprint)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

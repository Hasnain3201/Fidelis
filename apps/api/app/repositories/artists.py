"""Supabase-backed artist persistence for the scraper.

Dedup is enforced at the repository layer (case-insensitive stage_name lookup),
not via a unique index — the live ``artists`` table is shared with claim-based
ownership and may already contain duplicate rows we shouldn't reject.
"""

from __future__ import annotations

import logging
from typing import Any

from app.db.supabase_admin import get_supabase_admin_client
from app.services.scraper.utils import map_artist_to_supabase

logger = logging.getLogger(__name__)


class ArtistRepository:

    def __init__(self) -> None:
        client = get_supabase_admin_client()
        if client is None:
            raise RuntimeError("Supabase admin client is not configured")
        self._client = client

    # ------------------------------------------------------------------
    # Upsert
    # ------------------------------------------------------------------

    def upsert_artist(self, artist_data: dict) -> dict[str, Any] | None:
        """Insert an artist, or merge into an existing row matched by stage_name.

        Returns ``{artist_id, action}`` or None if there's nothing to save.
        Dedup is case-insensitive on ``stage_name``.
        """
        row = map_artist_to_supabase(artist_data)
        stage_name = (row.get("stage_name") or "").strip()
        if not stage_name:
            return None

        existing = self._find_by_stage_name(stage_name)
        if existing:
            update: dict[str, Any] = {}
            if not existing.get("genre") and row.get("genre"):
                update["genre"] = row["genre"]
            if update:
                self._client.table("artists").update(update).eq("id", existing["id"]).execute()
                return {"artist_id": existing["id"], "action": "merged"}
            return {"artist_id": existing["id"], "action": "unchanged"}

        resp = self._client.table("artists").insert(row).execute()
        new_id = resp.data[0]["id"]
        return {"artist_id": new_id, "action": "created"}

    # ------------------------------------------------------------------
    # event_artists linking
    # ------------------------------------------------------------------

    def link_event_artist(self, event_id: str, artist_id: str) -> bool:
        """Insert an (event_id, artist_id) row, swallowing duplicates. Returns True if newly inserted."""
        try:
            existing = (
                self._client.table("event_artists")
                .select("event_id")
                .eq("event_id", event_id)
                .eq("artist_id", artist_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return False
            self._client.table("event_artists").insert(
                {"event_id": event_id, "artist_id": artist_id}
            ).execute()
            return True
        except Exception:
            logger.warning("Failed to link event=%s artist=%s", event_id, artist_id, exc_info=True)
            return False

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def _find_by_stage_name(self, stage_name: str) -> dict | None:
        resp = (
            self._client.table("artists")
            .select("*")
            .ilike("stage_name", stage_name)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

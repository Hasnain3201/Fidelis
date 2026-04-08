"""Supabase-backed scrape queue.

Persists `scrape_jobs` rows that the in-process worker (worker.py) consumes
one at a time. The queue is durable across server restarts: jobs left in
`in_progress` after a crash are reset to `pending` on worker startup.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.supabase_admin import get_supabase_admin_client

logger = logging.getLogger(__name__)


VALID_MODES = {"venue", "events"}
VALID_STATUSES = {"pending", "in_progress", "completed", "failed"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class QueueService:
    """CRUD + state transitions for the scrape_jobs table."""

    def __init__(self) -> None:
        client = get_supabase_admin_client()
        if client is None:
            raise RuntimeError("Supabase admin client is not configured")
        self._client = client

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------

    def enqueue_batch(
        self,
        urls: list[str],
        mode: str,
        *,
        enable_render: bool = False,
        dry_run: bool = False,
        venue_id_hint: str | None = None,
        priority: int = 0,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        """Insert one row per URL. Returns {batch_id, job_ids}."""
        if mode not in VALID_MODES:
            raise ValueError(f"Invalid mode '{mode}'. Use one of {VALID_MODES}")

        cleaned: list[str] = []
        for u in urls or []:
            if not isinstance(u, str):
                continue
            s = u.strip()
            if s:
                cleaned.append(s)
        if not cleaned:
            raise ValueError("urls must contain at least one non-empty string")

        batch_id = str(uuid.uuid4())
        rows = [
            {
                "batch_id": batch_id,
                "url": url,
                "mode": mode,
                "status": "pending",
                "enable_render": enable_render,
                "dry_run": dry_run,
                "venue_id_hint": venue_id_hint,
                "priority": priority,
                "created_by": created_by,
            }
            for url in cleaned
        ]
        resp = self._client.table("scrape_jobs").insert(rows).execute()
        job_ids = [row["id"] for row in (resp.data or [])]
        return {"batch_id": batch_id, "job_ids": job_ids}

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def list_jobs(
        self,
        *,
        status: str | None = None,
        batch_id: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        query = self._client.table("scrape_jobs").select("*")
        if status:
            if status not in VALID_STATUSES:
                raise ValueError(f"Invalid status '{status}'")
            query = query.eq("status", status)
        if batch_id:
            query = query.eq("batch_id", batch_id)
        query = query.order("created_at", desc=True).limit(limit)
        resp = query.execute()
        return resp.data or []

    def get_job(self, job_id: str) -> dict | None:
        resp = (
            self._client.table("scrape_jobs")
            .select("*")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    # ------------------------------------------------------------------
    # State transitions (worker-facing)
    # ------------------------------------------------------------------

    def claim_next_pending(self) -> dict | None:
        """Pop the next pending job and mark it in_progress.

        Note: supabase-py does not support a single SQL statement
        ``UPDATE ... LIMIT 1 RETURNING *``. We do this in two steps with a
        guard on `status` to keep it safe under the assumption of a single
        in-process worker.
        """
        sel = (
            self._client.table("scrape_jobs")
            .select("*")
            .eq("status", "pending")
            .order("priority", desc=True)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        rows = sel.data or []
        if not rows:
            return None
        job = rows[0]
        upd = (
            self._client.table("scrape_jobs")
            .update(
                {
                    "status": "in_progress",
                    "started_at": _now_iso(),
                    "attempts": (job.get("attempts") or 0) + 1,
                }
            )
            .eq("id", job["id"])
            .eq("status", "pending")  # guard against races
            .execute()
        )
        if not upd.data:
            return None
        return upd.data[0]

    def mark_completed(
        self,
        job_id: str,
        *,
        result: dict | None,
        content_preview: dict | None,
    ) -> None:
        self._client.table("scrape_jobs").update(
            {
                "status": "completed",
                "completed_at": _now_iso(),
                "result": result or {},
                "content_preview": content_preview or {},
                "error": None,
            }
        ).eq("id", job_id).execute()

    def mark_failed(self, job_id: str, error: str) -> None:
        self._client.table("scrape_jobs").update(
            {
                "status": "failed",
                "completed_at": _now_iso(),
                "error": error[:4000],
            }
        ).eq("id", job_id).execute()

    def reset_stale_in_progress(self) -> int:
        """Reset any rows stuck in `in_progress` (e.g. after a crash) back to pending."""
        resp = (
            self._client.table("scrape_jobs")
            .update({"status": "pending", "started_at": None})
            .eq("status", "in_progress")
            .execute()
        )
        return len(resp.data or [])

    # ------------------------------------------------------------------
    # Rescrape
    # ------------------------------------------------------------------

    def rescrape(self, job_id: str) -> dict:
        """Clone an existing job into a new pending row. Returns the new job."""
        existing = self.get_job(job_id)
        if not existing:
            raise ValueError(f"Job {job_id} not found")
        new_row = {
            "batch_id": existing.get("batch_id"),
            "url": existing["url"],
            "mode": existing["mode"],
            "status": "pending",
            "enable_render": existing.get("enable_render", False),
            "dry_run": existing.get("dry_run", False),
            "venue_id_hint": existing.get("venue_id_hint"),
            "priority": existing.get("priority", 0),
            "created_by": existing.get("created_by"),
        }
        resp = self._client.table("scrape_jobs").insert(new_row).execute()
        return resp.data[0] if resp.data else new_row

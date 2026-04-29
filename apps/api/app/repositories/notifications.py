"""Supabase-backed notification persistence for scraper activity tracking."""

from __future__ import annotations

from typing import Any

from app.db.supabase_admin import get_supabase_admin_client


class NotificationRepository:

    def __init__(self) -> None:
        client = get_supabase_admin_client()
        if client is None:
            raise RuntimeError("Supabase admin client is not configured")
        self._client = client

    def create(
        self,
        type: str,
        entity_type: str,
        entity_id: str | None = None,
        entity_name: str | None = None,
        message: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        row = {
            "type": type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "message": message,
            "metadata": metadata or {},
        }
        resp = self._client.table("notifications").insert(row).execute()
        return resp.data[0] if resp.data else row

    def list(self, limit: int = 50, unread_only: bool = False) -> list[dict]:
        query = self._client.table("notifications").select("*")
        if unread_only:
            query = query.eq("read", False)
        query = query.order("read").order("created_at", desc=True).limit(limit)
        resp = query.execute()
        return resp.data or []

    def mark_read(self, notification_id: int) -> bool:
        resp = (
            self._client.table("notifications")
            .update({"read": True})
            .eq("id", notification_id)
            .execute()
        )
        return bool(resp.data)

    def delete(self, notification_id: int) -> bool:
        resp = (
            self._client.table("notifications")
            .delete()
            .eq("id", notification_id)
            .execute()
        )
        return bool(resp.data)

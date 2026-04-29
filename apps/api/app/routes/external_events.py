"""Admin-only preview of nearby events from Ticketmaster and Eventbrite (no database writes)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthContext, require_role
from app.core.config import settings
from app.services.external_events import (
    fetch_eventbrite_events_by_zip,
    fetch_eventbrite_organization_events,
    fetch_ticketmaster_events_by_zip,
)

router = APIRouter()
_admin = Depends(require_role("admin"))

Provider = Literal["ticketmaster", "eventbrite", "both"]


@router.get("/nearby-preview")
def nearby_events_preview(
    zip_code: str = Query(..., min_length=3, max_length=20, description="Postal code (e.g. US ZIP)"),
    provider: Provider = Query("ticketmaster", description="Which upstream API to call"),
    country_code: str = Query("US", min_length=2, max_length=2, description="Ticketmaster countryCode (ISO 3166 alpha-2)"),
    ticketmaster_upcoming_only: bool = Query(
        True,
        description="If true, only events starting on/after now (UTC). Turn off if Ticketmaster returns zero rows.",
    ),
    include_eventbrite_org_events: bool = Query(
        False,
        description="If true and EVENTBRITE_ORGANIZATION_ID is set, also list that org's events (no ZIP filter).",
    ),
    _: AuthContext = _admin,
) -> dict:
    """
    Return raw JSON from Ticketmaster Discovery and/or Eventbrite search.
    Does not read or write the Supabase events table.
    """
    z = zip_code.strip()
    if not z:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="zip_code is required")

    out: dict = {
        "zip_code": z,
        "provider_requested": provider,
        "ticketmaster": None,
        "eventbrite": None,
    }

    if provider in ("ticketmaster", "both"):
        out["ticketmaster"] = fetch_ticketmaster_events_by_zip(
            z,
            country_code=country_code.upper(),
            upcoming_only=ticketmaster_upcoming_only,
        )

    if provider in ("eventbrite", "both"):
        out["eventbrite"] = fetch_eventbrite_events_by_zip(z)
        oid = (settings.eventbrite_organization_id or "").strip()
        if include_eventbrite_org_events and oid:
            out["eventbrite_organization"] = fetch_eventbrite_organization_events(oid)
        elif include_eventbrite_org_events and not oid:
            out["eventbrite_organization"] = {
                "ok": False,
                "error": "Set EVENTBRITE_ORGANIZATION_ID in the API environment to use org events.",
            }

    return out

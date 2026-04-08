"""Pydantic models that lock the AI scraper output contract.

These models normalize the loose JSON the AI returns ("N/A" -> None,
empty objects, missing fields) into a stable shape that the rest of the
codebase (mappers, repositories, frontend) can rely on.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NULLISH_STRINGS = {"", "n/a", "na", "none", "null", "unknown", "-"}


def _clean_str(value: Any) -> str | None:
    """Return a trimmed string or None for null-ish values."""
    if value is None:
        return None
    if not isinstance(value, str):
        try:
            value = str(value)
        except Exception:
            return None
    s = value.strip()
    if not s or s.lower() in _NULLISH_STRINGS:
        return None
    return s


def _clean_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _clean_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _clean_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except (ValueError, AttributeError):
            return 0.0
    return 0.0


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class VenueAddress(BaseModel):
    model_config = ConfigDict(extra="ignore")

    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    country: str | None = None

    @classmethod
    def from_ai(cls, raw: Any) -> "VenueAddress":
        d = _clean_dict(raw)
        return cls(
            street=_clean_str(d.get("street") or d.get("address_line")),
            city=_clean_str(d.get("city")),
            state=_clean_str(d.get("state")),
            zip_code=_clean_str(d.get("zip_code") or d.get("zip") or d.get("postal_code")),
            country=_clean_str(d.get("country")),
        )

    def is_empty(self) -> bool:
        return not any([self.street, self.city, self.state, self.zip_code, self.country])


class PrimaryContact(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    phone: str | None = None
    phone_type: str | None = None
    alt_phone: str | None = None
    alt_phone_type: str | None = None
    email: str | None = None

    @classmethod
    def from_ai(cls, raw: Any) -> "PrimaryContact":
        d = _clean_dict(raw)
        return cls(
            name=_clean_str(d.get("name")),
            phone=_clean_str(d.get("phone")),
            phone_type=_clean_str(d.get("phone_type")),
            alt_phone=_clean_str(d.get("alt_phone")),
            alt_phone_type=_clean_str(d.get("alt_phone_type")),
            email=_clean_str(d.get("email")),
        )


class EventPrice(BaseModel):
    model_config = ConfigDict(extra="ignore")

    has_cover: bool | None = None
    amount: float | None = None
    currency: str | None = None
    text: str | None = None

    @classmethod
    def from_ai(cls, raw: Any) -> "EventPrice":
        d = _clean_dict(raw)
        amount: float | None
        amount_raw = d.get("amount")
        if amount_raw is None or amount_raw == "":
            amount = None
        else:
            try:
                amount = float(amount_raw)
            except (TypeError, ValueError):
                amount = None
        has_cover = d.get("has_cover")
        if has_cover is None and amount is not None:
            has_cover = amount > 0
        return cls(
            has_cover=bool(has_cover) if has_cover is not None else None,
            amount=amount,
            currency=_clean_str(d.get("currency")),
            text=_clean_str(d.get("text")),
        )


# ---------------------------------------------------------------------------
# Top-level models
# ---------------------------------------------------------------------------


class VenueExtraction(BaseModel):
    """Standardized venue payload returned by the AI."""

    model_config = ConfigDict(extra="ignore")

    venue_name: str | None = None
    description: str | None = None
    venue_address: VenueAddress = Field(default_factory=VenueAddress)
    legal_entity_name: str | None = None
    legal_entity_address: VenueAddress | None = None
    federal_id_number: str | None = None
    primary_contact: PrimaryContact = Field(default_factory=PrimaryContact)
    venue_type: str | None = None
    website: str | None = None
    phone_number: str | None = None
    email: str | None = None
    capacity: str | None = None
    social_links: dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = 0.0

    @classmethod
    def from_ai_dict(cls, raw: Any) -> "VenueExtraction":
        d = _clean_dict(raw)
        legal_addr_raw = d.get("legal_entity_address")
        legal_addr = VenueAddress.from_ai(legal_addr_raw) if legal_addr_raw else None
        if legal_addr is not None and legal_addr.is_empty():
            legal_addr = None

        return cls(
            venue_name=_clean_str(d.get("venue_name") or d.get("name")),
            description=_clean_str(d.get("description")),
            venue_address=VenueAddress.from_ai(d.get("venue_address") or d.get("address")),
            legal_entity_name=_clean_str(d.get("legal_entity_name")),
            legal_entity_address=legal_addr,
            federal_id_number=_clean_str(d.get("federal_id_number")),
            primary_contact=PrimaryContact.from_ai(d.get("primary_contact")),
            venue_type=_clean_str(d.get("venue_type")),
            website=_clean_str(d.get("website")),
            phone_number=_clean_str(d.get("phone_number") or d.get("phone")),
            email=_clean_str(d.get("email")),
            capacity=_clean_str(d.get("capacity")),
            social_links=_clean_dict(d.get("social_links")),
            confidence_score=_clean_float(d.get("confidence_score") or d.get("confidence")),
        )

    def to_mapper_dict(self) -> dict:
        """Convert to the dict shape `map_venue_to_supabase` expects."""
        out = self.model_dump(mode="json")
        # legal_entity_address may be None; mapper handles that.
        return out


class EventExtraction(BaseModel):
    """Standardized event payload returned by the AI."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    description: str | None = None
    target_audience: str | None = None
    types: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    social_media: dict[str, Any] = Field(default_factory=dict)
    venue_name: str | None = None
    start_datetime: str | None = None
    end_datetime: str | None = None
    timezone: str | None = None
    when_text: str | None = None
    where_text: str | None = None
    artists: list[str] = Field(default_factory=list)
    price: EventPrice = Field(default_factory=EventPrice)
    food_available: bool | None = None
    age_restriction: str | None = None
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    ticket_url: str | None = None
    event_url: str | None = None
    images: list[str] = Field(default_factory=list)
    source_domain: str | None = None
    source_url: str | None = None

    @classmethod
    def from_ai_dict(cls, raw: Any) -> "EventExtraction":
        d = _clean_dict(raw)

        def _str_list(v: Any) -> list[str]:
            return [s.strip() for s in _clean_list(v) if isinstance(s, str) and s.strip()]

        food = d.get("food_available")
        if isinstance(food, str):
            low = food.strip().lower()
            food = True if low in ("true", "yes") else False if low in ("false", "no") else None

        return cls(
            title=_clean_str(d.get("title") or d.get("name")),
            description=_clean_str(d.get("description")),
            target_audience=_clean_str(d.get("target_audience")),
            types=_str_list(d.get("types")),
            genres=_str_list(d.get("genres")),
            social_media=_clean_dict(d.get("social_media")),
            venue_name=_clean_str(d.get("venue_name")),
            start_datetime=_clean_str(d.get("start_datetime") or d.get("start_time")),
            end_datetime=_clean_str(d.get("end_datetime") or d.get("end_time")),
            timezone=_clean_str(d.get("timezone")),
            when_text=_clean_str(d.get("when_text")),
            where_text=_clean_str(d.get("where_text")),
            artists=_str_list(d.get("artists")),
            price=EventPrice.from_ai(d.get("price")),
            food_available=food if isinstance(food, bool) or food is None else None,
            age_restriction=_clean_str(d.get("age_restriction")),
            categories=_str_list(d.get("categories")),
            tags=_str_list(d.get("tags")),
            ticket_url=_clean_str(d.get("ticket_url")),
            event_url=_clean_str(d.get("event_url")),
            images=_str_list(d.get("images")),
            source_domain=_clean_str(d.get("source_domain")),
            source_url=_clean_str(d.get("source_url")),
        )

    def to_mapper_dict(self) -> dict:
        return self.model_dump(mode="json")


class EventsExtraction(BaseModel):
    """Top-level result of an events-mode AI extraction."""

    model_config = ConfigDict(extra="ignore")

    events: list[EventExtraction] = Field(default_factory=list)
    venue: VenueExtraction | None = None

    @classmethod
    def from_ai_dict(cls, raw: Any) -> "EventsExtraction":
        d = _clean_dict(raw)
        events_raw = _clean_list(d.get("events"))
        venue_raw = d.get("venue")
        venue = VenueExtraction.from_ai_dict(venue_raw) if isinstance(venue_raw, dict) else None
        if venue is not None and not venue.venue_name and venue.venue_address.is_empty():
            venue = None
        return cls(
            events=[EventExtraction.from_ai_dict(e) for e in events_raw if isinstance(e, dict)],
            venue=venue,
        )

    def to_mapper_dict(self) -> dict:
        return {
            "events": [e.to_mapper_dict() for e in self.events],
            "venue": self.venue.to_mapper_dict() if self.venue else None,
        }

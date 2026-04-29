"""Unified prompt that asks the AI for venue + events + artists in one shot."""

import json
import re
from datetime import datetime, timezone


class UnifiedPrompts:

    @staticmethod
    def get_unified_extraction_prompt(
        url: str,
        text_content: str,
        structured_data: list,
        meta_data: dict,
        phones: list,
        emails: list,
    ) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"""
You are analyzing the website at {url}. Extract THREE kinds of information in a single JSON
response: a venue (if any), upcoming events (if any), and performing artists (if any).
Return ONLY a JSON object — no prose, no markdown fences.

CURRENT DATE: {today}
- Use this date to resolve relative phrases ("tomorrow", "this Friday", "next month").
- When the page lists a date with no year (e.g. "Friday Sept 12"), assume the next occurrence
  on or after the current date — never default to a past year.

WEBSITE CONTENT TO ANALYZE:
{text_content}

Additional context from scraping:
Found Structured Data: {structured_data}
Found Meta Data: {meta_data}
Found Phones: {phones}
Found Emails: {emails}

Return a JSON object with this exact shape:

{{
  "venue": {{
    "venue_name": "string",
    "description": "string (1-3 sentence summary of the venue)",
    "venue_address": {{
      "street": "string", "city": "string", "state": "string",
      "zip_code": "string", "country": "string"
    }},
    "legal_entity_name": "string",
    "legal_entity_address": {{
      "street": "string", "city": "string", "state": "string",
      "zip_code": "string", "country": "string"
    }},
    "federal_id_number": "string",
    "primary_contact": {{
      "name": "string", "phone": "string", "phone_type": "landline or mobile",
      "alt_phone": "string", "alt_phone_type": "landline or mobile", "email": "string"
    }},
    "venue_type": "Pick exactly one of: Bar, Restaurant, Theatre, Concert Hall, Art Gallery, Cinema, Museum, Church, Park, Private, Hotel, Stadium, Arena, Library, Marina, Other",
    "website": "string",
    "phone_number": "string",
    "capacity": "string",
    "confidence_score": "number between 0-100"
  }} or null,

  "events": [
    {{
      "title": "string",
      "description": "string or null",
      "target_audience": "Under 12 | Under 21 | Over 21 | All Ages or null",
      "types": ["string"],
      "genres": ["string"],
      "social_media": {{ "instagram": "string|null", "facebook": "string|null", "tiktok": "string|null" }},
      "venue_name": "string",
      "start_datetime": "ISO 8601 with timezone",
      "end_datetime": "ISO 8601 with timezone or null",
      "timezone": "string or null",
      "when_text": "string or null",
      "where_text": "string or null",
      "artists": ["string (stage names of performers at this event)"],
      "price": {{ "has_cover": "bool|null", "amount": "number|null", "currency": "string|null", "text": "string|null" }},
      "food_available": "bool|null",
      "age_restriction": "string|null",
      "categories": ["string"],
      "tags": ["string"],
      "ticket_url": "string|null",
      "event_url": "string|null",
      "images": ["string"],
      "source_domain": "string",
      "source_url": "string"
    }}
  ],

  "artists": [
    {{
      "stage_name": "string (the artist or band's name as written on the page)",
      "genre": "string or null"
    }}
  ]
}}

Rules:
1. Always emit all three keys. Use null for "venue" when the page is clearly not a venue
   profile. Use [] for "events" or "artists" when none are found.
2. Venue: if information is missing, use "N/A" or null. Do NOT invent addresses or contacts.
3. Events: extract EVERY upcoming event you can find on the page — do not stop at the
   first 3 or 5. Event listings, calendars, and "what's on" sections often contain dozens
   of entries; include all of them. Only include events with a parseable date that
   resolves to a specific calendar day (use the CURRENT DATE above to resolve relative
   phrasing). Map dates to ISO 8601 with the YEAR matching CURRENT DATE or later — never
   emit a past year. Skip vague recurring mentions like "open mic every Thursday" unless
   a specific upcoming date is also stated. If no timezone is visible, infer from context
   or leave null. CRITICAL: if an event runs past midnight (e.g. "9pm – 12:30am"), the
   end_datetime is on the FOLLOWING calendar day — advance the date so end_datetime is
   strictly greater than start_datetime. If you cannot tell, leave end_datetime null
   rather than emitting an end that is at or before the start.
4. Artists: only include performers/acts that clearly appear on the page (event lineups,
   roster sections, "who's playing" lists, etc.). Do NOT invent artists. Each artist's
   `stage_name` must be unique within the array.
5. Cross-reference: every name listed in an event's `artists` array MUST also appear as a
   top-level entry in the `artists` array (so they can be linked relationally).
6. Phone numbers should be formatted consistently. Addresses should be broken into
   components.
7. Skip duplicates within each list.
8. Return ONLY the JSON object — no additional text.
"""

    @staticmethod
    def create_compact_text(full_text: str) -> str:
        """Keyword-windowed compaction covering venue + event + artist signals."""
        keywords = [
            # event keywords
            "event", "events", "live music", "band", "dj", "music", "concert",
            "calendar", "schedule", "date", "time", "pm", "am", "tonight",
            "lineup", "performing", "presents", "tickets",
            # venue keywords
            "about", "contact", "address", "hours", "located", "venue",
            "phone", "email",
            # artist keywords
            "artist", "artists", "performer", "performers", "roster",
        ]
        windows: list[str] = []
        for kw in keywords:
            for m in re.finditer(kw, full_text, flags=re.IGNORECASE):
                start = max(0, m.start() - 300)
                end = min(len(full_text), m.end() + 300)
                windows.append(full_text[start:end])

        if not windows:
            windows = [full_text[:4000]]

        return "\n...\n".join(windows[:60])[:30_000]

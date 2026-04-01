"""Prompt templates for AI-based event data extraction."""

import json
import re


class EventPrompts:

    @staticmethod
    def get_event_extraction_prompt(
        url: str, compact_text: str, structured_data: list
    ) -> str:
        return f"""
You are given content from a website at {url}. Extract upcoming events as an array of JSON
objects matching this schema (and ONLY return JSON):

Event {{
  title: string,
  target_audience: string (one of: Under 12 | Under 21 | Over 21 | All Ages) or null,
  types: string[],
  genres: string[],
  social_media: {{ instagram?: string|null, facebook?: string|null, tiktok?: string|null }},
  venue_name: string,
  start_datetime: ISO 8601 with timezone,
  end_datetime: ISO 8601 with timezone or null,
  timezone: string or null,
  when_text: string or null,
  where_text: string or null,
  artists: string[],
  price: {{ has_cover?: boolean, amount?: number|null, currency?: string|null, text?: string|null }},
  food_available: boolean|null,
  age_restriction: string|null,
  categories: string[],
  tags: string[],
  ticket_url: string|null,
  event_url: string|null,
  images: string[],
  source_domain: string,
  source_url: string
}}

Also, if the page contains a clear venue profile (name/address/website), return a minimal
venue object under key "venue" with fields: name, address {{ street, city, state, zip_code, country }}, website.

WEBSITE CONTENT (truncated, keyword windows):
{compact_text}

Structured data found:
{json.dumps(structured_data, indent=2)}

Rules:
- Return strictly valid JSON with keys: "events" (array) and optional "venue" (object).
- Map dates to ISO 8601 strings. If no timezone is visible, infer from context if possible or leave null.
- If a field is unknown, set it to null or an empty array as appropriate.
- Limit to realistic upcoming events; skip duplicates.
"""

    @staticmethod
    def create_compact_text(full_text: str) -> str:
        """Extract keyword-windowed snippets to keep prompt tokens manageable."""
        keywords = [
            "event", "events", "live music", "band", "dj", "music", "concert",
            "calendar", "schedule", "date", "time", "pm", "am", "tonight",
        ]
        windows: list[str] = []
        for kw in keywords:
            for m in re.finditer(kw, full_text, flags=re.IGNORECASE):
                start = max(0, m.start() - 300)
                end = min(len(full_text), m.end() + 300)
                windows.append(full_text[start:end])

        if not windows:
            windows = [full_text[:4000]]

        return "\n...\n".join(windows[:40])[:20_000]

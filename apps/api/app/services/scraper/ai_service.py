"""AI service for extracting structured venue/event data."""

import json
import re

import google.generativeai as genai
from groq import Groq

from .config import (
    get_ai_provider,
    get_gemini_model,
    get_google_api_key,
    get_groq_api_key,
    get_groq_model,
)
from .prompts.event_prompts import EventPrompts
from .prompts.venue_prompts import VenuePrompts
from .schemas import EventsExtraction, VenueExtraction

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        genai.configure(api_key=get_google_api_key())
        _configured = True


class AIService:
    """Process raw scraped HTML through AI provider to get structured data."""

    def __init__(self) -> None:
        self.provider = get_ai_provider()
        self.model = None
        self.client = None

        if self.provider == "gemini":
            _ensure_configured()
            self.model = genai.GenerativeModel(get_gemini_model())
        elif self.provider == "groq":
            api_key = get_groq_api_key().strip()
            if not api_key:
                raise ValueError("GROQ_API_KEY is missing while SCRAPER_AI_PROVIDER=groq")
            self.client = Groq(api_key=api_key)
        else:
            raise ValueError(
                f"Unsupported SCRAPER_AI_PROVIDER '{self.provider}'. Use 'gemini' or 'groq'.",
            )

    def process_venue_data(self, raw_data: dict) -> dict:
        try:
            url = raw_data.get("url", "")
            prompt = VenuePrompts.get_venue_extraction_prompt(
                url=url,
                text_content=raw_data.get("text_content", ""),
                structured_data=raw_data.get("structured_data", []),
                meta_data=raw_data.get("meta_data", {}),
                phones=raw_data.get("phones", []),
                emails=raw_data.get("emails", []),
            )
            result = self._generate(prompt, url)
            parsed = self._parse_json(result)
            if "error" in parsed:
                return parsed
            return VenueExtraction.from_ai_dict(parsed).to_mapper_dict()
        except Exception as e:
            return {"error": f"AI processing error: {e}"}

    def process_events_data(self, raw_data: dict) -> dict:
        try:
            url = raw_data.get("url", "")
            compact_text = EventPrompts.create_compact_text(raw_data.get("text_content", ""))
            prompt = EventPrompts.get_event_extraction_prompt(
                url=url,
                compact_text=compact_text,
                structured_data=raw_data.get("structured_data", []),
            )
            result = self._generate(prompt, url)
            parsed = self._parse_json(result)
            if "error" in parsed:
                return parsed
            return EventsExtraction.from_ai_dict(parsed).to_mapper_dict()
        except Exception as e:
            return {"error": f"AI processing error: {e}"}

    # ------------------------------------------------------------------

    def _generate(self, prompt: str, url: str) -> str:
        if self.provider == "gemini":
            try:
                resp = self.model.generate_content([prompt, url])
                return resp.text.strip()
            except Exception:
                resp = self.model.generate_content(prompt)
                return resp.text.strip()

        if self.provider == "groq":
            request_text = f"{prompt}\n\nSource URL: {url}"
            resp = self.client.chat.completions.create(
                model=get_groq_model(),
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Extract structured data and respond with valid JSON only. "
                            "Do not include markdown fences."
                        ),
                    },
                    {"role": "user", "content": request_text},
                ],
                temperature=0.1,
            )
            return (resp.choices[0].message.content or "").strip()

        raise ValueError(
            f"Unsupported SCRAPER_AI_PROVIDER '{self.provider}'. Use 'gemini' or 'groq'.",
        )

    @staticmethod
    def _parse_json(text: str) -> dict:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Some models return valid JSON followed by notes/disclaimers.
            # Decode only the first valid JSON value and ignore trailing text.
            decoder = json.JSONDecoder()
            for pattern in (r"\{[\s\S]*", r"\[[\s\S]*"):
                m = re.search(pattern, text)
                if not m:
                    continue
                candidate = m.group().strip()
                try:
                    parsed, _ = decoder.raw_decode(candidate)
                    if isinstance(parsed, dict):
                        return parsed
                    if isinstance(parsed, list):
                        return {"data": parsed}
                except json.JSONDecodeError:
                    continue
            return {"error": "Failed to parse structured data from AI response"}

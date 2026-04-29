"""AI service for extracting structured venue/event data."""

from __future__ import annotations

import json
import logging
import re

import google.generativeai as genai
from groq import Groq

from .config import (
    get_ai_provider,
    get_gemini_model_chain,
    get_google_api_key,
    get_groq_api_key,
    get_groq_model,
)
from .prompts.unified_prompts import UnifiedPrompts
from .schemas import UnifiedExtraction

logger = logging.getLogger(__name__)

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        genai.configure(api_key=get_google_api_key())
        _configured = True


# Substrings of the str(exc) we treat as "this model is rate-limited / out of
# quota — try the next one." Includes both google.api_core's ResourceExhausted
# format and the bare 429 wording from the REST surface.
_QUOTA_MARKERS = ("429", "ResourceExhausted", "quota", "rate limit", "RATE_LIMIT")


def _is_quota_error(exc: BaseException) -> bool:
    msg = str(exc)
    return any(m.lower() in msg.lower() for m in _QUOTA_MARKERS)


class AIService:
    """Process raw scraped HTML through AI provider to get structured data."""

    def __init__(self) -> None:
        self.provider = get_ai_provider()
        self.gemini_models: list[tuple[str, "genai.GenerativeModel"]] = []
        self.client = None

        if self.provider == "gemini":
            _ensure_configured()
            chain = get_gemini_model_chain()
            if not chain:
                raise ValueError("No Gemini model configured (gemini_model is empty)")
            self.gemini_models = [(name, genai.GenerativeModel(name)) for name in chain]
        elif self.provider == "groq":
            api_key = get_groq_api_key().strip()
            if not api_key:
                raise ValueError("GROQ_API_KEY is missing while SCRAPER_AI_PROVIDER=groq")
            self.client = Groq(api_key=api_key)
        else:
            raise ValueError(
                f"Unsupported SCRAPER_AI_PROVIDER '{self.provider}'. Use 'gemini' or 'groq'.",
            )

    def process_unified_data(self, raw_data: dict) -> dict:
        """Single-call extraction for venue + events + artists."""
        try:
            url = raw_data.get("url", "")
            text_content = raw_data.get("text_content", "")
            compact_text = UnifiedPrompts.create_compact_text(text_content)
            prompt = UnifiedPrompts.get_unified_extraction_prompt(
                url=url,
                text_content=compact_text,
                structured_data=raw_data.get("structured_data", []),
                meta_data=raw_data.get("meta_data", {}),
                phones=raw_data.get("phones", []),
                emails=raw_data.get("emails", []),
            )
            result = self._generate(prompt, url)
            parsed = self._parse_json(result)
            if "error" in parsed:
                return parsed
            return UnifiedExtraction.from_ai_dict(parsed).to_mapper_dict()
        except Exception as e:
            return {"error": f"AI processing error: {e}"}

    # ------------------------------------------------------------------

    def _generate(self, prompt: str, url: str) -> str:
        if self.provider == "gemini":
            last_exc: Exception | None = None
            for idx, (name, model) in enumerate(self.gemini_models):
                try:
                    try:
                        resp = model.generate_content([prompt, url])
                    except Exception:
                        # Some models reject list-form input; retry single-string.
                        resp = model.generate_content(prompt)
                    if idx > 0:
                        logger.info("Gemini fallback succeeded with model '%s'", name)
                    return resp.text.strip()
                except Exception as exc:
                    last_exc = exc
                    if _is_quota_error(exc) and idx < len(self.gemini_models) - 1:
                        next_name = self.gemini_models[idx + 1][0]
                        logger.warning(
                            "Gemini model '%s' quota exhausted; falling back to '%s'",
                            name, next_name,
                        )
                        continue
                    # Non-quota failure on a single model: don't burn the rest of
                    # the chain on the same call — surface the error.
                    raise
            # All models exhausted with quota errors.
            raise RuntimeError(
                f"All Gemini models exhausted: {[n for n, _ in self.gemini_models]}"
            ) from last_exc

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

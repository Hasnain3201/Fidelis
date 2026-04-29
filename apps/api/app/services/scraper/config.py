"""Scraper-specific configuration constants."""

from app.core.config import settings

REQUEST_TIMEOUT: int = 15
MAX_RETRIES: int = 3
RETRY_DELAY: float = 0.5

# Toggle for verbose [Scraper] / [MultiPage] print statements.
# Set to False to silence the per-job tracing once you're done debugging.
DEBUG_PRINTS: bool = True

# Master switch for multi-page scraping. When True, every scrape job runs the
# MultiPageScraper regardless of the per-request `multi_page` flag. When False,
# every scrape job is single-page regardless of the request. This overrides
# whatever was passed in the API body or stored on the queue row.
MULTI_PAGE_ENABLED: bool = True
USER_AGENT: str = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/91.0.4472.124 Safari/537.36"
)


def get_google_api_key() -> str:
    return settings.google_api_key


def get_gemini_model() -> str:
    return settings.gemini_model


def get_gemini_model_chain() -> list[str]:
    """Return the ordered list of Gemini model IDs to try.

    Always starts with the primary `gemini_model`, followed by each fallback
    in `gemini_model_fallbacks` (de-duplicated). Empty / blank entries are
    dropped.
    """
    primary = (settings.gemini_model or "").strip()
    raw_fallbacks = (settings.gemini_model_fallbacks or "").split(",")
    chain: list[str] = []
    seen: set[str] = set()
    for name in [primary, *raw_fallbacks]:
        n = name.strip()
        if not n or n in seen:
            continue
        seen.add(n)
        chain.append(n)
    return chain


def get_ai_provider() -> str:
    return (settings.scraper_ai_provider or "gemini").strip().lower()


def get_groq_api_key() -> str:
    return settings.groq_api_key


def get_groq_model() -> str:
    return settings.groq_model

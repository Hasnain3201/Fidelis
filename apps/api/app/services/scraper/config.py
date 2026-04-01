"""Scraper-specific configuration constants."""

from app.core.config import settings

REQUEST_TIMEOUT: int = 15
MAX_RETRIES: int = 3
RETRY_DELAY: float = 0.5
USER_AGENT: str = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/91.0.4472.124 Safari/537.36"
)


def get_google_api_key() -> str:
    return settings.google_api_key


def get_gemini_model() -> str:
    return settings.gemini_model


def get_ai_provider() -> str:
    return (settings.scraper_ai_provider or "gemini").strip().lower()


def get_groq_api_key() -> str:
    return settings.groq_api_key


def get_groq_model() -> str:
    return settings.groq_model

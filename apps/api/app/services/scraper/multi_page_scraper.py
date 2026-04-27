"""Multi-page discovery and fetching for venue/event websites.

Runs three complementary strategies to find relevant sub-pages:
  A. Heuristic path probing (HEAD requests against common paths)
  B. Homepage link extraction + keyword scoring
  C. sitemap.xml parsing (best-effort)

All discovered pages are fetched and their text is combined into a single
string that replaces text_content in the raw dict before the AI call, so
no additional AI tokens are spent per extra page.
"""

from __future__ import annotations

import logging
import re
import time
from urllib.parse import urljoin, urlparse, urlunparse, urlencode, parse_qsl

import requests
from bs4 import BeautifulSoup

from . import config as cfg
from .html_extractor import HTMLExtractor

logger = logging.getLogger(__name__)

MAX_PAGES = 5               # 1 primary + up to 4 additional
PAGE_BUDGET_SECONDS = 25    # wall-clock budget for all secondary fetches
HEAD_TIMEOUT = 5            # HEAD probe per heuristic path
FETCH_TIMEOUT = 12          # GET per secondary page
MAX_TEXT_PER_PAGE = 15_000  # chars kept per secondary page before concat
MAX_COMBINED_CHARS = 60_000 # total combined text cap

_VENUE_KEYWORD_SCORES: dict[str, int] = {
    "about": 10, "about-us": 10, "contact": 10, "contact-us": 10,
    "hours": 8, "location": 7, "directions": 5, "info": 6,
    "information": 6, "faq": 4, "team": 3, "staff": 3,
    "history": 3, "story": 3, "menu": 5, "amenities": 4,
}

_EVENTS_KEYWORD_SCORES: dict[str, int] = {
    "events": 10, "calendar": 10, "schedule": 10, "shows": 10,
    "whats-on": 10, "whatson": 10, "gigs": 9, "concerts": 9,
    "live": 7, "music": 6, "entertainment": 5, "listings": 8,
    "upcoming": 7, "programme": 7, "program": 6, "tickets": 6,
    "performances": 8, "lineup": 7,
}

_NEGATIVE_SUBSTRINGS: frozenset[str] = frozenset({
    "login", "signin", "sign-in", "signup", "sign-up", "register",
    "cart", "checkout", "privacy", "terms", "cookie", "sitemap",
    "feed", "rss", "wp-content", "wp-admin", "wp-json", "wp-login",
    "facebook.com", "twitter.com", "instagram.com", "youtube.com",
    "tiktok.com", ".pdf", ".jpg", ".jpeg", ".png", ".gif",
    ".css", ".js", ".xml", "mailto:", "tel:", "#",
})

_VENUE_PATHS: list[tuple[str, int]] = [
    ("/about", 10), ("/about-us", 10), ("/contact", 10), ("/contact-us", 10),
    ("/hours", 8), ("/location", 7), ("/info", 6), ("/faq", 4),
    ("/menu", 5), ("/amenities", 4), ("/directions", 5),
]

_EVENTS_PATHS: list[tuple[str, int]] = [
    ("/events", 10), ("/calendar", 10), ("/schedule", 10), ("/shows", 10),
    ("/whats-on", 10), ("/whatson", 9), ("/gigs", 9), ("/concerts", 9),
    ("/live", 7), ("/upcoming", 7), ("/entertainment", 5),
    ("/performances", 8), ("/lineup", 7), ("/tickets", 6),
]

_UTM_RE = re.compile(r"utm_[^&=]+=[^&]*&?", re.IGNORECASE)


class MultiPageScraper:

    def __init__(self) -> None:
        self.headers = {
            "User-Agent": cfg.USER_AGENT,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/",
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def discover_pages(
        self,
        base_url: str,
        soup: BeautifulSoup,
        mode: str,
    ) -> list[str]:
        """Return up to MAX_PAGES-1 additional URLs to fetch, ranked by score."""
        candidates: dict[str, int] = {}  # normalized_url -> best score

        def _merge(pairs: list[tuple[str, int]]) -> None:
            for url, score in pairs:
                norm = self._normalize_url(url)
                base_norm = self._normalize_url(base_url)
                if norm == base_norm:
                    continue
                if norm in candidates:
                    candidates[norm] = max(candidates[norm], score)
                else:
                    candidates[norm] = score

        _merge(self._extract_links_from_soup(base_url, soup, mode))
        _merge(self._heuristic_paths(base_url, mode))
        _merge(self._sitemap_urls(base_url, mode))

        ranked = sorted(candidates.items(), key=lambda kv: kv[1], reverse=True)
        top = [url for url, _ in ranked[: MAX_PAGES - 1]]
        logger.debug("MultiPageScraper discovered %d candidate pages for %s: %s", len(top), base_url, top)
        return top

    def fetch_additional_pages(
        self,
        urls: list[str],
        enable_render: bool = False,
    ) -> list[dict]:
        """Fetch each URL sequentially, respecting PAGE_BUDGET_SECONDS."""
        results: list[dict] = []
        deadline = time.monotonic() + PAGE_BUDGET_SECONDS

        for url in urls:
            if time.monotonic() >= deadline:
                logger.debug("MultiPageScraper: time budget exhausted, stopping at %d/%d pages", len(results), len(urls))
                break
            page = self._fetch_page_simple(url, enable_render=enable_render)
            if page:
                results.append(page)

        return results

    @staticmethod
    def combine_pages(
        primary_raw: dict,
        additional_pages: list[dict],
        mode: str,
    ) -> str:
        """Concatenate primary + secondary page text with section headers."""
        from .prompts.event_prompts import EventPrompts

        parts: list[str] = []
        primary_text = primary_raw.get("text_content", "")
        parts.append(f"--- PAGE: {primary_raw.get('url', '')} (primary) ---\n\n{primary_text}")

        for page in additional_pages:
            page_text = page.get("text_content", "")[:MAX_TEXT_PER_PAGE]
            if mode == "events":
                page_text = EventPrompts.create_compact_text(page_text)
            header = f"--- PAGE: {page.get('url', '')} ---"
            parts.append(f"{header}\n\n{page_text}")

        combined = "\n\n".join(parts)
        if len(combined) > MAX_COMBINED_CHARS:
            combined = combined[:MAX_COMBINED_CHARS]
        return combined

    @staticmethod
    def merge_phones_emails(
        primary_raw: dict,
        additional_pages: list[dict],
    ) -> tuple[list[str], list[str]]:
        """Deduplicate phones and emails across all pages."""
        seen_phones: set[str] = set()
        seen_emails: set[str] = set()
        phones: list[str] = []
        emails: list[str] = []

        for p in primary_raw.get("phones") or []:
            if p not in seen_phones:
                seen_phones.add(p)
                phones.append(p)
        for e in primary_raw.get("emails") or []:
            norm = e.lower()
            if norm not in seen_emails:
                seen_emails.add(norm)
                emails.append(e)

        for page in additional_pages:
            page_text = page.get("text_content", "")
            p_phones, p_emails = HTMLExtractor._extract_contact_info(page_text)
            for p in p_phones:
                if p not in seen_phones:
                    seen_phones.add(p)
                    phones.append(p)
            for e in p_emails:
                norm = e.lower()
                if norm not in seen_emails:
                    seen_emails.add(norm)
                    emails.append(e)

        return phones, emails

    # ------------------------------------------------------------------
    # Strategy B: homepage link extraction
    # ------------------------------------------------------------------

    def _extract_links_from_soup(
        self,
        base_url: str,
        soup: BeautifulSoup,
        mode: str,
    ) -> list[tuple[str, int]]:
        base_netloc = urlparse(base_url).netloc.lower()
        results: list[tuple[str, int]] = []

        for tag in soup.find_all("a", href=True):
            href: str = tag["href"].strip()
            if not href:
                continue
            abs_url = urljoin(base_url, href)
            parsed = urlparse(abs_url)
            if parsed.netloc.lower() != base_netloc:
                continue
            score = self._score_link(abs_url, mode)
            if score > 0:
                results.append((abs_url, score))

        return results

    # ------------------------------------------------------------------
    # Strategy A: heuristic path probing
    # ------------------------------------------------------------------

    def _heuristic_paths(
        self,
        base_url: str,
        mode: str,
    ) -> list[tuple[str, int]]:
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        paths = _EVENTS_PATHS if mode == "events" else _VENUE_PATHS
        results: list[tuple[str, int]] = []

        for path, score in paths:
            candidate = base + path
            try:
                resp = requests.head(
                    candidate,
                    headers=self.headers,
                    timeout=HEAD_TIMEOUT,
                    allow_redirects=True,
                )
                if resp.status_code in (200, 301, 302, 303):
                    final_url = resp.url if resp.url else candidate
                    results.append((final_url, score))
            except Exception:
                pass

        return results

    # ------------------------------------------------------------------
    # Strategy C: sitemap.xml
    # ------------------------------------------------------------------

    def _sitemap_urls(
        self,
        base_url: str,
        mode: str,
    ) -> list[tuple[str, int]]:
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        results: list[tuple[str, int]] = []

        for sitemap_path in ("/sitemap.xml", "/sitemap_index.xml"):
            try:
                resp = requests.get(
                    base + sitemap_path,
                    headers=self.headers,
                    timeout=8,
                )
                if resp.status_code != 200:
                    continue
                sitemap_soup = BeautifulSoup(resp.content, "lxml-xml")
                for loc in sitemap_soup.find_all("loc"):
                    loc_url = (loc.get_text() or "").strip()
                    if not loc_url:
                        continue
                    score = self._score_link(loc_url, mode)
                    if score > 0:
                        results.append((loc_url, score))
                if results:
                    break
            except Exception:
                pass

        return results

    # ------------------------------------------------------------------
    # Scoring and normalization
    # ------------------------------------------------------------------

    def _score_link(self, href: str, mode: str) -> int:
        lower = href.lower()
        for neg in _NEGATIVE_SUBSTRINGS:
            if neg in lower:
                return -1

        keyword_scores = _EVENTS_KEYWORD_SCORES if mode == "events" else _VENUE_KEYWORD_SCORES
        path = urlparse(href).path.lower()
        segments = re.split(r"[/\-_]", path)
        total = 0
        for seg in segments:
            if seg in keyword_scores:
                total += keyword_scores[seg]

        return total

    @staticmethod
    def _normalize_url(url: str) -> str:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        # Strip utm and tracking params
        qs = parsed.query
        if qs:
            qs = _UTM_RE.sub("", qs).strip("&")
            params = sorted(parse_qsl(qs))
            qs = urlencode(params)
        return urlunparse((scheme, netloc, path, parsed.params, qs, ""))

    # ------------------------------------------------------------------
    # Page fetching
    # ------------------------------------------------------------------

    def _fetch_page_simple(self, url: str, enable_render: bool = False) -> dict | None:
        try:
            resp = requests.get(url, headers=self.headers, timeout=FETCH_TIMEOUT)
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type:
                return None
            if resp.status_code >= 400:
                return None

            soup = BeautifulSoup(resp.content, "lxml")
            text_content = HTMLExtractor._extract_text(soup)

            if enable_render and len(text_content) < 200:
                try:
                    from requests_html import HTMLSession
                    session = HTMLSession()
                    r = session.get(url, headers=self.headers, timeout=FETCH_TIMEOUT)
                    r.html.render(timeout=20, sleep=1)
                    rendered_soup = BeautifulSoup(r.html.html, "lxml")
                    text_content = HTMLExtractor._extract_text(rendered_soup)
                    soup = rendered_soup
                except Exception:
                    pass

            return {"url": url, "text_content": text_content, "soup": soup}
        except Exception as exc:
            logger.debug("MultiPageScraper: failed to fetch %s: %s", url, exc)
            return None

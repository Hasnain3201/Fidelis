"""HTML fetching, parsing, and text extraction."""

import re
import time

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from . import config as cfg


class HTMLExtractor:
    """Fetch a web page and extract clean text + contact info."""

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

    def fetch_page(self, url: str, enable_render: bool = False) -> dict:
        try:
            response = self._fetch_with_retry(url)
            if "error" in response:
                return response

            soup = BeautifulSoup(response["content"], "lxml")
            text_content = self._extract_text(soup)
            phones, emails = self._extract_contact_info(text_content)

            if enable_render:
                rendered = self._try_js_rendering(url)
                if rendered:
                    soup = rendered["soup"]
                    text_content = rendered["text_content"]

            return {
                "url": url,
                "text_content": text_content,
                "title": soup.title.string if soup.title else "",
                "domain": urlparse(url).netloc,
                "phones": phones,
                "emails": emails,
                "soup": soup,
            }
        except Exception as e:
            return {"error": str(e)}

    # ------------------------------------------------------------------

    def _fetch_with_retry(self, url: str) -> dict:
        last_err: Exception | None = None
        for attempt in range(cfg.MAX_RETRIES):
            try:
                resp = requests.get(url, headers=self.headers, timeout=cfg.REQUEST_TIMEOUT)
                resp.raise_for_status()
                return {"content": resp.content}
            except Exception as exc:
                last_err = exc
                if attempt < cfg.MAX_RETRIES - 1:
                    time.sleep(cfg.RETRY_DELAY * (2**attempt))

        domain = urlparse(url).netloc
        return {"error": f"fetch_failed: unable to fetch {domain}: {last_err}"}

    @staticmethod
    def _extract_text(soup: BeautifulSoup) -> str:
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return re.sub(r"\s+", " ", soup.get_text(separator=" ", strip=True))

    @staticmethod
    def _extract_contact_info(text: str) -> tuple[list[str], list[str]]:
        phone_pat = r"(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})"
        email_pat = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"

        phones = [
            f"({m[1]}) {m[2]}-{m[3]}"
            for m in re.findall(phone_pat, text)
            if m[1] and m[2] and m[3]
        ]
        emails = re.findall(email_pat, text)
        return phones, emails

    def _try_js_rendering(self, url: str) -> dict | None:
        try:
            from requests_html import HTMLSession

            session = HTMLSession()
            r = session.get(url, headers=self.headers, timeout=20)
            r.html.render(timeout=20, sleep=1)
            rendered_html = r.html.html or ""
            if rendered_html:
                soup = BeautifulSoup(rendered_html, "lxml")
                for tag in soup(["script", "style", "noscript"]):
                    tag.decompose()
                text = re.sub(r"\s+", " ", soup.get_text(separator=" ", strip=True))
                return {"soup": soup, "text_content": text}
        except (ImportError, Exception):
            pass
        return None

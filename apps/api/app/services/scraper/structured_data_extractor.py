"""Extract JSON-LD, microdata, and meta tags from parsed HTML."""

import json
from typing import Any

from bs4 import BeautifulSoup


class StructuredDataExtractor:

    def extract(self, soup: BeautifulSoup) -> dict[str, Any]:
        return {
            "json_ld": self._json_ld(soup),
            "microdata": self._microdata(soup),
            "meta_data": self._meta(soup),
        }

    @staticmethod
    def _json_ld(soup: BeautifulSoup) -> list[dict]:
        items: list[dict] = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                raw = script.string or ""
                if len(raw) > 100_000:
                    raw = raw[:100_000]
                items.append(json.loads(raw))
            except (json.JSONDecodeError, AttributeError):
                continue
        return items

    @staticmethod
    def _microdata(soup: BeautifulSoup) -> list[dict]:
        items: list[dict] = []
        for scope in soup.find_all(attrs={"itemscope": True}):
            item: dict[str, str] = {}
            for prop in scope.find_all(attrs={"itemprop": True}):
                name = prop.get("itemprop")
                value = prop.get("content") or prop.get_text(strip=True)
                if name and value:
                    item[name] = value
            if item:
                items.append(item)
        return items

    @staticmethod
    def _meta(soup: BeautifulSoup) -> dict[str, str]:
        data: dict[str, str] = {}
        for meta in soup.find_all("meta"):
            name = meta.get("name") or meta.get("property")
            content = meta.get("content")
            if name and content:
                data[name] = content
        return data

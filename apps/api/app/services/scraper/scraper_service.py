"""Orchestrates HTML fetching and structured-data extraction."""

from .html_extractor import HTMLExtractor
from .structured_data_extractor import StructuredDataExtractor


class ScraperService:
    """Fetch a URL and return a unified raw-data dict."""

    def __init__(self) -> None:
        self.html_extractor = HTMLExtractor()
        self.structured_extractor = StructuredDataExtractor()

    def extract_venue_data(self, url: str, enable_render: bool = False) -> dict:
        try:
            html_data = self.html_extractor.fetch_page(url, enable_render)
            if "error" in html_data:
                return html_data

            structured = self.structured_extractor.extract(html_data["soup"])

            return {
                "url": url,
                "text_content": html_data["text_content"],
                "structured_data": structured["json_ld"],
                "microdata": structured["microdata"],
                "meta_data": structured["meta_data"],
                "phones": html_data["phones"],
                "emails": html_data["emails"],
                "title": html_data["title"],
                "domain": html_data["domain"],
                "render_used": enable_render,
            }
        except Exception as e:
            return {"error": str(e)}

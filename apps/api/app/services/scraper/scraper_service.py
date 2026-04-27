"""Orchestrates HTML fetching and structured-data extraction."""

from .html_extractor import HTMLExtractor
from .structured_data_extractor import StructuredDataExtractor


class ScraperService:
    """Fetch a URL and return a unified raw-data dict."""

    def __init__(self) -> None:
        self.html_extractor = HTMLExtractor()
        self.structured_extractor = StructuredDataExtractor()

    def extract_venue_data(
        self,
        url: str,
        enable_render: bool = False,
        multi_page: bool = False,
        mode: str = "venue",
    ) -> dict:
        try:
            html_data = self.html_extractor.fetch_page(url, enable_render)
            if "error" in html_data:
                return html_data

            structured = self.structured_extractor.extract(html_data["soup"])

            if multi_page:
                from .multi_page_scraper import MultiPageScraper
                mp = MultiPageScraper()
                additional_urls = mp.discover_pages(url, html_data["soup"], mode)
                additional_pages = mp.fetch_additional_pages(additional_urls, enable_render)
                text_content = mp.combine_pages(html_data, additional_pages, mode)
                phones, emails = mp.merge_phones_emails(html_data, additional_pages)
                pages_visited = [url] + [p["url"] for p in additional_pages]
            else:
                text_content = html_data["text_content"]
                phones = html_data["phones"]
                emails = html_data["emails"]
                pages_visited = [url]

            return {
                "url": url,
                "text_content": text_content,
                "structured_data": structured["json_ld"],
                "microdata": structured["microdata"],
                "meta_data": structured["meta_data"],
                "phones": phones,
                "emails": emails,
                "title": html_data["title"],
                "domain": html_data["domain"],
                "render_used": enable_render,
                "multi_page": multi_page,
                "pages_visited": pages_visited,
            }
        except Exception as e:
            return {"error": str(e)}

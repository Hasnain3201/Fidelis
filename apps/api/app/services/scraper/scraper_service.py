"""Orchestrates HTML fetching and structured-data extraction."""

from . import config as cfg
from .html_extractor import HTMLExtractor
from .structured_data_extractor import StructuredDataExtractor


def _dprint(msg: str) -> None:
    if cfg.DEBUG_PRINTS:
        print(msg)


class ScraperService:
    """Fetch a URL and return a unified raw-data dict."""

    def __init__(self) -> None:
        self.html_extractor = HTMLExtractor()
        self.structured_extractor = StructuredDataExtractor()

    def extract_venue_data(
        self,
        url: str,
        enable_render: bool = False,
        multi_page: bool = True,
    ) -> dict:
        try:
            requested_multi_page = multi_page
            multi_page = bool(cfg.MULTI_PAGE_ENABLED)
            if multi_page != requested_multi_page:
                _dprint(f"[Scraper] config.MULTI_PAGE_ENABLED={multi_page} overrides requested={requested_multi_page}")
            _dprint(f"[Scraper] extract_venue_data url={url} multi_page={multi_page} enable_render={enable_render}")
            html_data = self.html_extractor.fetch_page(url, enable_render)
            if "error" in html_data:
                return html_data

            structured = self.structured_extractor.extract(html_data["soup"])

            if multi_page:
                _dprint(f"[Scraper] multi_page=True; running MultiPageScraper for {url}")
                from .multi_page_scraper import MultiPageScraper
                mp = MultiPageScraper()
                additional_urls = mp.discover_pages(url, html_data["soup"])
                additional_pages = mp.fetch_additional_pages(additional_urls, enable_render)
                text_content = mp.combine_pages(html_data, additional_pages)
                phones, emails = mp.merge_phones_emails(html_data, additional_pages)
                pages_visited = [url] + [p["url"] for p in additional_pages]
                _dprint(f"[Scraper] pages_visited={pages_visited}")
            else:
                _dprint(f"[Scraper] multi_page=False; single-page only")
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

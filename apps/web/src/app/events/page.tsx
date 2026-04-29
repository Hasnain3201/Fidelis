"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { EventShowcaseCard, type EventCardItem } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import { searchEventsWithFilters, type EventSummary } from "@/lib/api";
import { isValidZipCode, normalizeZipInput, toZip5 } from "@/lib/zip";

import { getCoverImage } from "@/lib/cover-images";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://fidelisappsapi-production.up.railway.app";



const RECOMMENDED_PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 6;

const CATEGORY_OPTIONS = [
  "Live Music",
  "Concert",
  "Comedy",
  "DJ Set",
  "Acoustic",
  "Electronic",
];

const CATEGORY_TOKEN_MAP: Record<string, string[]> = {
  "Live Music": ["music", "live-music"],
  Concert: ["concert", "music"],
  Comedy: ["comedy", "comedy-show"],
  "DJ Set": ["dj-set", "dj", "electronic", "music"],
  Acoustic: ["acoustic", "music"],
  Electronic: ["electronic", "dj-set", "music"],
};

type RecommendedSource = "recommended" | "trending";

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapSummaryToCardItem(item: EventSummary, index: number): EventCardItem {
  const categoryLabel = toTitleCase(item.category);
  return {
    id: item.id,
    title: item.title,
    subtitle: categoryLabel,
    description: `Hosted by ${item.venue_name}. Open event details to view full schedule and ticket info.`,
    dateLabel: formatDateLabel(item.start_time),
    timeLabel: formatTimeLabel(item.start_time),
    zipCode: item.zip_code ?? "",
    location: item.zip_code ?? "Location TBD",
    venue: item.venue_name,
    price: "TBD",
    image: getCoverImage(item.cover_image_url, "event"),
    tags: [categoryLabel],
  };
}

function buildApiCategories(selected: string[]): string[] {
  const out = new Set<string>();
  for (const label of selected) {
    for (const token of CATEGORY_TOKEN_MAP[label] ?? []) out.add(token);
  }
  return [...out];
}

function toStartIso(dateValue: string): string | undefined {
  if (!dateValue) return undefined;
  return `${dateValue}T00:00:00.000Z`;
}

function toEndIso(dateValue: string): string | undefined {
  if (!dateValue) return undefined;
  return `${dateValue}T23:59:59.999Z`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;
  try {
    const parsed = JSON.parse(text) as { detail?: string; message?: string; error?: string };
    return parsed.detail || parsed.message || parsed.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function fetchEventList(path: string, accessToken?: string): Promise<EventSummary[]> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as EventSummary[];
}

export default function EventsSearchPage() {
  // Recommended shelf
  const [recommendedItems, setRecommendedItems] = useState<EventCardItem[]>([]);
  const [recommendedMessage, setRecommendedMessage] = useState("");
  const [recommendedSource, setRecommendedSource] = useState<RecommendedSource>("trending");
  const [recommendedPage, setRecommendedPage] = useState(0);

  // Search filters
  const [query, setQuery] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Search results
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [zipError, setZipError] = useState("");
  const [dateError, setDateError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [searchResults, setSearchResults] = useState<EventCardItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const recommendedLastPage = Math.max(
    0,
    Math.ceil(recommendedItems.length / RECOMMENDED_PAGE_SIZE) - 1,
  );

  const recommendedPageItems = useMemo(() => {
    const start = recommendedPage * RECOMMENDED_PAGE_SIZE;
    return recommendedItems.slice(start, start + RECOMMENDED_PAGE_SIZE);
  }, [recommendedItems, recommendedPage]);

  useEffect(() => {
    setRecommendedPage((page) => Math.min(page, recommendedLastPage));
  }, [recommendedLastPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendedShelf() {
      try {
        const session = getStoredAuthSession();
        let source: RecommendedSource = "trending";
        let items: EventSummary[] = [];

        if (session?.accessToken) {
          try {
            items = await fetchEventList("/api/v1/events/recommended", session.accessToken);
            source = "recommended";
          } catch {
            items = [];
          }
        }

        if (items.length === 0) {
          items = await fetchEventList("/api/v1/events/trending");
          source = "trending";
        }

        if (cancelled) return;

        setRecommendedSource(source);
        setRecommendedItems(items.map(mapSummaryToCardItem));
        setRecommendedMessage(items.length ? "" : "No events available yet.");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load events.";
        setRecommendedItems([]);
        setRecommendedSource("trending");
        setRecommendedMessage(`Recommended events unavailable (${message}).`);
      }
    }

    void loadRecommendedShelf();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleCategory(label: string) {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  }

  function resetFilters() {
    setQuery("");
    setVenueQuery("");
    setZipCode("");
    setCity("");
    setStateCode("");
    setStartDate("");
    setEndDate("");
    setSelectedCategories([]);
    setZipError("");
    setDateError("");
    setStatusMessage("");
    setHasSearched(false);
    setSearchResults([]);
    setCurrentPage(1);
    setTotalResults(0);
  }

  function validateInputs(): boolean {
    if (zipCode.trim() && !isValidZipCode(zipCode.trim())) {
      setZipError("Use ZIP format 12345 or 12345-6789.");
      return false;
    }
    setZipError("");

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setDateError("Start date must be before end date.");
      return false;
    }
    setDateError("");

    if (stateCode.trim() && stateCode.trim().length !== 2) {
      setStatusMessage("State should be a 2-letter code (e.g., NJ, NY, CA).");
      return false;
    }

    return true;
  }

  async function runSearch(nextPage: number) {
    const hasAnyInput =
      query.trim() ||
      venueQuery.trim() ||
      zipCode.trim() ||
      city.trim() ||
      stateCode.trim() ||
      startDate ||
      endDate ||
      selectedCategories.length > 0;

    if (!hasAnyInput) {
      setHasSearched(false);
      setSearchResults([]);
      setCurrentPage(1);
      setTotalResults(0);
      setStatusMessage("");
      return;
    }

    if (!validateInputs()) return;

    setIsSearching(true);
    setStatusMessage("");

    try {
      const response = await searchEventsWithFilters({
        query: query.trim() || undefined,
        venue: venueQuery.trim() || undefined,
        zip: zipCode.trim() ? toZip5(zipCode) : undefined,
        city: city.trim() || undefined,
        state: stateCode.trim() ? stateCode.trim().toUpperCase() : undefined,
        categories: buildApiCategories(selectedCategories),
        startAfter: toStartIso(startDate),
        startBefore: toEndIso(endDate),
        sort: "recommended",
        page: nextPage,
        limit: SEARCH_PAGE_SIZE,
      });

      setHasSearched(true);
      setCurrentPage(nextPage);
      setTotalResults(response.total);
      setSearchResults(
        response.items.map((item, idx) =>
          mapSummaryToCardItem(item, (nextPage - 1) * SEARCH_PAGE_SIZE + idx),
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Search is temporarily unavailable.";
      setHasSearched(true);
      setCurrentPage(1);
      setTotalResults(0);
      setSearchResults([]);
      setStatusMessage(`Search unavailable (${message}).`);
    } finally {
      setIsSearching(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalResults / SEARCH_PAGE_SIZE));

  return (
    <>
      <section className="siteSection fullWidthSection">
        <div className="fullWidthInner">
          <div className="shelfWrap">
            <div className="shelfHeading">
              <h2 className="shelfTitle">
                {recommendedSource === "recommended" ? "Recommended Events For You" : "Trending Events"}
              </h2>
              <div className="shelfPager">
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Previous recommended events"
                  onClick={() => setRecommendedPage((page) => Math.max(0, page - 1))}
                  disabled={recommendedPage === 0}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Next recommended events"
                  onClick={() =>
                    setRecommendedPage((page) => Math.min(recommendedLastPage, page + 1))
                  }
                  disabled={recommendedPage >= recommendedLastPage}
                >
                  →
                </button>
              </div>
            </div>

            {recommendedMessage ? <p className="meta">{recommendedMessage}</p> : null}

            <div className="cardsGrid five">
              {recommendedPageItems.map((item) => (
                <EventShowcaseCard key={`recommended-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection fullWidthSection" style={{ paddingTop: 0 }}>
        <div className="fullWidthInner">
          <div className="shelfHeading">
            <h2 className="shelfTitle">Find Your Own Events!</h2>
          </div>
          <div className="discoveryLayout">
            <aside className="filterPanel searchFilterPanel" aria-busy={isSearching}>
              <form onSubmit={onSubmit} noValidate>
                <div className="searchFilterHeader">
                  <h2>Search Filters</h2>
                  <button
                    type="button"
                    className="textResetBtn"
                    onClick={resetFilters}
                    disabled={isSearching}
                  >
                    Reset
                  </button>
                </div>

                <label className="filterField">
                  <span>Search</span>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, 120))}
                    placeholder="Artist, event title, keyword..."
                    maxLength={120}
                    disabled={isSearching}
                  />
                </label>

                <label className="filterField">
                  <span>Venue</span>
                  <Input
                    value={venueQuery}
                    onChange={(e) => setVenueQuery(e.target.value.slice(0, 100))}
                    placeholder="Venue name"
                    maxLength={100}
                    disabled={isSearching}
                  />
                </label>

                <div className="filterField">
                  <span>Location</span>
                  <div className="inlineFields threeCol">
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value.slice(0, 60))}
                      placeholder="City"
                      maxLength={60}
                      disabled={isSearching}
                    />
                    <Input
                      value={stateCode}
                      onChange={(e) =>
                        setStateCode(
                          e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2),
                        )
                      }
                      placeholder="State"
                      maxLength={2}
                      disabled={isSearching}
                    />
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(normalizeZipInput(e.target.value))}
                      onBlur={() =>
                        setZipError(
                          zipCode.trim() && !isValidZipCode(zipCode)
                            ? "Use ZIP format 12345 or 12345-6789."
                            : "",
                        )
                      }
                      placeholder="ZIP"
                      inputMode="numeric"
                      maxLength={10}
                      disabled={isSearching}
                      aria-invalid={Boolean(zipError)}
                    />
                  </div>
                </div>

                {zipError ? (
                  <p className="fieldError" role="alert" style={{ marginBottom: 10 }}>
                    {zipError}
                  </p>
                ) : null}

                <div className="filterField">
                  <span>Start & End Date</span>
                  <div className="inlineFields twoCol">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isSearching}
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isSearching}
                    />
                  </div>
                </div>

                {dateError ? (
                  <p className="fieldError" role="alert" style={{ marginBottom: 10 }}>
                    {dateError}
                  </p>
                ) : null}

                <div className="filterField">
                  <span>Categories</span>
                  <div className="checkboxGrid">
                    {CATEGORY_OPTIONS.map((label) => {
                      const checked = selectedCategories.includes(label);
                      return (
                        <label key={label} className="checkItem">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(label)}
                            disabled={isSearching}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pageActions" style={{ marginTop: 12, marginBottom: 0 }}>
                  <button type="submit" className="pageActionLink" disabled={isSearching}>
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </div>
              </form>
            </aside>

            <div>
              {hasSearched ? (
                <>
                  <div className="sectionHeader listHeader">
                    <div>
                      <h2>Search Results</h2>
                      <p>{isSearching ? "Updating results..." : `${totalResults} events found`}</p>
                    </div>
                  </div>

                  {statusMessage ? <p className="statusBanner error">{statusMessage}</p> : null}

                  {!isSearching && searchResults.length === 0 && !statusMessage ? (
                    <div className="emptyStateCard" style={{ marginTop: 12 }}>
                      <h3 style={{ margin: 0 }}>No events matched your search</h3>
                      <p className="meta" style={{ margin: 0 }}>
                        Try broadening your location/date/category filters.
                      </p>
                    </div>
                  ) : null}

                  {searchResults.length > 0 ? (
                    <>
                      <div className="cardsGrid eventsDense" style={{ marginTop: 12 }}>
                        {searchResults.map((item) => (
                          <EventShowcaseCard key={item.id} item={item} />
                        ))}
                      </div>

                      {totalPages > 1 ? (
                        <div
                          style={{
                            marginTop: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            className="textResetBtn"
                            onClick={() => void runSearch(Math.max(1, currentPage - 1))}
                            disabled={isSearching || currentPage <= 1}
                          >
                            Prev
                          </button>

                          <div className="meta">
                            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                          </div>

                          <button
                            type="button"
                            className="textResetBtn"
                            onClick={() => void runSearch(Math.min(totalPages, currentPage + 1))}
                            disabled={isSearching || currentPage >= totalPages}
                          >
                            Next
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

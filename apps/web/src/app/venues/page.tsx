"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { VenueCard, type VenueCardItem } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import { isValidZipCode, normalizeZipInput, toZip5 } from "@/lib/zip";
import type { VenueSummary } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const VENUE_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80",
];

const RECOMMENDED_PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 6;
const RECOMMENDED_LIMIT = 60;

type RecommendedSource = "recommended" | "popular";

type VenueSearchResponse = {
  items: VenueSummary[];
  page: number;
  limit: number;
  total: number;
};

function pickImage(venueId: string): string {
  let hash = 0;
  for (const char of venueId) hash = (hash + char.charCodeAt(0)) % VENUE_CARD_IMAGES.length;
  return VENUE_CARD_IMAGES[hash];
}

function mapVenueToCard(venue: VenueSummary): VenueCardItem {
  const cityState = [venue.city, venue.state].filter(Boolean).join(", ");
  const location = cityState || venue.zip_code;

  return {
    id: venue.id,
    name: venue.name,
    tagline: venue.verified ? "Verified venue" : "Community venue",
    description: venue.description?.trim() || "Venue profile details are available on event pages.",
    location,
    image: pickImage(venue.id),
    tags: [venue.zip_code],
    badge: venue.verified ? "Verified" : "Venue",
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as {
      detail?: string | { msg?: string } | Array<{ msg?: string }>;
      message?: string;
      error?: string;
    };

    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
  }

  return `Request failed (${response.status})`;
}

async function fetchPopularVenues(limit = RECOMMENDED_LIMIT): Promise<VenueSummary[]> {
  const url = new URL("/api/v1/venues/popular", API_BASE);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSummary[];
}

async function fetchRecommendedVenues(accessToken: string, limit = RECOMMENDED_LIMIT): Promise<VenueSummary[]> {
  const url = new URL("/api/v1/venues/recommended", API_BASE);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSummary[];
}

async function searchVenues(params: {
  query?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  verified?: boolean;
  page: number;
  limit: number;
}): Promise<VenueSearchResponse> {
  const url = new URL("/api/v1/venues/search", API_BASE);

  if (params.query?.trim()) url.searchParams.set("query", params.query.trim());
  if (params.city?.trim()) url.searchParams.set("city", params.city.trim());
  if (params.state?.trim()) url.searchParams.set("state", params.state.trim().toUpperCase());
  if (params.zip_code?.trim()) url.searchParams.set("zip_code", params.zip_code.trim());
  if (typeof params.verified === "boolean") url.searchParams.set("verified", String(params.verified));
  if (params.page > 1) url.searchParams.set("page", String(params.page));
  url.searchParams.set("limit", String(params.limit));

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSearchResponse;
}

function buildCombinedVenueQuery(searchText: string, venueText: string): string {
  return [searchText.trim(), venueText.trim()].filter(Boolean).join(" ").trim();
}

export default function VenuesPage() {
  // Recommended shelf
  const [recommendedSource, setRecommendedSource] = useState<RecommendedSource>("popular");
  const [recommendedItems, setRecommendedItems] = useState<VenueCardItem[]>([]);
  const [recommendedMessage, setRecommendedMessage] = useState("");
  const [recommendedPage, setRecommendedPage] = useState(0);

  // Search filters
  const [searchText, setSearchText] = useState("");
  const [venueText, setVenueText] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Search results
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [zipError, setZipError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [results, setResults] = useState<VenueCardItem[]>([]);

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

    async function loadShelf() {
      try {
        const session = getStoredAuthSession();

        if (session?.accessToken) {
          try {
            const rec = await fetchRecommendedVenues(session.accessToken, RECOMMENDED_LIMIT);
            if (!cancelled && rec.length > 0) {
              setRecommendedSource("recommended");
              setRecommendedItems(rec.map(mapVenueToCard));
              setRecommendedMessage("");
              return;
            }
          } catch {
          }
        }

        const popular = await fetchPopularVenues(RECOMMENDED_LIMIT);
        if (cancelled) return;

        setRecommendedSource("popular");
        setRecommendedItems(popular.map(mapVenueToCard));
        setRecommendedMessage(popular.length ? "" : "No venues available yet.");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load venues.";
        setRecommendedSource("popular");
        setRecommendedItems([]);
        setRecommendedMessage(`Venue shelf unavailable (${message}).`);
      }
    }

    void loadShelf();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetFilters() {
    setSearchText("");
    setVenueText("");
    setZipCode("");
    setCity("");
    setStateCode("");
    setVerifiedOnly(false);

    setZipError("");
    setStatusMessage("");

    setHasSearched(false);
    setCurrentPage(1);
    setTotalResults(0);
    setResults([]);
  }

  function validateFilters(): boolean {
    if (zipCode.trim() && !isValidZipCode(zipCode.trim())) {
      setZipError("Use ZIP format 12345 or 12345-6789.");
      return false;
    }
    setZipError("");

    if (stateCode.trim() && stateCode.trim().length !== 2) {
      setStatusMessage("State should be 2-letter code (e.g., NJ, NY, CA).");
      return false;
    }

    return true;
  }

  async function runSearch(nextPage: number) {
    const hasAnyInput =
      searchText.trim() ||
      venueText.trim() ||
      zipCode.trim() ||
      city.trim() ||
      stateCode.trim() ||
      verifiedOnly;

    if (!hasAnyInput) {
      setHasSearched(false);
      setStatusMessage("");
      setCurrentPage(1);
      setTotalResults(0);
      setResults([]);
      return;
    }

    if (!validateFilters()) return;

    setIsSearching(true);
    setStatusMessage("");

    try {
      const response = await searchVenues({
        query: buildCombinedVenueQuery(searchText, venueText) || undefined,
        city: city.trim() || undefined,
        state: stateCode.trim() ? stateCode.trim().toUpperCase() : undefined,
        zip_code: zipCode.trim() ? toZip5(zipCode) : undefined,
        verified: verifiedOnly ? true : undefined,
        page: nextPage,
        limit: SEARCH_PAGE_SIZE,
      });

      setHasSearched(true);
      setCurrentPage(nextPage);
      setTotalResults(response.total);
      setResults(response.items.map(mapVenueToCard));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Venue search is temporarily unavailable.";
      setHasSearched(true);
      setCurrentPage(1);
      setTotalResults(0);
      setResults([]);
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
                {recommendedSource === "recommended" ? "Recommended Venues" : "Popular Venues"}
              </h2>

              <div className="shelfPager">
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Previous recommended venues"
                  onClick={() => setRecommendedPage((page) => Math.max(0, page - 1))}
                  disabled={recommendedPage === 0}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Next recommended venues"
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
                <VenueCard key={`recommended-venue-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection fullWidthSection" style={{ paddingTop: 0 }}>
        <div className="fullWidthInner">
          <div className="shelfWrap">
            <div className="shelfHeading">
              <h2 className="shelfTitle">Find Your Own Venues!</h2>
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
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value.slice(0, 120))}
                      placeholder="Search venues by keyword"
                      maxLength={120}
                      disabled={isSearching}
                    />
                  </label>

                  <label className="filterField">
                    <span>Venue Name</span>
                    <Input
                      value={venueText}
                      onChange={(event) => setVenueText(event.target.value.slice(0, 120))}
                      placeholder="Specific venue name"
                      maxLength={120}
                      disabled={isSearching}
                    />
                  </label>

                  <div className="filterField">
                    <span>Location</span>
                    <div className="inlineFields threeCol">
                      <Input
                        value={city}
                        onChange={(event) => setCity(event.target.value.slice(0, 60))}
                        placeholder="City"
                        maxLength={60}
                        disabled={isSearching}
                      />
                      <Input
                        value={stateCode}
                        onChange={(event) =>
                          setStateCode(
                            event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2),
                          )
                        }
                        placeholder="State"
                        maxLength={2}
                        disabled={isSearching}
                      />
                      <Input
                        value={zipCode}
                        onChange={(event) => setZipCode(normalizeZipInput(event.target.value))}
                        onBlur={() =>
                          setZipError(
                            zipCode.trim() && !isValidZipCode(zipCode)
                              ? "Use ZIP format 12345 or 12345-6789."
                              : "",
                          )
                        }
                        placeholder="ZIP"
                        inputMode="numeric"
                        autoComplete="postal-code"
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
                    <span>Status</span>
                    <label className="checkItem" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={verifiedOnly}
                        onChange={() => setVerifiedOnly((value) => !value)}
                        disabled={isSearching}
                      />
                      Verified venues only
                    </label>
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
                        <p>{isSearching ? "Updating results..." : `${totalResults} venues found`}</p>
                      </div>
                    </div>

                    {statusMessage ? <p className="statusBanner error">{statusMessage}</p> : null}

                    {!isSearching && results.length === 0 && !statusMessage ? (
                      <div className="emptyStateCard" style={{ marginTop: 12 }}>
                        <h3 style={{ margin: 0 }}>No venues matched your search</h3>
                        <p className="meta" style={{ margin: 0 }}>
                          Try broadening location or turning off verified-only.
                        </p>
                      </div>
                    ) : null}

                    {results.length > 0 ? (
                      <>
                        <div className="cardsGrid eventsDense" style={{ marginTop: 12 }}>
                          {results.map((item) => (
                            <VenueCard key={item.id} item={item} />
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
        </div>
      </section>
    </>
  );
}
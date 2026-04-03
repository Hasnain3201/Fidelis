"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArtistCard, type ArtistCardItem } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import {
  getPopularArtists,
  getRecommendedArtists,
  searchArtistsWithFilters,
  type ArtistSummary,
} from "@/lib/api";

const ARTIST_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80",
];

const RECOMMENDED_PAGE_SIZE = 5;
const SEARCH_PAGE_SIZE = 6;
const SHELF_LIMIT = 60;

type ShelfSource = "recommended" | "trending";

const GENRE_OPTIONS = [
  "Any genre",
  "Pop",
  "Rock",
  "Hip Hop",
  "R&B",
  "EDM",
  "Jazz",
  "Country",
  "Latin",
  "Indie",
  "Comedy",
];

function pickImage(artistId: string): string {
  let hash = 0;
  for (const char of artistId) hash = (hash + char.charCodeAt(0)) % ARTIST_CARD_IMAGES.length;
  return ARTIST_CARD_IMAGES[hash];
}

function mapArtistToCard(artist: ArtistSummary): ArtistCardItem {
  const genreLabel = artist.genre?.trim() || "Genre TBD";
  return {
    id: artist.id,
    name: artist.stage_name,
    location: genreLabel,
    description: artist.bio?.trim() || "Artist profile details are available on linked event pages.",
    image: pickImage(artist.id),
    tags: [genreLabel],
    badge: "Artist",
  };
}

function buildQueryText(searchText: string, artistName: string): string {
  return [searchText.trim(), artistName.trim()].filter(Boolean).join(" ").trim();
}

export default function ArtistsPage() {
  // Shelf state
  const [shelfSource, setShelfSource] = useState<ShelfSource>("trending");
  const [shelfItems, setShelfItems] = useState<ArtistCardItem[]>([]);
  const [shelfMessage, setShelfMessage] = useState("");
  const [shelfPage, setShelfPage] = useState(0);

  // Filter state
  const [searchText, setSearchText] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("Any genre");

  // Search result state
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<ArtistCardItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const shelfLastPage = Math.max(0, Math.ceil(shelfItems.length / RECOMMENDED_PAGE_SIZE) - 1);

  const shelfPageItems = useMemo(() => {
    const start = shelfPage * RECOMMENDED_PAGE_SIZE;
    return shelfItems.slice(start, start + RECOMMENDED_PAGE_SIZE);
  }, [shelfItems, shelfPage]);

  useEffect(() => {
    setShelfPage((page) => Math.min(page, shelfLastPage));
  }, [shelfLastPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadShelf() {
      try {
        const session = getStoredAuthSession();

        if (session) {
          try {
            const recommended = await getRecommendedArtists(session, SHELF_LIMIT);
            if (cancelled) return;

            if (recommended.length > 0) {
              setShelfSource("recommended");
              setShelfItems(recommended.map(mapArtistToCard));
              setShelfMessage("");
              return;
            }
          } catch {
            // fallback to trending below
          }
        }

        const popular = await getPopularArtists(SHELF_LIMIT);
        if (cancelled) return;

        setShelfSource("trending");
        setShelfItems(popular.map(mapArtistToCard));
        setShelfMessage(popular.length ? "" : "No artists available yet.");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load artists.";
        setShelfSource("trending");
        setShelfItems([]);
        setShelfMessage(`Artist shelf unavailable (${message}).`);
      }
    }

    void loadShelf();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetFilters() {
    setSearchText("");
    setArtistName("");
    setGenre("Any genre");
    setStatusMessage("");
    setHasSearched(false);
    setResults([]);
    setTotalResults(0);
    setCurrentPage(1);
  }

  async function runSearch(nextPage: number) {
    const hasAnyInput = searchText.trim() || artistName.trim() || genre !== "Any genre";

    if (!hasAnyInput) {
      setHasSearched(false);
      setResults([]);
      setTotalResults(0);
      setCurrentPage(1);
      setStatusMessage("");
      return;
    }

    setIsSearching(true);
    setStatusMessage("");

    try {
      const response = await searchArtistsWithFilters({
        query: buildQueryText(searchText, artistName) || undefined,
        genre: genre !== "Any genre" ? genre : undefined,
        page: nextPage,
        limit: SEARCH_PAGE_SIZE,
      });

      setHasSearched(true);
      setCurrentPage(nextPage);
      setTotalResults(response.total);
      setResults(response.items.map(mapArtistToCard));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Artist search is temporarily unavailable.";
      setHasSearched(true);
      setResults([]);
      setTotalResults(0);
      setCurrentPage(1);
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
                {shelfSource === "recommended" ? "Recommended Artists" : "Trending Artists"}
              </h2>
              <div className="shelfPager">
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Previous artists page"
                  onClick={() => setShelfPage((page) => Math.max(0, page - 1))}
                  disabled={shelfPage === 0}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="shelfPagerBtn"
                  aria-label="Next artists page"
                  onClick={() => setShelfPage((page) => Math.min(shelfLastPage, page + 1))}
                  disabled={shelfPage >= shelfLastPage}
                >
                  →
                </button>
              </div>
            </div>

            {shelfMessage ? <p className="meta">{shelfMessage}</p> : null}

            <div className="cardsGrid five">
              {shelfPageItems.map((item) => (
                <ArtistCard key={`artist-shelf-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection fullWidthSection" style={{ paddingTop: 0 }}>
        <div className="fullWidthInner">
          <div className="shelfWrap">
            <div className="shelfHeading">
              <h2 className="shelfTitle">Find Your Own Artists!</h2>
            </div>
            <p className="shelfHint">Use filters on the left, then search to see matching artists.</p>

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
                      placeholder="Search artists by keyword"
                      maxLength={120}
                      disabled={isSearching}
                    />
                  </label>

                  <label className="filterField">
                    <span>Artist Name</span>
                    <Input
                      value={artistName}
                      onChange={(event) => setArtistName(event.target.value.slice(0, 120))}
                      placeholder="Specific artist name"
                      maxLength={120}
                      disabled={isSearching}
                    />
                  </label>

                  <label className="filterField">
                    <span>Genre</span>
                    <select
                      className="uiSelect"
                      value={genre}
                      onChange={(event) => setGenre(event.target.value)}
                      disabled={isSearching}
                    >
                      {GENRE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

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
                        <p>{isSearching ? "Updating results..." : `${totalResults} artists found`}</p>
                      </div>
                    </div>

                    {statusMessage ? <p className="statusBanner error">{statusMessage}</p> : null}

                    {!isSearching && results.length === 0 && !statusMessage ? (
                      <div className="emptyStateCard" style={{ marginTop: 12 }}>
                        <h3 style={{ margin: 0 }}>No artists matched your search</h3>
                        <p className="meta" style={{ margin: 0 }}>
                          Try broadening your search terms or selecting a different genre.
                        </p>
                      </div>
                    ) : null}

                    {results.length > 0 ? (
                      <>
                        <div className="cardsGrid eventsDense" style={{ marginTop: 12 }}>
                          {results.map((item) => (
                            <ArtistCard key={item.id} item={item} />
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
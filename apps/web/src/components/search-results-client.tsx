"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { EventShowcaseCard } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import { EVENT_ITEMS, type EventItem } from "@/lib/mock-content";
import { isValidZipCode, normalizeZipInput, zipMatchesEvent } from "@/lib/zip";

const CATEGORY_FILTERS = ["All", "Live Music", "Concert", "Comedy", "DJ", "Acoustic", "Electronic"];
const EVENT_TYPE_OPTIONS = ["Live Music", "Concert", "DJ Set", "Comedy Show", "Acoustic", "Band", "Indie Pop"];

type DateWindow = "any" | "weekend" | "next7" | "next30";
type PriceFilter = "any" | "free" | "under25" | "under40";
type SortBy = "recommended" | "dateSoonest" | "dateLatest" | "priceLow";

function parseEventDateTime(item: EventItem): Date | null {
  const baseLabel = item.dateLabel.includes(",") ? item.dateLabel.split(",")[1].trim() : item.dateLabel.trim();
  const year = new Date().getFullYear();
  const parsedDate = new Date(`${baseLabel}, ${year}`);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const timeMatch = item.timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return parsedDate;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3].toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  parsedDate.setHours(hours, minutes, 0, 0);
  return parsedDate;
}

function parsePriceValue(rawPrice: string): number {
  if (rawPrice.toLowerCase().includes("free")) return 0;
  const match = rawPrice.match(/(\d+(\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]);
}

function matchesDateWindow(item: EventItem, window: DateWindow): boolean {
  if (window === "any") return true;
  const eventDate = parseEventDateTime(item);
  if (!eventDate) return false;

  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  if (diffMs < 0) return false;

  if (window === "weekend") {
    const day = eventDate.getDay();
    return day === 5 || day === 6 || day === 0;
  }
  if (window === "next7") return diffMs <= 7 * 24 * 60 * 60 * 1000;
  if (window === "next30") return diffMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function sortResults(items: EventItem[], sortBy: SortBy): EventItem[] {
  if (sortBy === "recommended") return items;

  const sorted = [...items];
  if (sortBy === "priceLow") {
    sorted.sort((a, b) => parsePriceValue(a.price) - parsePriceValue(b.price));
    return sorted;
  }

  sorted.sort((a, b) => {
    const aDate = parseEventDateTime(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDate = parseEventDateTime(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (sortBy === "dateLatest") return bDate - aDate;
    return aDate - bDate;
  });

  return sorted;
}

export function SearchResultsClient() {
  const params = useSearchParams();
  const paramsKey = params.toString();

  const [query, setQuery] = useState(() => (params.get("query") ?? "").trim().slice(0, 120));
  const [zipCode, setZipCode] = useState(() => normalizeZipInput(params.get("zip") ?? params.get("location") ?? ""));
  const [zipError, setZipError] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dateWindow, setDateWindow] = useState<DateWindow>("any");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("any");
  const [sortBy, setSortBy] = useState<SortBy>("recommended");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [results, setResults] = useState<EventItem[]>(EVENT_ITEMS);
  const [isFiltering, setIsFiltering] = useState(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const nextParams = new URLSearchParams(paramsKey);
    const nextQuery = (nextParams.get("query") ?? "").trim().slice(0, 120);
    const nextZip = normalizeZipInput(nextParams.get("zip") ?? nextParams.get("location") ?? "");
    setQuery(nextQuery);
    setZipCode(nextZip);
  }, [paramsKey]);

  useEffect(() => {
    const hasInvalidZip = zipCode.trim() && !isValidZipCode(zipCode);
    setZipError(hasInvalidZip ? "Use ZIP format 12345 or 12345-6789." : "");

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsFiltering(true);

    const timer = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return;

      const normalizedQuery = query.trim().toLowerCase();
      const normalizedVenue = venueQuery.trim().toLowerCase();
      const filtered = EVENT_ITEMS.filter((item) => {
        const queryMatch =
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.venue.toLowerCase().includes(normalizedQuery) ||
          item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

        const zipMatch = !zipCode.trim() || (isValidZipCode(zipCode) && zipMatchesEvent(zipCode, item.zipCode));
        const venueMatch = !normalizedVenue || item.venue.toLowerCase().includes(normalizedVenue);
        const categoryMatch =
          activeCategory === "All" ||
          item.subtitle.toLowerCase().includes(activeCategory.toLowerCase()) ||
          item.tags.some((tag) => tag.toLowerCase().includes(activeCategory.toLowerCase()));
        const eventTypeMatch =
          selectedTypes.length === 0 ||
          selectedTypes.some((type) => {
            const normalizedType = type.toLowerCase();
            return (
              item.subtitle.toLowerCase().includes(normalizedType) ||
              item.tags.some((tag) => tag.toLowerCase().includes(normalizedType))
            );
          });
        const dateMatch = matchesDateWindow(item, dateWindow);

        const priceValue = parsePriceValue(item.price);
        const priceMatch =
          priceFilter === "any" ||
          (priceFilter === "free" && priceValue === 0) ||
          (priceFilter === "under25" && priceValue <= 25) ||
          (priceFilter === "under40" && priceValue <= 40);

        return queryMatch && zipMatch && venueMatch && categoryMatch && eventTypeMatch && dateMatch && priceMatch;
      });

      setResults(sortResults(filtered, sortBy));
      setIsFiltering(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [activeCategory, dateWindow, priceFilter, query, sortBy, selectedTypes, venueQuery, zipCode]);

  function toggleEventType(value: string) {
    setSelectedTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function resetFilters() {
    setVenueQuery("");
    setActiveCategory("All");
    setDateWindow("any");
    setPriceFilter("any");
    setSortBy("recommended");
    setSelectedTypes([]);
  }

  const activeFilterCount =
    selectedTypes.length + (activeCategory !== "All" ? 1 : 0) + (dateWindow !== "any" ? 1 : 0) + (priceFilter !== "any" ? 1 : 0);

  return (
    <div className="searchLayout">
      <aside className="filterPanel searchFilterPanel">
        <div className="searchFilterHeader">
          <h2>Filters</h2>
          <button type="button" className="textResetBtn" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <label className="filterField">
          <span>Venue</span>
          <Input
            type="text"
            value={venueQuery}
            onChange={(event) => setVenueQuery(event.target.value)}
            placeholder="Filter by venue"
            maxLength={100}
          />
        </label>

        <label className="filterField">
          <span>Date Range</span>
          <select className="uiSelect" value={dateWindow} onChange={(event) => setDateWindow(event.target.value as DateWindow)}>
            <option value="any">Any date</option>
            <option value="weekend">This weekend</option>
            <option value="next7">Next 7 days</option>
            <option value="next30">Next 30 days</option>
          </select>
        </label>

        <label className="filterField">
          <span>Price</span>
          <select className="uiSelect" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}>
            <option value="any">Any price</option>
            <option value="free">Free only</option>
            <option value="under25">$25 and under</option>
            <option value="under40">$40 and under</option>
          </select>
        </label>

        <label className="filterField">
          <span>Sort</span>
          <select className="uiSelect" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
            <option value="recommended">Recommended</option>
            <option value="dateSoonest">Date (soonest)</option>
            <option value="dateLatest">Date (latest)</option>
            <option value="priceLow">Price (low to high)</option>
          </select>
        </label>

        <div className="filterField">
          <span>Event Types</span>
          <div className="checkboxGrid">
            {EVENT_TYPE_OPTIONS.map((item) => {
              const checked = selectedTypes.includes(item);
              return (
                <label key={item} className="checkItem">
                  <input type="checkbox" checked={checked} onChange={() => toggleEventType(item)} />
                  {item}
                </label>
              );
            })}
          </div>
        </div>
      </aside>

      <div>
        <div className="sectionHeader listHeader">
          <div>
            <h1>Search Results</h1>
            <p>
              {isFiltering ? "Updating results..." : `${results.length} events found`}
              {activeFilterCount > 0 ? ` • ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : ""}
            </p>
          </div>
        </div>

        <div className="searchControls">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 120))}
            placeholder="Search events, artists, venues"
            maxLength={120}
          />
          <Input
            value={zipCode}
            onChange={(event) => setZipCode(normalizeZipInput(event.target.value))}
            onBlur={() => setZipError(zipCode && !isValidZipCode(zipCode) ? "Use ZIP format 12345 or 12345-6789." : "")}
            placeholder="ZIP code"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            aria-invalid={Boolean(zipError)}
          />
        </div>
        {zipError ? (
          <p className="fieldError" role="alert">
            {zipError}
          </p>
        ) : null}

        <FilterBar items={CATEGORY_FILTERS} activeItem={activeCategory} onSelect={setActiveCategory} />

        {isFiltering ? (
          <div className="cardsGrid eventsDense stateSkeletonGrid" style={{ marginTop: 16 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`search-loading-${idx}`} className="stateSkeletonCard" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="emptyStateCard" style={{ marginTop: 16 }}>
            <h3>No events matched these filters.</h3>
            <p className="meta">Try removing a filter, broadening the date range, or searching with a different ZIP code.</p>
          </div>
        ) : (
          <div className="cardsGrid eventsDense" style={{ marginTop: 16 }}>
            {results.map((item) => (
              <EventShowcaseCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

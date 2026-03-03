"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const PAGE_SIZE = 12;

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
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = params.toString();

  // ---- URL helper (writes params without refresh) ----
  function setParams(next: Record<string, string | null | undefined>) {
    const sp = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "All") {
        sp.delete(key);
      } else {
        sp.set(key, value);
      }
    }

    const nextUrl = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  // ---- local state ----
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

  // pagination
  const [page, setPage] = useState(1);

  // typing debounce (avoid URL updating on every keystroke)
  const queryDebounceRef = useRef<number | null>(null);
  const venueDebounceRef = useRef<number | null>(null);

  // ---- read ALL filters from URL whenever URL changes ----
  useEffect(() => {
    const nextParams = new URLSearchParams(paramsKey);

    const nextQuery = (nextParams.get("query") ?? "").trim().slice(0, 120);
    const nextZip = normalizeZipInput(nextParams.get("zip") ?? nextParams.get("location") ?? "");
    const nextVenue = (nextParams.get("venue") ?? "").slice(0, 100);

    const nextCategoryRaw = nextParams.get("category") ?? "All";
    const nextCategory = CATEGORY_FILTERS.includes(nextCategoryRaw) ? nextCategoryRaw : "All";

    const nextDate = (nextParams.get("date") as DateWindow) ?? "any";
    const nextPrice = (nextParams.get("price") as PriceFilter) ?? "any";
    const nextSort = (nextParams.get("sort") as SortBy) ?? "recommended";

    const typesRaw = nextParams.get("types") ?? "";
    const nextTypes = typesRaw ? typesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

    setQuery(nextQuery);
    setZipCode(nextZip);
    setVenueQuery(nextVenue);
    setActiveCategory(nextCategory);
    setDateWindow(nextDate);
    setPriceFilter(nextPrice);
    setSortBy(nextSort);
    setSelectedTypes(nextTypes);

    // If URL changes, keep page sane
    setPage(1);
  }, [paramsKey]);

  // ---- filtering behavior (mocked data) ----
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

      const zipReady = zipCode.trim() && isValidZipCode(zipCode);

      const filtered = EVENT_ITEMS.filter((item) => {
        const queryMatch =
          !normalizedQuery ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.venue.toLowerCase().includes(normalizedQuery) ||
          item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

        const zipMatch = !zipCode.trim() ? true : zipReady && zipMatchesEvent(zipCode, item.zipCode);

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
      setPage(1);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [activeCategory, dateWindow, priceFilter, query, sortBy, selectedTypes, venueQuery, zipCode]);

  function toggleEventType(value: string) {
    setSelectedTypes((current) => {
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      setParams({ types: next.length ? next.join(",") : null });
      return next;
    });
  }

  function removeTypeChip(value: string) {
    setSelectedTypes((current) => {
      const next = current.filter((t) => t !== value);
      setParams({ types: next.length ? next.join(",") : null });
      return next;
    });
  }

  function resetFilters() {
    setVenueQuery("");
    setActiveCategory("All");
    setDateWindow("any");
    setPriceFilter("any");
    setSortBy("recommended");
    setSelectedTypes([]);
    setPage(1);

    setParams({
      venue: null,
      category: null,
      date: null,
      price: null,
      sort: null,
      types: null,
    });
  }

  const activeFilterCount =
    selectedTypes.length +
    (activeCategory !== "All" ? 1 : 0) +
    (dateWindow !== "any" ? 1 : 0) +
    (priceFilter !== "any" ? 1 : 0) +
    (venueQuery.trim() ? 1 : 0);

  const zipReady = zipCode.trim() && isValidZipCode(zipCode);

  // chips (applied filters)
  const chips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = [];

    if (activeCategory !== "All") {
      out.push({
        key: `cat:${activeCategory}`,
        label: activeCategory,
        onRemove: () => {
          setActiveCategory("All");
          setParams({ category: null });
        },
      });
    }

    if (dateWindow !== "any") {
      const label = dateWindow === "weekend" ? "This weekend" : dateWindow === "next7" ? "Next 7 days" : "Next 30 days";
      out.push({
        key: `date:${dateWindow}`,
        label,
        onRemove: () => {
          setDateWindow("any");
          setParams({ date: null });
        },
      });
    }

    if (priceFilter !== "any") {
      const label = priceFilter === "free" ? "Free only" : priceFilter === "under25" ? "$25 & under" : "$40 & under";
      out.push({
        key: `price:${priceFilter}`,
        label,
        onRemove: () => {
          setPriceFilter("any");
          setParams({ price: null });
        },
      });
    }

    if (sortBy !== "recommended") {
      const label =
        sortBy === "dateSoonest" ? "Date: soonest" : sortBy === "dateLatest" ? "Date: latest" : "Price: low to high";
      out.push({
        key: `sort:${sortBy}`,
        label,
        onRemove: () => {
          setSortBy("recommended");
          setParams({ sort: null });
        },
      });
    }

    if (venueQuery.trim()) {
      out.push({
        key: `venue:${venueQuery}`,
        label: `Venue: ${venueQuery.trim()}`,
        onRemove: () => {
          setVenueQuery("");
          setParams({ venue: null });
        },
      });
    }

    for (const t of selectedTypes) {
      out.push({
        key: `type:${t}`,
        label: t,
        onRemove: () => removeTypeChip(t),
      });
    }

    return out;
  }, [activeCategory, dateWindow, priceFilter, sortBy, selectedTypes, venueQuery]);

  // pagination slicing
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = results.slice(pageStart, pageStart + PAGE_SIZE);

  // summary text
  const summaryParts: string[] = [];
  if (query.trim()) summaryParts.push(`“${query.trim()}”`);
  if (activeCategory !== "All") summaryParts.push(activeCategory);
  if (venueQuery.trim()) summaryParts.push(`Venue: ${venueQuery.trim()}`);
  if (dateWindow !== "any") summaryParts.push(dateWindow === "weekend" ? "This weekend" : dateWindow === "next7" ? "Next 7 days" : "Next 30 days");
  if (priceFilter !== "any") summaryParts.push(priceFilter === "free" ? "Free" : priceFilter === "under25" ? "Under $25" : "Under $40");
  if (selectedTypes.length) summaryParts.push(`${selectedTypes.length} type${selectedTypes.length === 1 ? "" : "s"}`);

  const disableInputs = isFiltering;

  return (
    <div className="searchLayout">
      <aside className="filterPanel searchFilterPanel" aria-busy={disableInputs}>
        <div className="searchFilterHeader">
          <h2>Filters</h2>
          <button type="button" className="textResetBtn" onClick={resetFilters} disabled={disableInputs}>
            Reset
          </button>
        </div>

        <label className="filterField">
          <span>Venue</span>
          <Input
            type="text"
            value={venueQuery}
            disabled={disableInputs}
            onChange={(event) => {
              const v = event.target.value.slice(0, 100);
              setVenueQuery(v);

              if (venueDebounceRef.current) window.clearTimeout(venueDebounceRef.current);
              venueDebounceRef.current = window.setTimeout(() => {
                setParams({ venue: v });
              }, 300);
            }}
            placeholder="Filter by venue"
            maxLength={100}
          />
        </label>

        <label className="filterField">
          <span>Date Range</span>
          <select
            className="uiSelect"
            value={dateWindow}
            disabled={disableInputs}
            onChange={(event) => {
              const v = event.target.value as DateWindow;
              setDateWindow(v);
              setParams({ date: v });
            }}
          >
            <option value="any">Any date</option>
            <option value="weekend">This weekend</option>
            <option value="next7">Next 7 days</option>
            <option value="next30">Next 30 days</option>
          </select>
        </label>

        <label className="filterField">
          <span>Price</span>
          <select
            className="uiSelect"
            value={priceFilter}
            disabled={disableInputs}
            onChange={(event) => {
              const v = event.target.value as PriceFilter;
              setPriceFilter(v);
              setParams({ price: v });
            }}
          >
            <option value="any">Any price</option>
            <option value="free">Free only</option>
            <option value="under25">$25 and under</option>
            <option value="under40">$40 and under</option>
          </select>
        </label>

        <label className="filterField">
          <span>Sort</span>
          <select
            className="uiSelect"
            value={sortBy}
            disabled={disableInputs}
            onChange={(event) => {
              const v = event.target.value as SortBy;
              setSortBy(v);
              setParams({ sort: v });
            }}
          >
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
                  <input type="checkbox" checked={checked} disabled={disableInputs} onChange={() => toggleEventType(item)} />
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
              {zipCode.trim() ? ` • near ${zipCode.trim()}` : ""}
              {summaryParts.length ? ` • matching ${summaryParts.join(" • ")}` : ""}
              {activeFilterCount > 0 ? ` • ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : ""}
            </p>
          </div>
        </div>

        <div className="searchControls">
          <Input
            value={query}
            disabled={disableInputs}
            onChange={(event) => {
              const v = event.target.value.slice(0, 120);
              setQuery(v);

              if (queryDebounceRef.current) window.clearTimeout(queryDebounceRef.current);
              queryDebounceRef.current = window.setTimeout(() => {
                setParams({ query: v });
              }, 300);
            }}
            placeholder="Search events, artists, venues"
            maxLength={120}
          />
          <Input
            value={zipCode}
            disabled={disableInputs}
            onChange={(event) => {
              const v = normalizeZipInput(event.target.value);
              setZipCode(v);
              setParams({ zip: v });
            }}
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

        <FilterBar
          items={CATEGORY_FILTERS}
          activeItem={activeCategory}
          onSelect={(value) => {
            setActiveCategory(value);
            setParams({ category: value });
          }}
        />

        {/* Applied filter chips */}
        {chips.length ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                disabled={disableInputs}
                className="tagPill"
                title="Remove filter"
                style={{ cursor: disableInputs ? "not-allowed" : "pointer" }}
              >
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}

        {isFiltering ? (
          <div className="cardsGrid eventsDense stateSkeletonGrid" style={{ marginTop: 16 }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`search-loading-${idx}`} className="stateSkeletonCard" />
            ))}
          </div>
        ) : !zipCode.trim() ? (
          <div className="emptyStateCard" style={{ marginTop: 16 }}>
            <h3>Enter a ZIP code to see events.</h3>
            <p className="meta">We’ll show nearby events once you provide a ZIP.</p>
          </div>
        ) : !zipReady ? (
          <div className="emptyStateCard" style={{ marginTop: 16 }}>
            <h3>That ZIP code doesn’t look right.</h3>
            <p className="meta">Use ZIP format 12345 or 12345-6789.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="emptyStateCard" style={{ marginTop: 16 }}>
            <h3>No events matched these filters.</h3>
            <p className="meta">Try removing Price, widening the Date Range, clearing Event Types, or searching a nearby ZIP.</p>
          </div>
        ) : (
          <>
            <div className="cardsGrid eventsDense" style={{ marginTop: 16 }}>
              {pageItems.map((item) => (
                <EventShowcaseCard key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="textResetBtn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={disableInputs || safePage === 1}
                >
                  Prev
                </button>

                <div className="meta">
                  Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
                </div>

                <button
                  type="button"
                  className="textResetBtn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={disableInputs || safePage === totalPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
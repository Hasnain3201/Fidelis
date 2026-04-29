"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { EventShowcaseCard, type EventCardItem } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import {
  searchEventsWithFilters,
  type EventSearchSort,
  type EventSummary,
} from "@/lib/api";
import {
  isValidZipCode,
  normalizeZipInput,
  toZip5,
} from "@/lib/zip";

import { getCoverImage } from "@/lib/cover-images"; 

const CATEGORY_FILTERS = [
  "All",
  "Live Music",
  "Concert",
  "Comedy",
  "DJ",
  "Acoustic",
  "Electronic",
];
const EVENT_TYPE_OPTIONS = [
  "Live Music",
  "Concert",
  "DJ Set",
  "Comedy Show",
  "Acoustic",
  "Band",
  "Indie Pop",
];
const DATE_WINDOWS = ["any", "weekend", "next7", "next30"] as const;
const SORT_OPTIONS = ["recommended", "dateSoonest", "dateLatest"] as const;
const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
const DEFAULT_RADIUS_MILES = 10;

const PAGE_SIZE = 12;

type DateWindow = (typeof DATE_WINDOWS)[number];
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];

type SearchSnapshot = {
  query: string;
  zipCode: string;
  radiusMiles: RadiusMiles;
  venueQuery: string;
  activeCategory: string;
  dateWindow: DateWindow;
  sortBy: EventSearchSort;
  selectedTypes: string[];
  page: number;
};

function parseRadius(value: string | null): RadiusMiles {
  const num = Number(value);
  if (RADIUS_OPTIONS.includes(num as RadiusMiles)) return num as RadiusMiles;
  return DEFAULT_RADIUS_MILES;
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function formatPriceLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "TBD";
  if (value <= 0) return "Free";
  return `$${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`;
}

function parsePriceForFilter(price: string): number | null {
  const normalized = price.trim().toLowerCase();
  if (!normalized || normalized === "tbd" || normalized === "n/a") return null;
  if (normalized.includes("free")) return 0;

  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function mapSummaryToCardItem(item: EventSummary): EventCardItem {
  const categoryLabel = toTitleCase(item.category);
  return {
    id: item.id,
    title: item.title,
    subtitle: categoryLabel,
    description: `Hosted by ${item.venue_name}. Open event details to view the full lineup and schedule.`,
    dateLabel: formatDateLabel(item.start_time),
    timeLabel: formatTimeLabel(item.start_time),
    zipCode: item.zip_code ?? "",
    location: item.zip_code ?? "Location TBD",
    venue: item.venue_name,
    price: formatPriceLabel(item.price),
    image: getCoverImage(item.cover_image_url, "event"),
    tags: [categoryLabel],
  };
}

function toCategoryToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function categoriesForActiveCategory(activeCategory: string): string[] {
  if (activeCategory === "All") return [];
  if (activeCategory === "Live Music") {
    return ["live-music", "concert", "dj-set", "acoustic", "electronic", "band", "indie-pop"];
  }
  if (activeCategory === "Concert") return ["concert", "live-music"];
  if (activeCategory === "Comedy") return ["comedy", "comedy-show"];
  if (activeCategory === "DJ") return ["dj-set", "dj", "electronic"];
  if (activeCategory === "Acoustic") return ["acoustic"];
  if (activeCategory === "Electronic") return ["electronic", "dj-set"];
  return [toCategoryToken(activeCategory)];
}

function categoriesForSelectedTypes(selectedTypes: string[]): string[] {
  const out: string[] = [];

  for (const item of selectedTypes) {
    if (item === "Live Music") {
      out.push("live-music");
      continue;
    }
    if (item === "Concert") {
      out.push("concert");
      continue;
    }
    if (item === "DJ Set") {
      out.push("dj-set", "dj", "electronic");
      continue;
    }
    if (item === "Comedy Show") {
      out.push("comedy-show", "comedy");
      continue;
    }
    if (item === "Acoustic") {
      out.push("acoustic");
      continue;
    }
    if (item === "Band") {
      out.push("band");
      continue;
    }
    if (item === "Indie Pop") {
      out.push("indie-pop");
      continue;
    }

    out.push(toCategoryToken(item));
  }

  return out;
}

function buildApiCategories(activeCategory: string, selectedTypes: string[]): string[] {
  return [...new Set([...categoriesForActiveCategory(activeCategory), ...categoriesForSelectedTypes(selectedTypes)])];
}

function getDateWindowBounds(window: DateWindow): {
  startAfter?: string;
  startBefore?: string;
} {
  const now = new Date();

  if (window === "next7") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { startAfter: now.toISOString(), startBefore: end.toISOString() };
  }

  if (window === "next30") {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return { startAfter: now.toISOString(), startBefore: end.toISOString() };
  }

  if (window === "weekend") {
    const day = now.getDay();

    if (day === 5 || day === 6 || day === 0) {
      const end = new Date(now);
      const daysToSunday = day === 0 ? 0 : 7 - day;
      end.setDate(end.getDate() + daysToSunday);
      end.setHours(23, 59, 59, 999);
      return { startAfter: now.toISOString(), startBefore: end.toISOString() };
    }

    const friday = new Date(now);
    friday.setDate(friday.getDate() + (5 - day));
    friday.setHours(0, 0, 0, 0);

    const sunday = new Date(friday);
    sunday.setDate(sunday.getDate() + 2);
    sunday.setHours(23, 59, 59, 999);

    return { startAfter: friday.toISOString(), startBefore: sunday.toISOString() };
  }

  return {};
}

function parseSort(value: string | null): EventSearchSort {
  if (value && SORT_OPTIONS.includes(value as EventSearchSort)) {
    return value as EventSearchSort;
  }
  return "recommended";
}

function parseDateWindow(value: string | null): DateWindow {
  if (value && DATE_WINDOWS.includes(value as DateWindow)) {
    return value as DateWindow;
  }
  return "any";
}

export function SearchResultsClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = params.toString();

  const [query, setQuery] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [radiusMiles, setRadiusMiles] = useState<RadiusMiles>(DEFAULT_RADIUS_MILES);
  const [zipError, setZipError] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [dateWindow, setDateWindow] = useState<DateWindow>("any");
  const [sortBy, setSortBy] = useState<EventSearchSort>("recommended");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [results, setResults] = useState<EventCardItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isFiltering, setIsFiltering] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: "error"; text: string } | null>(null);
  const [ageFilter, setAgeFilter] = useState<"all" | "18+" | "21+">("all");
  const [maxCost, setMaxCost] = useState<number>(200);

  const requestIdRef = useRef(0);
  const queryDebounceRef = useRef<number | null>(null);
  const venueDebounceRef = useRef<number | null>(null);

  const setParams = useCallback((next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "All" || (key === "page" && value === "1")) {
        sp.delete(key);
      } else {
        sp.set(key, value);
      }
    }

    const nextUrl = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [params, pathname, router]);

  const updatePageInUrl = useCallback((nextPage: number) => {
    setParams({ page: nextPage <= 1 ? null : String(nextPage) });
  }, [setParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(paramsKey);

    const snapshot: SearchSnapshot = {
      query: (nextParams.get("query") ?? "").trim().slice(0, 120),
      zipCode: normalizeZipInput(nextParams.get("zip") ?? nextParams.get("location") ?? ""),
      radiusMiles: parseRadius(nextParams.get("radius")),
      venueQuery: (nextParams.get("venue") ?? "").slice(0, 100),
      activeCategory: "All",
      dateWindow: parseDateWindow(nextParams.get("date")),
      sortBy: parseSort(nextParams.get("sort")),
      selectedTypes: [],
      page: 1,
    };

    const nextCategoryRaw = nextParams.get("category") ?? "All";
    snapshot.activeCategory = CATEGORY_FILTERS.includes(nextCategoryRaw) ? nextCategoryRaw : "All";

    const typesRaw = nextParams.get("types") ?? "";
    snapshot.selectedTypes = typesRaw
      ? typesRaw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => EVENT_TYPE_OPTIONS.includes(item))
      : [];

    const pageValue = Number(nextParams.get("page") ?? "1");
    snapshot.page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;

    setQuery(snapshot.query);
    setZipCode(snapshot.zipCode);
    setRadiusMiles(snapshot.radiusMiles);
    setVenueQuery(snapshot.venueQuery);
    setActiveCategory(snapshot.activeCategory);
    setDateWindow(snapshot.dateWindow);
    setSortBy(snapshot.sortBy);
    setSelectedTypes(snapshot.selectedTypes);
    setCurrentPage(snapshot.page);

    const hasInvalidZip = snapshot.zipCode.trim() && !isValidZipCode(snapshot.zipCode);
    setZipError(hasInvalidZip ? "Use ZIP format 12345 or 12345-6789." : "");

    if (!snapshot.zipCode.trim()) {
      setResults([]);
      setTotalResults(0);
      setStatusMessage(null);
      setIsFiltering(false);
      return;
    }

    if (hasInvalidZip) {
      setResults([]);
      setTotalResults(0);
      setStatusMessage(null);
      setIsFiltering(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsFiltering(true);
    setStatusMessage(null);

    const categories = buildApiCategories(snapshot.activeCategory, snapshot.selectedTypes);
    const windowBounds = getDateWindowBounds(snapshot.dateWindow);

    void searchEventsWithFilters({
      zip: toZip5(snapshot.zipCode),
      radiusMiles: snapshot.radiusMiles,
      query: snapshot.query || undefined,
      venue: snapshot.venueQuery || undefined,
      categories: categories.length ? categories : undefined,
      sort: snapshot.sortBy,
      startAfter: windowBounds.startAfter,
      startBefore: windowBounds.startBefore,
      page: snapshot.page,
      limit: PAGE_SIZE,
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;

        const totalPages = Math.max(1, Math.ceil(response.total / PAGE_SIZE));
        if (snapshot.page > totalPages) {
          updatePageInUrl(totalPages);
          return;
        }

        setResults(
          response.items.map((item) => mapSummaryToCardItem(item)),
        );
        setTotalResults(response.total);
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) return;

        setResults([]);
        setTotalResults(0);

        const message =
          error instanceof Error ? error.message : "Live search is temporarily unavailable.";
        setStatusMessage({
          type: "error",
          text: `Live search unavailable (${message}).`,
        });
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setIsFiltering(false);
        }
      });
  }, [paramsKey, updatePageInUrl]);

  useEffect(() => {
    return () => {
      if (queryDebounceRef.current) window.clearTimeout(queryDebounceRef.current);
      if (venueDebounceRef.current) window.clearTimeout(venueDebounceRef.current);
    };
  }, []);

  function toggleEventType(value: string) {
    const next = selectedTypes.includes(value)
      ? selectedTypes.filter((item) => item !== value)
      : [...selectedTypes, value];
    setSelectedTypes(next);
    setParams({ types: next.length ? next.join(",") : null, page: null });
  }

  const removeTypeChip = useCallback((value: string) => {
    const next = selectedTypes.filter((item) => item !== value);
    setSelectedTypes(next);
    setParams({ types: next.length ? next.join(",") : null, page: null });
  }, [selectedTypes, setParams]);

  function resetFilters() {
    setVenueQuery("");
    setActiveCategory("All");
    setDateWindow("any");
    setSortBy("recommended");
    setSelectedTypes([]);
    setAgeFilter("all");
    setMaxCost(200);
    setParams({
      venue: null,
      category: null,
      date: null,
      price: null,
      sort: null,
      types: null,
      page: null,
    });
  }

  const activeFilterCount =
    selectedTypes.length +
    (activeCategory !== "All" ? 1 : 0) +
    (dateWindow !== "any" ? 1 : 0) +
    (venueQuery.trim() ? 1 : 0) +
    (maxCost < 200 ? 1 : 0);

  const chips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = [];

    if (activeCategory !== "All") {
      out.push({
        key: `cat:${activeCategory}`,
        label: activeCategory,
        onRemove: () => {
          setActiveCategory("All");
          setParams({ category: null, page: null });
        },
      });
    }

    if (dateWindow !== "any") {
      const label =
        dateWindow === "weekend"
          ? "This weekend"
          : dateWindow === "next7"
            ? "Next 7 days"
            : "Next 30 days";
      out.push({
        key: `date:${dateWindow}`,
        label,
        onRemove: () => {
          setDateWindow("any");
          setParams({ date: null, page: null });
        },
      });
    }

    if (sortBy !== "recommended") {
      const label = sortBy === "dateSoonest" ? "Date: soonest" : "Date: latest";
      out.push({
        key: `sort:${sortBy}`,
        label,
        onRemove: () => {
          setSortBy("recommended");
          setParams({ sort: null, page: null });
        },
      });
    }

    if (venueQuery.trim()) {
      out.push({
        key: `venue:${venueQuery}`,
        label: `Venue: ${venueQuery.trim()}`,
        onRemove: () => {
          setVenueQuery("");
          setParams({ venue: null, page: null });
        },
      });
    }

    for (const type of selectedTypes) {
      out.push({
        key: `type:${type}`,
        label: type,
        onRemove: () => removeTypeChip(type),
      });
    }

    return out;
  }, [activeCategory, dateWindow, sortBy, selectedTypes, venueQuery, removeTypeChip, setParams]);

  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

  // Client-side filtering for age and cost (API doesn't support these yet)
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (maxCost < 200) {
        const priceNum = parsePriceForFilter(item.price);
        return priceNum !== null && priceNum <= maxCost;
      }
      // age filter is UI-only for now — API items don't carry age_requirement
      return true;
    });
  }, [results, maxCost]);
  const hasPriceFilteredOutCurrentPage = !isFiltering && maxCost < 200 && totalResults > 0 && filteredResults.length === 0;

  const summaryParts: string[] = [];
  if (query.trim()) summaryParts.push(`"${query.trim()}"`);
  if (activeCategory !== "All") summaryParts.push(activeCategory);
  if (venueQuery.trim()) summaryParts.push(`Venue: ${venueQuery.trim()}`);
  if (dateWindow !== "any") {
    summaryParts.push(
      dateWindow === "weekend"
        ? "This weekend"
        : dateWindow === "next7"
          ? "Next 7 days"
          : "Next 30 days",
    );
  }
  if (selectedTypes.length) {
    summaryParts.push(
      `${selectedTypes.length} type${selectedTypes.length === 1 ? "" : "s"}`,
    );
  }

  const disableInputs = isFiltering;

  return (
    <div className="searchLayout">
      <aside className="filterPanel searchFilterPanel" aria-busy={disableInputs}>
        <div className="searchFilterHeader">
          <h2>Filters</h2>
          <button
            type="button"
            className="textResetBtn"
            onClick={resetFilters}
            disabled={disableInputs}
          >
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
              const value = event.target.value.slice(0, 100);
              setVenueQuery(value);

              if (venueDebounceRef.current) {
                window.clearTimeout(venueDebounceRef.current);
              }
              venueDebounceRef.current = window.setTimeout(() => {
                setParams({ venue: value, page: null });
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
              const value = parseDateWindow(event.target.value);
              setDateWindow(value);
              setParams({ date: value, page: null });
            }}
          >
            <option value="any">Any date</option>
            <option value="weekend">This weekend</option>
            <option value="next7">Next 7 days</option>
            <option value="next30">Next 30 days</option>
          </select>
        </label>

        <label className="filterField">
          <span>Sort</span>
          <select
            className="uiSelect"
            value={sortBy}
            disabled={disableInputs}
            onChange={(event) => {
              const value = parseSort(event.target.value);
              setSortBy(value);
              setParams({ sort: value, page: null });
            }}
          >
            <option value="recommended">Recommended</option>
            <option value="dateSoonest">Date (soonest)</option>
            <option value="dateLatest">Date (latest)</option>
          </select>
        </label>

        <div className="filterField">
          <span>Event Types</span>
          <div className="checkboxGrid">
            {EVENT_TYPE_OPTIONS.map((item) => {
              const checked = selectedTypes.includes(item);
              return (
                <label key={item} className="checkItem">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableInputs}
                    onChange={() => toggleEventType(item)}
                  />
                  {item}
                </label>
              );
            })}
          </div>
        </div>

        <div className="filterField">
          <span>Age Requirement</span>
          <div className="checkboxGrid">
            {(["all", "18+", "21+"] as const).map((age) => (
              <label key={age} className="checkItem">
                <input
                  type="radio"
                  name="ageFilter"
                  checked={ageFilter === age}
                  disabled={disableInputs}
                  onChange={() => setAgeFilter(age)}
                />
                {age === "all" ? "All Ages" : age}
              </label>
            ))}
          </div>
        </div>

        <div className="filterField">
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Max Price</span>
            <strong style={{ color: "#6942d6" }}>{maxCost >= 200 ? "Any" : `$${maxCost}`}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={maxCost}
            disabled={disableInputs}
            onChange={(e) => setMaxCost(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#8048ff", marginTop: 6 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginTop: 2 }}>
            <span>Free</span>
            <span>$200+</span>
          </div>
        </div>
      </aside>

      <div>
        <div className="sectionHeader listHeader">
          <div>
            <h1>Search Results</h1>
            <p>
              {isFiltering ? "Updating results..." : `${totalResults} events found`}
              {zipCode.trim() ? ` • within ${radiusMiles} mi of ${zipCode.trim()}` : ""}
              {summaryParts.length ? ` • matching ${summaryParts.join(" • ")}` : ""}
              {activeFilterCount > 0
                ? ` • ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                : ""}
            </p>
          </div>
        </div>

        <div className="searchControls">
          <Input
            value={query}
            disabled={disableInputs}
            onChange={(event) => {
              const value = event.target.value.slice(0, 120);
              setQuery(value);

              if (queryDebounceRef.current) {
                window.clearTimeout(queryDebounceRef.current);
              }
              queryDebounceRef.current = window.setTimeout(() => {
                setParams({ query: value, page: null });
              }, 300);
            }}
            placeholder="Search events, artists, venues"
            maxLength={120}
          />
          <Input
            value={zipCode}
            disabled={disableInputs}
            onChange={(event) => {
              const value = normalizeZipInput(event.target.value);
              setZipCode(value);
              setParams({ zip: value, page: null });
            }}
            onBlur={() => {
              setZipError(
                zipCode && !isValidZipCode(zipCode)
                  ? "Use ZIP format 12345 or 12345-6789."
                  : "",
              );
            }}
            placeholder="ZIP code"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            aria-invalid={Boolean(zipError)}
          />
          <select
            className="uiSelect"
            value={radiusMiles}
            disabled={disableInputs}
            aria-label="Search radius"
            onChange={(event) => {
              const value = parseRadius(event.target.value);
              setRadiusMiles(value);
              setParams({
                radius: value === DEFAULT_RADIUS_MILES ? null : String(value),
                page: null,
              });
            }}
          >
            {RADIUS_OPTIONS.map((miles) => (
              <option key={miles} value={miles}>
                Within {miles} mi
              </option>
            ))}
          </select>
        </div>

        {zipError ? (
          <p className="fieldError" role="alert">
            {zipError}
          </p>
        ) : null}

        {statusMessage ? <p className="statusBanner error">{statusMessage.text}</p> : null}

        <FilterBar
          items={CATEGORY_FILTERS}
          activeItem={activeCategory}
          onSelect={(value) => {
            setActiveCategory(value);
            setParams({ category: value, page: null });
          }}
        />

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
                {chip.label} <span aria-hidden="true">x</span>
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
          <div className="emptyStateCard" style={{ marginTop: 16, textAlign: "center", padding: "36px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
            <h3 style={{ margin: "0 0 8px" }}>Enter a ZIP code to find events</h3>
            <p className="meta" style={{ margin: 0 }}>
              Type your ZIP code in the search bar above and we will show live events near you.
            </p>
          </div>
        ) : !isValidZipCode(zipCode) ? (
          <div className="emptyStateCard" style={{ marginTop: 16, textAlign: "center", padding: "36px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: "0 0 8px" }}>That ZIP code does not look right</h3>
            <p className="meta" style={{ margin: 0 }}>
              Use a valid US ZIP format like <strong>78701</strong> or <strong>78701-1234</strong>.
            </p>
          </div>
        ) : totalResults === 0 || hasPriceFilteredOutCurrentPage ? (
          <div className="emptyStateCard" style={{ marginTop: 16, textAlign: "center", padding: "36px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
            <h3 style={{ margin: "0 0 8px" }}>
              {hasPriceFilteredOutCurrentPage ? "No events matched your price filter" : "No events matched your search"}
            </h3>
            <p className="meta" style={{ margin: "0 0 16px" }}>
              {hasPriceFilteredOutCurrentPage
                ? "Try increasing the max price or clearing filters."
                : "Try widening the date range, removing filters, or searching a nearby ZIP code."}
            </p>
            <div className="pageActions" style={{ justifyContent: "center", margin: 0 }}>
              <a href="/search" className="pageActionLink secondary">Clear Filters</a>
            </div>
          </div>
        ) : (
          <>
            <div className="cardsGrid eventsDense" style={{ marginTop: 16 }}>
              {filteredResults.map((item) => (
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
                  onClick={() => updatePageInUrl(Math.max(1, currentPage - 1))}
                  disabled={disableInputs || currentPage <= 1}
                >
                  Prev
                </button>

                <div className="meta">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </div>

                <button
                  type="button"
                  className="textResetBtn"
                  onClick={() => updatePageInUrl(Math.min(totalPages, currentPage + 1))}
                  disabled={disableInputs || currentPage >= totalPages}
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

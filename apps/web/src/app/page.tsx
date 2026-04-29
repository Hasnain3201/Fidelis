"use client";

import Image from "next/image";
import { type FormEvent, type MouseEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArtistCard, EventShowcaseCard, type EventCardItem, VenueCard, type VenueCardItem } from "@/components/showcase-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getTrendingContent,
  listVenues,
  searchEvents,
  searchEventsWithFilters,
  type EventSummary,
  type TrendingContentItem,
  type VenueSummary,
} from "@/lib/api";
import { isValidZipCode, normalizeZipInput, zipMatchesEvent } from "@/lib/zip";
import { FilterBar } from "@/components/filter-bar";
import {
  readRecentlyViewed,
  removeRecentlyViewed,
  type RecentlyViewedEntry,
  type RecentlyViewedKind,
} from "@/lib/recently-viewed";

import { getCoverImage } from "@/lib/cover-images";

const QUICK_FILTERS = ["This Weekend", "Free Events", "Live Music", "Comedy Shows", "DJ Sets"];
const DEFAULT_DISCOVERY_ZIP = "10001";
const CARDS_PER_PAGE = 5;
const MAX_ITEMS_PER_SHELF = 10;

type ShelfKey = "recent" | "trending" | "near" | "cities";

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

function matchesQuickFilter(price: string, tags: string[], subtitle: string, activeQuick: string): boolean {
  if (activeQuick === "This Weekend") return true;
  if (activeQuick === "Free Events") return price.toLowerCase().includes("free") || price.includes("$0");
  if (activeQuick === "Live Music") return tags.some((tag) => tag.toLowerCase().includes("live"));
  if (activeQuick === "Comedy Shows") return subtitle.toLowerCase().includes("comedy");
  if (activeQuick === "DJ Sets") return subtitle.toLowerCase().includes("dj");
  return true;
}

function mapEventToCard(item: EventSummary): EventCardItem {
  const categoryLabel = toTitleCase(item.category);
  return {
    id: item.id,
    title: item.title,
    subtitle: categoryLabel,
    description: `Hosted by ${item.venue_name}. Open event details to view full schedule and ticket info.`,
    dateLabel: formatDateLabel(item.start_time),
    timeLabel: formatTimeLabel(item.start_time),
    zipCode: item.zip_code ?? "",
    location: item.zip_code ?? "",
    venue: item.venue_name,
    price: "TBD",
    image: getCoverImage(item.cover_image_url, "event"),
    tags: [categoryLabel],
    badge: item.is_promoted ? "Promoted" : undefined,
  };
}

function mapVenueToCard(venue: VenueSummary): VenueCardItem {
  const cityState = [venue.city, venue.state].filter(Boolean).join(", ");
  const location = cityState || venue.zip_code;
  return {
    id: venue.id,
    name: venue.name,
    tagline: "Venue profile",
    description: venue.description?.trim() || "Venue profile details are available on event pages.",
    location,
    image: getCoverImage(venue.cover_image_url, "venue"),
    tags: [venue.zip_code],
    badge: "Venue",
  };
}

const withEventBadge = (items: EventCardItem[], badge: string) => items.map((item) => ({ ...item, badge }));
const withVenueBadge = (items: VenueCardItem[], badge: string) => items.map((item) => ({ ...item, badge }));

function pageItems<T>(items: T[], page: number): T[] {
  const start = page * CARDS_PER_PAGE;
  return items.slice(start, start + CARDS_PER_PAGE);
}

function maxPage(total: number): number {
  return Math.max(0, Math.ceil(total / CARDS_PER_PAGE) - 1);
}

export default function HomePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const [shelfPage, setShelfPage] = useState<Record<ShelfKey, number>>({
    recent: 0,
    trending: 0,
    near: 0,
    cities: 0,
  });

  const [searchText, setSearchText] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [activeQuick, setActiveQuick] = useState(QUICK_FILTERS[0]);

  const [eventItems, setEventItems] = useState<EventCardItem[]>([]);
  const [venueItems, setVenueItems] = useState<VenueCardItem[]>([]);
  const [promotedItems, setPromotedItems] = useState<EventCardItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<TrendingContentItem[]>([]);
  const [cardsMessage, setCardsMessage] = useState("");

  function prevPage(key: ShelfKey) {
    setShelfPage((p) => ({ ...p, [key]: Math.max(0, p[key] - 1) }));
  }

  function nextPage(key: ShelfKey, lastPage: number) {
    setShelfPage((p) => ({ ...p, [key]: Math.min(lastPage, p[key] + 1) }));
  }

  useEffect(() => {
    const load = () => setRecentlyViewed(readRecentlyViewed().slice(0, MAX_ITEMS_PER_SHELF));
    load();

    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadShelves() {
      const [eventsResult, venuesResult, promotedResult, trendingResult] = await Promise.allSettled([
        searchEvents(DEFAULT_DISCOVERY_ZIP),
        listVenues({ limit: 30 }),
        searchEventsWithFilters({ isPromoted: true, limit: 24 }),
        getTrendingContent(MAX_ITEMS_PER_SHELF),
      ]);

      if (cancelled) return;

      if (eventsResult.status === "fulfilled") {
        setEventItems(eventsResult.value.items.map(mapEventToCard));
      } else {
        setEventItems([]);
      }

      if (venuesResult.status === "fulfilled") {
        setVenueItems(venuesResult.value.map(mapVenueToCard));
      } else {
        setVenueItems([]);
      }

      if (promotedResult.status === "fulfilled") {
        setPromotedItems(promotedResult.value.items.map(mapEventToCard));
      } else {
        setPromotedItems([]);
      }

      if (trendingResult.status === "fulfilled") {
        setTrendingItems(trendingResult.value);
      } else {
        setTrendingItems([]);
      }

      if (
        eventsResult.status === "rejected" &&
        venuesResult.status === "rejected" &&
        promotedResult.status === "rejected" &&
        trendingResult.status === "rejected"
      ) {
        setCardsMessage("Live content shelves are unavailable right now.");
      } else {
        setCardsMessage("");
      }
    }

    void loadShelves();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEvents = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return eventItems.filter((event) => {
      const searchMatch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.venue.toLowerCase().includes(search);

      const quickMatch = matchesQuickFilter(event.price, event.tags, event.subtitle, activeQuick);
      const zipMatch = zipMatchesEvent(zipCode, event.zipCode);

      return searchMatch && quickMatch && zipMatch;
    });
  }, [activeQuick, eventItems, searchText, zipCode]);

  const promoted = useMemo(() => {
    const source = promotedItems.length > 0 ? promotedItems : eventItems.filter((item) => item.badge === "Promoted");
    return source.slice(0, Math.min(3, MAX_ITEMS_PER_SHELF));
  }, [promotedItems, eventItems]);
  
  const popularNearYou = useMemo(() => {
    const nearSorted = [...visibleEvents].sort((a, b) => {
      const aNear = zipCode.trim() && zipMatchesEvent(zipCode, a.zipCode) ? 1 : 0;
      const bNear = zipCode.trim() && zipMatchesEvent(zipCode, b.zipCode) ? 1 : 0;
      return bNear - aNear;
    });
    return withEventBadge(nearSorted.slice(0, MAX_ITEMS_PER_SHELF), "Popular");
  }, [visibleEvents, zipCode]);
  
  const popularCities = useMemo(() => {
    const citySorted = [...venueItems].sort((a, b) => a.location.localeCompare(b.location));
    return withVenueBadge(citySorted.slice(0, MAX_ITEMS_PER_SHELF), "City Pick");
  }, [venueItems]);

  const recentLastPage = maxPage(recentlyViewed.length);
  const trendingLastPage = maxPage(Math.min(trendingItems.length, MAX_ITEMS_PER_SHELF));
  const nearLastPage = maxPage(popularNearYou.length);
  const citiesLastPage = maxPage(popularCities.length);

  const recentPageItems = pageItems(recentlyViewed, shelfPage.recent);
  const trendingPageItems = pageItems(trendingItems.slice(0, MAX_ITEMS_PER_SHELF), shelfPage.trending);
  const nearPageItems = pageItems(popularNearYou, shelfPage.near);
  const citiesPageItems = pageItems(popularCities, shelfPage.cities);

  useEffect(() => {
    setShelfPage((p) => ({
      recent: Math.min(p.recent, recentLastPage),
      trending: Math.min(p.trending, trendingLastPage),
      near: Math.min(p.near, nearLastPage),
      cities: Math.min(p.cities, citiesLastPage),
    }));
  }, [recentLastPage, trendingLastPage, nearLastPage, citiesLastPage]);

  const featuredRailItems = useMemo(() => {
    const source = promoted.length > 0 ? [...promoted, ...popularNearYou, ...visibleEvents] : eventItems;
    const seen = new Set<string>();

    return source
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 6);
  }, [promoted, popularNearYou, visibleEvents, eventItems]);

  function validateZipInput(value: string): string {
    if (!value.trim()) return "ZIP code is required to search.";
    if (!isValidZipCode(value)) return "Use a valid US ZIP code (e.g., 78701 or 78701-1234).";
    return "";
  }

  function openSearchResults(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const zipValidationMessage = validateZipInput(zipCode);
    if (zipValidationMessage) {
      setZipError(zipValidationMessage);
      return;
    }

    const normalizedQuery = searchText.trim().replace(/\s+/g, " ").slice(0, 120);
    const params = new URLSearchParams();
    if (normalizedQuery) params.set("query", normalizedQuery);
    params.set("zip", zipCode);

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  function handleRemoveRecentlyViewed(
    event: MouseEvent<HTMLButtonElement>,
    kind: RecentlyViewedKind,
    id: string,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const next = removeRecentlyViewed(kind, id);
    setRecentlyViewed(next.slice(0, MAX_ITEMS_PER_SHELF));
  }

  return (
    <>
      <section className="heroBand">
        <div className="siteContainer heroContent">
          <div className="heroBadge">Discover local events in your area</div>

          <h1 className="heroTitle">
            Find Your Next
            <span> Unforgettable Experience</span>
          </h1>

          <p className="heroCopy">
            Connect with local venues, discover amazing artists, and never miss a show. Your community&apos;s
            entertainment scene, all in one place.
          </p>

          <form className="heroSearchForm" onSubmit={openSearchResults} noValidate>
            <div className="heroSearchRow">
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search events, artists, venues"
                maxLength={120}
                aria-label="Search term"
              />
              <Input
                value={zipCode}
                onChange={(event) => {
                  const nextZip = normalizeZipInput(event.target.value);
                  setZipCode(nextZip);
                  if (zipError) setZipError(validateZipInput(nextZip));
                }}
                onBlur={() => setZipError(validateZipInput(zipCode))}
                placeholder="ZIP code"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                aria-label="ZIP code"
                aria-invalid={Boolean(zipError)}
              />
              <Button type="submit" className="heroSearchBtn" disabled={isPending}>
                {isPending ? "Searching..." : "Search"}
              </Button>
            </div>
            {zipError ? (
              <p className="fieldError" role="alert">
                {zipError}
              </p>
            ) : null}
          </form>

          <FilterBar items={QUICK_FILTERS} activeItem={activeQuick} onSelect={setActiveQuick} />

          <div className="heroStats">
            <div className="heroStat">
              <strong>500+</strong>
              <span>Events Monthly</span>
            </div>
            <div className="heroStat">
              <strong>200+</strong>
              <span>Local Venues</span>
            </div>
            <div className="heroStat">
              <strong>1,000+</strong>
              <span>Artists</span>
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection fullWidthSection">
        <div className="fullWidthInner">
          {cardsMessage ? <p className="meta">{cardsMessage}</p> : null}

          <div className="homeDiscoveryLayout">
            <div className="homeDiscoveryMain">
              {recentlyViewed.length > 0 ? (
                <div className="shelfWrap">
                  <div className="shelfHeading">
                    <h2 className="shelfTitle">Recently Viewed</h2>
                    <div className="shelfPager">
                      <button
                        type="button"
                        className="shelfPagerBtn"
                        onClick={() => prevPage("recent")}
                        disabled={shelfPage.recent === 0}
                        aria-label="Previous recently viewed page"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="shelfPagerBtn"
                        onClick={() => nextPage("recent", recentLastPage)}
                        disabled={shelfPage.recent >= recentLastPage}
                        aria-label="Next recently viewed page"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div className="recentlyViewedList">
                    {recentPageItems.map((item) => (
                      <a key={`${item.kind}-${item.id}`} href={item.href} className="recentlyViewedChip">
                        <Image
                          src={item.image}
                          alt={item.label}
                          width={30}
                          height={30}
                          className="recentlyViewedAvatar"
                        />
                        <span className="recentlyViewedName">{item.label}</span>
                        <button
                          type="button"
                          className="recentlyViewedClose"
                          aria-label={`Remove ${item.label} from recently viewed`}
                          onClick={(event) => handleRemoveRecentlyViewed(event, item.kind, item.id)}
                        >
                          ×
                        </button>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="shelfWrap">
                <div className="shelfHeading">
                  <h2 className="shelfTitle">Promoted</h2>
                </div>
                <div className="cardsGrid three">
                  {promoted.map((item) => (
                    <EventShowcaseCard key={`promoted-${item.id}`} item={item} />
                  ))}
                </div>
              </div>

              <div className="shelfWrap">
                <div className="shelfHeading">
                  <h2 className="shelfTitle">Trending</h2>
                  <div className="shelfPager">
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => prevPage("trending")}
                      disabled={shelfPage.trending === 0}
                      aria-label="Previous trending page"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => nextPage("trending", trendingLastPage)}
                      disabled={shelfPage.trending >= trendingLastPage}
                      aria-label="Next trending page"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="cardsGrid five">
                  {trendingPageItems.map((item) =>
                    item.item_type === "event" ? (
                      <EventShowcaseCard
                        key={`trending-event-${item.item_id}`}
                        item={{
                          id: item.item_id,
                          title: item.label,
                          subtitle: item.category ?? "Event",
                          description: `${item.venue_name ?? "Venue TBD"} • ${item.popularity_count} favorites`,
                          dateLabel: item.start_time ? formatDateLabel(item.start_time) : "TBD",
                          timeLabel: item.start_time ? formatTimeLabel(item.start_time) : "TBD",
                          zipCode: item.zip_code ?? "00000",
                          location: item.zip_code ?? "N/A",
                          venue: item.venue_name ?? "Unknown Venue",
                          price: "TBD",
                          image: getCoverImage(undefined, "event"),
                          tags: [item.category ?? "Trending"],
                          badge: "Trending",
                        }}
                      />
                    ) : (
                      <ArtistCard
                        key={`trending-artist-${item.item_id}`}
                        item={{
                          id: item.item_id,
                          name: item.label,
                          location: item.category ?? "Artist",
                          description: `${item.popularity_count} follows`,
                          image: getCoverImage(undefined, "artist"),
                          tags: [item.category ?? "Trending"],
                          badge: "Trending",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>

              <div className="shelfWrap">
                <div className="shelfHeading">
                  <h2 className="shelfTitle">Popular Near You</h2>
                  <div className="shelfPager">
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => prevPage("near")}
                      disabled={shelfPage.near === 0}
                      aria-label="Previous popular near you page"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => nextPage("near", nearLastPage)}
                      disabled={shelfPage.near >= nearLastPage}
                      aria-label="Next popular near you page"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="cardsGrid five">
                  {nearPageItems.map((item) => (
                    <EventShowcaseCard key={`near-${item.id}`} item={item} />
                  ))}
                </div>
              </div>

              <div className="shelfWrap">
                <div className="shelfHeading">
                  <h2 className="shelfTitle">Popular Cities</h2>
                  <div className="shelfPager">
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => prevPage("cities")}
                      disabled={shelfPage.cities === 0}
                      aria-label="Previous popular cities page"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="shelfPagerBtn"
                      onClick={() => nextPage("cities", citiesLastPage)}
                      disabled={shelfPage.cities >= citiesLastPage}
                      aria-label="Next popular cities page"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="cardsGrid five">
                  {citiesPageItems.map((item) => (
                    <VenueCard key={`city-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            </div>

            <aside className="featuredRail" aria-label="Featured events">
              <p className="featuredRailKicker">Featured Events</p>
              <div className="featuredRailList">
                {featuredRailItems.map((item) => (
                  <a key={`rail-${item.id}`} href={`/events/${item.id}`} className="featuredRailItem">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={96}
                      height={64}
                      className="featuredRailThumb"
                    />
                    <div className="featuredRailMeta">
                      <p className="featuredRailTag">{item.badge ?? "Event"}</p>
                      <strong>{item.title}</strong>
                      <span>
                        {item.dateLabel} - {item.timeLabel}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}

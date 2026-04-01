"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArtistCard,
  type ArtistCardItem,
  EventShowcaseCard,
  type EventCardItem,
  VenueCard,
  type VenueCardItem,
} from "@/components/showcase-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listArtists,
  listVenues,
  searchEvents,
  searchEventsWithFilters,
  getTrendingContent,
  type ArtistSummary,
  type EventSummary,
  type VenueSummary,
  type TrendingContentItem,
} from "@/lib/api";
import { isValidZipCode, normalizeZipInput, zipMatchesEvent } from "@/lib/zip";
import { FilterBar } from "@/components/filter-bar";
import {
  readRecentlyViewed,
  removeRecentlyViewed,
  type RecentlyViewedEntry,
  type RecentlyViewedKind,
} from "@/lib/recently-viewed";

const QUICK_FILTERS = ["This Weekend", "Free Events", "Live Music", "Comedy Shows", "DJ Sets"];
const DEFAULT_DISCOVERY_ZIP = "10001";

const EVENT_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
];

const ARTIST_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80",
];

const VENUE_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80",
];

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

function pickImage(id: string, images: string[]): string {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % images.length;
  return images[hash];
}

function matchesQuickFilter(price: string, tags: string[], subtitle: string, activeQuick: string): boolean {
  if (activeQuick === "This Weekend") return true;
  if (activeQuick === "Free Events") return price.toLowerCase().includes("free") || price.includes("$0");
  if (activeQuick === "Live Music") return tags.some((tag) => tag.toLowerCase().includes("live"));
  if (activeQuick === "Comedy Shows") return subtitle.toLowerCase().includes("comedy");
  if (activeQuick === "DJ Sets") return subtitle.toLowerCase().includes("dj");
  return true;
}

function mapEventToCard(item: EventSummary, index: number): EventCardItem {
  const categoryLabel = toTitleCase(item.category);
  return {
    id: item.id,
    title: item.title,
    subtitle: categoryLabel,
    description: `Hosted by ${item.venue_name}. Open event details to view full schedule and ticket info.`,
    dateLabel: formatDateLabel(item.start_time),
    timeLabel: formatTimeLabel(item.start_time),
    zipCode: item.zip_code,
    location: item.zip_code,
    venue: item.venue_name,
    price: "TBD",
    image: EVENT_CARD_IMAGES[index % EVENT_CARD_IMAGES.length],
    tags: [categoryLabel],
    badge: item.is_promoted ? "Promoted" : undefined,
  };
}

function mapArtistToCard(artist: ArtistSummary): ArtistCardItem {
  const genreLabel = artist.genre?.trim() || "Genre TBD";
  return {
    id: artist.id,
    name: artist.stage_name,
    location: genreLabel,
    description: artist.bio?.trim() || "Artist profile details are available on linked event pages.",
    image: pickImage(artist.id, ARTIST_CARD_IMAGES),
    tags: [genreLabel],
    badge: "Trending",
  };
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
    image: pickImage(venue.id, VENUE_CARD_IMAGES),
    tags: [venue.zip_code],
    badge: venue.verified ? "Verified" : "Venue",
  };
}

const withEventBadge = (items: EventCardItem[], badge: string) => items.map((item) => ({ ...item, badge }));
const withArtistBadge = (items: ArtistCardItem[], badge: string) => items.map((item) => ({ ...item, badge }));
const withVenueBadge = (items: VenueCardItem[], badge: string) => items.map((item) => ({ ...item, badge }));

export default function HomePage() {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchText, setSearchText] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [activeQuick, setActiveQuick] = useState(QUICK_FILTERS[0]);

  const [eventItems, setEventItems] = useState<EventCardItem[]>([]);
  const [artistItems, setArtistItems] = useState<ArtistCardItem[]>([]);
  const [venueItems, setVenueItems] = useState<VenueCardItem[]>([]);
  const [cardsMessage, setCardsMessage] = useState("");
  
  const [promotedItems, setPromotedItems] = useState<EventCardItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<TrendingContentItem[]>([]);

  useEffect(() => {
    const load = () => setRecentlyViewed(readRecentlyViewed().slice(0, 10));
    load();

    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadShelves() {
      const [eventsResult, artistsResult, venuesResult, promotedResult, trendingResult] = await Promise.allSettled([
        searchEvents(DEFAULT_DISCOVERY_ZIP),
        listArtists({ limit: 30 }),
        listVenues({ limit: 30 }),
        searchEventsWithFilters({ isPromoted: true, limit: 24 }),
        getTrendingContent(10),
      ]);

      if (cancelled) return;

      if (eventsResult.status === "fulfilled") {
        setEventItems(eventsResult.value.items.map(mapEventToCard));
      } else {
        setEventItems([]);
      }

      if (artistsResult.status === "fulfilled") {
        setArtistItems(artistsResult.value.map(mapArtistToCard));
      } else {
        setArtistItems([]);
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

      if (trendingResult.status === "fulfilled") setTrendingItems(trendingResult.value);
      else setTrendingItems([]);

      if (
        eventsResult.status === "rejected" &&
        artistsResult.status === "rejected" &&
        venuesResult.status === "rejected"
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

  const promoted = useMemo(() => promotedItems.slice(0, 3), [promotedItems]);

  const trendingSearches = useMemo(
    () => withArtistBadge(artistItems.slice(0, 5), "Trending"),
    [artistItems],
  );

  const popularNearYou = useMemo(() => {
    const nearSorted = [...visibleEvents].sort((a, b) => {
      const aNear = zipCode.trim() && zipMatchesEvent(zipCode, a.zipCode) ? 1 : 0;
      const bNear = zipCode.trim() && zipMatchesEvent(zipCode, b.zipCode) ? 1 : 0;
      return bNear - aNear;
    });
    return withEventBadge(nearSorted.slice(0, 5), "Popular");
  }, [visibleEvents, zipCode]);

  const popularCities = useMemo(() => {
    const citySorted = [...venueItems].sort((a, b) => a.location.localeCompare(b.location));
    return withVenueBadge(citySorted.slice(0, 5), "City Pick");
  }, [venueItems]);

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
    event: React.MouseEvent<HTMLButtonElement>,
    kind: RecentlyViewedKind,
    id: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
  
    const next = removeRecentlyViewed(kind, id);
    setRecentlyViewed(next.slice(0, 10));
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
                  if (zipError) {
                    setZipError(validateZipInput(nextZip));
                  }
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
                  </div>
                  <div className="recentlyViewedList">
                    {recentlyViewed.map((item) => (
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
                </div>
                <div className="cardsGrid five">
                  {trendingItems.slice(0, 5).map((item, index) =>
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
                          image: EVENT_CARD_IMAGES[index % EVENT_CARD_IMAGES.length],
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
                          image: ARTIST_CARD_IMAGES[index % ARTIST_CARD_IMAGES.length],
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
                </div>
                <div className="cardsGrid five">
                  {popularNearYou.map((item) => (
                    <EventShowcaseCard key={`near-${item.id}`} item={item} />
                  ))}
                </div>
              </div>

              <div className="shelfWrap">
                <div className="shelfHeading">
                  <h2 className="shelfTitle">Popular Cities</h2>
                </div>
                <div className="cardsGrid five">
                  {popularCities.map((item) => (
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
"use client";

import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { FilterSidebar } from "@/components/filter-sidebar";
import { EventShowcaseCard, type EventCardItem } from "@/components/showcase-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchEvents, type EventSummary } from "@/lib/api";
import { isValidZipCode, normalizeZipInput, zipMatchesEvent } from "@/lib/zip";

const QUICK_FILTERS = ["This Weekend", "Free Events", "Live Music", "Comedy Shows", "DJ Sets"];
const DEFAULT_DISCOVERY_ZIP = "10001";
const EVENT_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
];

function matchesQuickFilter(price: string, tags: string[], subtitle: string, activeQuick: string): boolean {
  if (activeQuick === "This Weekend") return true;
  if (activeQuick === "Free Events") return price.toLowerCase().includes("free") || price.includes("$0");
  if (activeQuick === "Live Music") return tags.some((tag) => tag.toLowerCase().includes("live"));
  if (activeQuick === "Comedy Shows") return subtitle.toLowerCase().includes("comedy");
  if (activeQuick === "DJ Sets") return subtitle.toLowerCase().includes("dj");
  return true;
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
    zipCode: item.zip_code,
    location: `${item.zip_code}`,
    venue: item.venue_name,
    price: "TBD",
    image: EVENT_CARD_IMAGES[index % EVENT_CARD_IMAGES.length],
    tags: [categoryLabel],
  };
}

export default function HomePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [activeQuick, setActiveQuick] = useState(QUICK_FILTERS[0]);
  const [eventItems, setEventItems] = useState<EventCardItem[]>([]);
  const [cardsMessage, setCardsMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEventCardsFromApi() {
      try {
        const response = await searchEvents(DEFAULT_DISCOVERY_ZIP);
        if (cancelled) return;

        if (response.items.length > 0) {
          setEventItems(response.items.map(mapSummaryToCardItem));
          setCardsMessage("Live event cards loaded from backend.");
          return;
        }

        setEventItems([]);
        setCardsMessage("No events available yet in the database.");
      } catch (error) {
        if (cancelled) return;
        setEventItems([]);
        const message = error instanceof Error ? error.message : "Unable to load events.";
        setCardsMessage(`Live event cards unavailable (${message}).`);
      }
    }

    void loadEventCardsFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredEvents = eventItems.slice(0, 4);

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

      return searchMatch && zipMatch && quickMatch;
    });
  }, [activeQuick, eventItems, searchText, zipCode]);

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

      <section className="siteSection">
        <div className="siteContainer">
          <div className="sectionHeader">
            <div>
              <h2>Featured Events</h2>
              <p>Hand-picked experiences you&apos;ll love</p>
            </div>
            <a className="sectionLink" href="/search">
              View All
            </a>
          </div>
          {cardsMessage ? <p className="meta">{cardsMessage}</p> : null}

          <div className="cardsGrid four">
            {featuredEvents.map((item) => (
              <EventShowcaseCard key={item.id} item={item} />
            ))}
          </div>

          <div className="discoveryLayout">
            <FilterSidebar />

            <div>
              <div className="sectionHeader listHeader">
                <div>
                  <h2>All Events</h2>
                  <p>{visibleEvents.length} events found</p>
                </div>
              </div>

              <div className="cardsGrid eventsDense">
                {visibleEvents.map((item) => (
                  <EventShowcaseCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

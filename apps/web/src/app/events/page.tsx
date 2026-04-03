"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterSidebar } from "@/components/filter-sidebar";
import { EventShowcaseCard, type EventCardItem } from "@/components/showcase-cards";
import { searchEventsWithFilters, type EventSummary } from "@/lib/api";

const EVENT_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=900&q=80",
];

const RECOMMENDED_PAGE_SIZE = 5;
const RECOMMENDED_LOAD_LIMIT = 50;

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
    location: item.zip_code,
    venue: item.venue_name,
    price: "TBD",
    image: EVENT_CARD_IMAGES[index % EVENT_CARD_IMAGES.length],
    tags: [categoryLabel],
  };
}

export default function EventsSearchPage() {
  const [eventItems, setEventItems] = useState<EventCardItem[]>([]);
  const [cardsMessage, setCardsMessage] = useState("");
  const [recommendedPage, setRecommendedPage] = useState(0);

  const recommendedLastPage = Math.max(
    0,
    Math.ceil(eventItems.length / RECOMMENDED_PAGE_SIZE) - 1,
  );

  const recommendedPageItems = useMemo(() => {
    const start = recommendedPage * RECOMMENDED_PAGE_SIZE;
    return eventItems.slice(start, start + RECOMMENDED_PAGE_SIZE);
  }, [eventItems, recommendedPage]);

  useEffect(() => {
    setRecommendedPage((page) => Math.min(page, recommendedLastPage));
  }, [recommendedLastPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadEventCardsFromApi() {
      try {
        const response = await searchEventsWithFilters({
          sort: "recommended",
          limit: RECOMMENDED_LOAD_LIMIT,
        });

        if (cancelled) return;

        if (response.items.length > 0) {
          setEventItems(response.items.map(mapSummaryToCardItem));
          setCardsMessage("");
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

  return (
    <>
      <section className="siteSection fullWidthSection">
        <div className="fullWidthInner">
          <div className="shelfWrap">
            <div className="shelfHeading">
              <h2 className="shelfTitle">Recommended For You</h2>
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

            {cardsMessage ? <p className="meta">{cardsMessage}</p> : null}

            <div className="cardsGrid five">
              {recommendedPageItems.map((item) => (
                <EventShowcaseCard key={`recommended-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection">
        <div className="siteContainer">
          <div className="discoveryLayout">
            <FilterSidebar heading="Filter Events" />

            <div>
              <div className="sectionHeader listHeader">
                <div>
                  <h2>All Events</h2>
                  <p>{eventItems.length} events found</p>
                </div>
              </div>

              <div className="cardsGrid eventsDense">
                {eventItems.map((item) => (
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
"use client";

import { useEffect, useState } from "react";
import { VenueCard, type VenueCardItem } from "@/components/showcase-cards";
import { listVenues, type VenueSummary } from "@/lib/api";

const VENUE_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80",
];

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
    description: venue.description?.trim() || "Venue profile details are available on the event pages.",
    location,
    image: pickImage(venue.id),
    tags: [venue.zip_code],
    badge: venue.verified ? "Verified" : "Unverified",
  };
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<VenueCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVenues() {
      setIsLoading(true);
      setError(null);
      try {
        const items = await listVenues({ limit: 120 });
        if (cancelled) return;
        setVenues(items.map(mapVenueToCard));
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Failed to load venues.";
        setError(message);
        setVenues([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadVenues();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="sectionHeader listHeader">
          <div>
            <h1>Discover Venues</h1>
            <p>Real-time venue listings from the database.</p>
          </div>
        </div>

        {error ? <p className="statusBanner error">{error}</p> : null}

        {isLoading ? (
          <div className="cardsGrid three">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`venue-loading-${idx}`} className="stateSkeletonCard compact" />
            ))}
          </div>
        ) : venues.length === 0 ? (
          <div className="emptyStateCard">
            <h3>No venues found.</h3>
            <p className="meta">Try again after venue data is seeded in the database.</p>
          </div>
        ) : (
          <div className="cardsGrid three">
            {venues.map((item) => (
              <VenueCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

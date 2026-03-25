"use client";

import { useEffect, useState } from "react";
import { ArtistCard, type ArtistCardItem } from "@/components/showcase-cards";
import { listArtists, type ArtistSummary } from "@/lib/api";

const ARTIST_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
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

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadArtists() {
      setIsLoading(true);
      setError(null);

      try {
        const items = await listArtists({ limit: 120 });
        if (cancelled) return;
        setArtists(items.map(mapArtistToCard));
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Failed to load artists.";
        setError(message);
        setArtists([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadArtists();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="sectionHeader listHeader">
          <div>
            <h1>Discover Artists</h1>
            <p>Real-time artist listings from the database.</p>
          </div>
        </div>

        {error ? <p className="statusBanner error">{error}</p> : null}

        {isLoading ? (
          <div className="cardsGrid three">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`artist-loading-${idx}`} className="stateSkeletonCard compact" />
            ))}
          </div>
        ) : artists.length === 0 ? (
          <div className="emptyStateCard">
            <h3>No artists found.</h3>
            <p className="meta">Try again after artist data is seeded in the database.</p>
          </div>
        ) : (
          <div className="cardsGrid three">
            {artists.map((item) => (
              <ArtistCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

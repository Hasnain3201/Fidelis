import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ArtistFollowButton } from "@/components/artist-follow-button";
import { FavoriteEventButton } from "@/components/favorite-event-button";
import { getEventArtists, getEventDetail, type EventArtist, type EventDetailResponse } from "@/lib/api";
import { EVENT_ITEMS } from "@/lib/mock-content";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

const EVENT_DETAIL_IMAGES = [
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80",
];

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pickImage(eventId: string): string {
  let hash = 0;
  for (const char of eventId) hash = (hash + char.charCodeAt(0)) % EVENT_DETAIL_IMAGES.length;
  return EVENT_DETAIL_IMAGES[hash];
}

function toCategorySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toMockStartIso(dateLabel: string, timeLabel: string): string {
  const year = new Date().getFullYear();
  const baseDate = dateLabel.includes(",") ? dateLabel.split(",").slice(1).join(",").trim() : dateLabel;
  const parsed = new Date(`${baseDate}, ${year} ${timeLabel}`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function buildMockEventDetail(eventId: string): EventDetailResponse | null {
  const mock = EVENT_ITEMS.find((item) => item.id === eventId);
  if (!mock) return null;

  const start = toMockStartIso(mock.dateLabel, mock.timeLabel);
  const endDate = new Date(start);
  endDate.setHours(endDate.getHours() + 2);

  const categorySource = mock.tags[0] || mock.subtitle || "Live Event";

  return {
    id: mock.id,
    title: mock.title,
    description: mock.description,
    venue_name: mock.venue,
    category: toCategorySlug(categorySource) || "live-event",
    start_time: start,
    end_time: endDate.toISOString(),
    zip_code: mock.zipCode,
    ticket_url: null,
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  let event: EventDetailResponse | null = null;
  try {
    event = await getEventDetail(id);
  } catch (error) {
    const mockEvent = buildMockEventDetail(id);
    if (mockEvent) {
      event = mockEvent;
    } else if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      notFound();
    } else {
      throw error;
    }
  }

  if (!event) {
    notFound();
  }

  let artists: EventArtist[] = [];
  try {
    artists = await getEventArtists(id);
  } catch {
    artists = [];
  }

  const categoryLabel = toTitleCase(event.category);
  const heroImage = pickImage(event.id);

  return (
    <section className="siteSection">
      <div className="siteContainer eventDetailLayout">
        <div className="eventDetailMain">
          <div className="eventHeroMedia">
            <Image src={heroImage} alt={event.title} fill priority sizes="(max-width: 920px) 100vw, 68vw" />
          </div>

          <div className="eventDetailCard">
            <p className="eventDetailType">{categoryLabel}</p>
            <h1>{event.title}</h1>
            <p className="meta">{event.description || "No event description provided yet."}</p>

            <div className="eventMetaGrid">
              <div className="eventMetaItem">
                <strong>Date</strong>
                <span>{formatDate(event.start_time)}</span>
              </div>
              <div className="eventMetaItem">
                <strong>Time</strong>
                <span>
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </span>
              </div>
              <div className="eventMetaItem">
                <strong>Venue</strong>
                <span>{event.venue_name}</span>
              </div>
              <div className="eventMetaItem">
                <strong>ZIP Code</strong>
                <span>{event.zip_code}</span>
              </div>
              <div className="eventMetaItem">
                <strong>Category</strong>
                <span>{categoryLabel}</span>
              </div>
            </div>

            <div className="tagRow">
              <span className="tagPill">{categoryLabel}</span>
              <span className="tagPill">Live Event</span>
            </div>

            <div className="eventDetailActions">
              {event.ticket_url ? (
                <a href={event.ticket_url} target="_blank" rel="noreferrer" className="pageActionLink">
                  Get Tickets
                </a>
              ) : (
                <Button type="button" disabled>
                  Tickets Unavailable
                </Button>
              )}

              {/* New: share / copy link */}
              <CopyLinkButton />

              <FavoriteEventButton eventId={event.id} />

              <Link href="/search" className="pageActionLink secondary">
                Back to Search
              </Link>
            </div>
          </div>
        </div>

        <aside className="eventDetailSidebar">
          <div className="eventSidebarCard">
            <h2>About This Event</h2>
            <p className="meta">Loaded from live backend data through FastAPI `/api/v1/events/{id}`.</p>
          </div>

          <div className="eventSidebarCard">
            <h2>Venue Snapshot</h2>
            <p className="meta">{event.venue_name}</p>
            <p className="meta">
              Event details, timing, category, and ticket link are now sourced from API payloads instead of Week 2 mock
              cards.
            </p>
          </div>

          <div className="eventSidebarCard">
            <h2>Artists</h2>
            {artists.length ? (
              <div className="listStack">
                {artists.map((artist) => (
                  <div key={artist.id} className="listItemRow">
                    <div>
                      <strong>{artist.stage_name || "Artist"}</strong>
                      <p className="meta">{artist.genre || "Genre TBD"}</p>
                    </div>
                    <ArtistFollowButton artistId={artist.id} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta">Artist lineup will appear here when linked.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

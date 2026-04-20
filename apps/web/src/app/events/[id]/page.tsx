export const runtime = "edge";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ShareButtons } from "@/components/share-buttons";
import { AddToCalendar } from "@/components/add-to-calendar";
import { ArtistFollowButton } from "@/components/artist-follow-button";
import { FavoriteEventButton } from "@/components/favorite-event-button";
import { InterestedButton } from "@/components/interested-button";
import { getEventArtists, getEventDetail, type EventArtist, type EventDetailResponse } from "@/lib/api";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { EventReviews } from "@/components/event-reviews";
import { EventReminder } from "@/components/event-reminder";

import { getCoverImage } from "@/lib/cover-images";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  let event: EventDetailResponse | null = null;
  try {
    event = await getEventDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
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
  const heroImage = getCoverImage(event.cover_image_url, "event");

  return (
    <>
      <RecentlyViewedTracker
        id={event.id}
        kind="event"
        label={event.title}
        image={heroImage}
        href={`/events/${event.id}`}
      />

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
                {event.age_requirement && (
                  <span className="tagPill" style={{ background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80" }}>
                    {event.age_requirement}
                  </span>
                )}
                {event.price != null && (
                  <span className="tagPill" style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7" }}>
                    {event.price === 0 ? "Free" : `$${event.price}`}
                  </span>
                )}
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

                <CopyLinkButton />
                <ShareButtons title={event.title} />
                <AddToCalendar
                  title={event.title}
                  startTime={event.start_time}
                  endTime={event.end_time}
                  location={event.venue_name}
                  description={event.description ?? undefined}
                />

                <FavoriteEventButton eventId={event.id} />
                <InterestedButton eventId={event.id} />

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
              <p className="meta" style={{ fontWeight: 600, marginBottom: 10 }}>{event.venue_name}</p>
              <div style={{ display: "grid", gap: 8 }}>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(event.venue_name + " website")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#6942d6",
                    textDecoration: "none",
                    padding: "8px 12px",
                    borderRadius: 9,
                    background: "#f3eeff",
                    border: "1px solid #dacfff",
                  }}
                >
                  🌐 Venue Website
                </a>
                <a
                  href={`https://www.opentable.com/s?query=${encodeURIComponent(event.venue_name)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#c0365a",
                    textDecoration: "none",
                    padding: "8px 12px",
                    borderRadius: 9,
                    background: "#fff0f4",
                    border: "1px solid #f5c0cc",
                  }}
                >
                  🍽 Reserve a Table
                </a>
              </div>
            </div>

            <div className="eventSidebarCard">
              <h2>🔔 Get Reminded</h2>
              <p className="meta" style={{ marginBottom: 12, fontSize: 13 }}>Don&apos;t miss this event — set a reminder.</p>
              <EventReminder eventId={event.id} eventTitle={event.title} />
            </div>

            <div className="eventSidebarCard">
              <h2>Reviews</h2>
              <EventReviews eventId={event.id} />
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
    </>
  );
}
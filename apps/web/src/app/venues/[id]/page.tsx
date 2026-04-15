import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ShareButtons } from "@/components/share-buttons";
import { VenueFollowButton } from "@/components/venue-follow-button";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { getVenueDetail, getVenueEvents, type EventSummary, type VenueProfileResponse } from "@/lib/api";

import { getCoverImage } from "@/lib/cover-images";

type VenueDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
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

function buildLocationLabel(venue: VenueProfileResponse): string {
  return [venue.address_line, [venue.city, venue.state].filter(Boolean).join(", "), venue.zip_code]
    .filter(Boolean)
    .join(" • ");
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
  const { id } = await params;

  let venue: VenueProfileResponse | null = null;
  try {
    venue = await getVenueDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      notFound();
    } else {
      throw error;
    }
  }

  if (!venue) notFound();

  let events: EventSummary[] = [];
  try {
    events = await getVenueEvents(id, 24);
  } catch {
    events = [];
  }

  const heroImage = getCoverImage(venue.cover_image_url, "venue");
  const locationLabel = buildLocationLabel(venue);
  const mapsQuery = [venue.name, venue.address_line, venue.city, venue.state, venue.zip_code]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <RecentlyViewedTracker
        id={venue.id}
        kind="venue"
        label={venue.name}
        image={heroImage}
        href={`/venues/${venue.id}`}
      />

      <section className="siteSection">
        <div className="siteContainer eventDetailLayout">
          <div className="eventDetailMain">
            <div className="eventHeroMedia">
              <Image src={heroImage} alt={venue.name} fill priority sizes="(max-width: 920px) 100vw, 68vw" />
            </div>

            <div className="eventDetailCard">
              <p className="eventDetailType">{venue.verified ? "Verified Venue" : "Venue"}</p>
              <h1>{venue.name}</h1>
              <p className="meta">{venue.description?.trim() || "No venue description has been added yet."}</p>

              <div className="eventMetaGrid">
                <div className="eventMetaItem">
                  <strong>Location</strong>
                  <span>{locationLabel || "Location TBD"}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>ZIP Code</strong>
                  <span>{venue.zip_code}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>Status</strong>
                  <span>{venue.verified ? "Verified" : "Community Venue"}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>Upcoming Events</strong>
                  <span>{events.length}</span>
                </div>
              </div>

              <div className="tagRow">
                <span className="tagPill">{venue.verified ? "Verified" : "Venue"}</span>
                <span className="tagPill">{venue.zip_code}</span>
              </div>

              <div className="eventDetailActions">
                {mapsQuery ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pageActionLink"
                  >
                    Open in Maps
                  </a>
                ) : null}

                <VenueFollowButton venueId={venue.id} />
                <CopyLinkButton />
                <ShareButtons title={venue.name} />

                <Link href="/venues" className="pageActionLink secondary">
                  Back to Venues
                </Link>
              </div>
            </div>
          </div>

          <aside className="eventDetailSidebar">
            <div className="eventSidebarCard">
              <h2>About This Venue</h2>
              <p className="meta">Loaded from live backend data through FastAPI `/api/v1/venues/{id}`.</p>
            </div>

            <div className="eventSidebarCard">
              <h2>Upcoming Events</h2>
              {events.length ? (
                <div className="listStack">
                  {events.map((event) => (
                    <div key={event.id} className="listItemRow">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{event.title}</strong>
                        <p className="meta" style={{ margin: "4px 0 0" }}>
                          {formatDate(event.start_time)} • {formatTime(event.start_time)}
                        </p>
                      </div>
                      <Link href={`/events/${event.id}`} className="pageActionLink secondary">
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="meta">No upcoming events are currently linked to this venue.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
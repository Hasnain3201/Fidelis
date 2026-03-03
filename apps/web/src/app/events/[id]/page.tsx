import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { getEventDetail } from "@/lib/api";

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

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  let event;
  try {
    event = await getEventDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      notFound();
    }
    throw error;
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

              {/* Existing (left as-is) */}
              <Button type="button" variant="secondary">
                Save Event
              </Button>

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
        </aside>
      </div>
    </section>
  );
}
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EVENT_ITEMS } from "@/lib/mock-content";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const event = EVENT_ITEMS.find((item) => item.id === id);

  if (!event) {
    notFound();
  }

  return (
    <section className="siteSection">
      <div className="siteContainer eventDetailLayout">
        <div className="eventDetailMain">
          <div className="eventHeroMedia">
            <Image src={event.image} alt={event.title} fill priority sizes="(max-width: 920px) 100vw, 68vw" />
            {event.badge ? <span className="pillTop">{event.badge}</span> : null}
          </div>

          <div className="eventDetailCard">
            <p className="eventDetailType">{event.subtitle}</p>
            <h1>{event.title}</h1>
            <p className="meta">{event.description}</p>

            <div className="eventMetaGrid">
              <div className="eventMetaItem">
                <strong>Date</strong>
                <span>{event.dateLabel}</span>
              </div>
              <div className="eventMetaItem">
                <strong>Time</strong>
                <span>{event.timeLabel}</span>
              </div>
              <div className="eventMetaItem">
                <strong>Venue</strong>
                <span>{event.venue}</span>
              </div>
              <div className="eventMetaItem">
                <strong>Location</strong>
                <span>
                  {event.location} {event.zipCode}
                </span>
              </div>
              <div className="eventMetaItem">
                <strong>Entry</strong>
                <span>{event.price}</span>
              </div>
            </div>

            <div className="tagRow">
              {event.tags.map((tag) => (
                <span key={tag} className="tagPill">
                  {tag}
                </span>
              ))}
            </div>

            <div className="eventDetailActions">
              <Button type="button">Get Tickets</Button>
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
            <p className="meta">
              This Week 2 layout uses mock data only. Week 3 will connect ticketing, artist lineup, and venue profile
              details to backend APIs.
            </p>
          </div>

          <div className="eventSidebarCard">
            <h2>Venue Snapshot</h2>
            <p className="meta">{event.venue}</p>
            <p className="meta">
              Located in {event.location}, this venue is currently displayed in a UI-only mode with placeholder
              verification and scheduling data.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

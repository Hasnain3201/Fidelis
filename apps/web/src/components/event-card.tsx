import Link from "next/link";
import type { EventSummary } from "@/lib/api";

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <Link href={`/events/${event.id}`} className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong>{event.title}</strong>
        <span className="pill">{event.category}</span>
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        {event.venue_name}
      </p>
      <p className="meta" style={{ marginTop: 6 }}>
        {new Date(event.start_time).toLocaleString()} - ZIP {event.zip_code}
      </p>
    </Link>
  );
}

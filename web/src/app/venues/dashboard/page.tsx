import Link from "next/link";
import { EVENT_ITEMS } from "@/lib/mock-content";

const VENUE_EVENTS = EVENT_ITEMS.slice(0, 4);

export default function VenueDashboardPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Venue Dashboard</p>
            <h1>The Blue Note Lounge</h1>
            <p className="meta">Manage event publishing, monitor bookings, and track audience growth.</p>
            <div className="pageActions">
              <Link href="/venues/create-event" className="pageActionLink">
                Create Event
              </Link>
              <Link href="/dashboard" className="pageActionLink secondary">
                Switch to User Dashboard
              </Link>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Upcoming Events</strong>
              <p>{VENUE_EVENTS.length}</p>
            </div>
            <div className="miniCard">
              <strong>Booked Tickets</strong>
              <p>142</p>
            </div>
            <div className="miniCard">
              <strong>Followers</strong>
              <p>928</p>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Upcoming Schedule</h2>
              <div className="listStack">
                {VENUE_EVENTS.map((event) => (
                  <div key={event.id} className="listItemRow">
                    <div>
                      <strong>{event.title}</strong>
                      <p className="meta">
                        {event.dateLabel} • {event.timeLabel} • {event.price}
                      </p>
                    </div>
                    <Link href={`/events/${event.id}`} className="pageActionLink secondary">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Draft Events</h2>
              <div className="emptyStateCard compact">
                <h3>No drafts in progress.</h3>
                <p className="meta">Create a draft to stage event details before publishing.</p>
                <Link href="/venues/create-event" className="pageActionLink">
                  Start Draft
                </Link>
              </div>
            </div>

            <div className="card">
              <h2>Publishing Checklist</h2>
              <ul className="simpleList">
                <li>Venue profile completed</li>
                <li>Ticket URL and capacity set</li>
                <li>Age restrictions reviewed</li>
                <li>Promotion copy approved</li>
              </ul>
            </div>

            <div className="card phaseNote">
              <strong>Security and Access Note</strong>
              <p className="meta">
                Week 2 dashboard is UI-only. Week 3 will enforce verified venue access and backend-backed event
                permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

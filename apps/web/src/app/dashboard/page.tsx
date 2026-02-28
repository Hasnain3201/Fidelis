import Link from "next/link";
import { ARTIST_ITEMS, EVENT_ITEMS } from "@/lib/mock-content";

const SAVED_EVENTS = EVENT_ITEMS.slice(0, 3);
const FOLLOWED_ARTISTS = ARTIST_ITEMS.slice(0, 4);

export default function UserDashboardPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">User Dashboard</p>
            <h1>Welcome back, Maya</h1>
            <p className="meta">Track saved events, followed artists, and your upcoming week in one place.</p>
            <div className="pageActions">
              <Link href="/search" className="pageActionLink">
                Find More Events
              </Link>
              <Link href="/register" className="pageActionLink secondary">
                Manage Account
              </Link>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Saved Events</strong>
              <p>{SAVED_EVENTS.length}</p>
            </div>
            <div className="miniCard">
              <strong>Followed Artists</strong>
              <p>{FOLLOWED_ARTISTS.length}</p>
            </div>
            <div className="miniCard">
              <strong>Unread Alerts</strong>
              <p>0</p>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Saved Events</h2>
              <div className="listStack">
                {SAVED_EVENTS.map((event) => (
                  <div key={event.id} className="listItemRow">
                    <div>
                      <strong>{event.title}</strong>
                      <p className="meta">
                        {event.dateLabel} • {event.timeLabel}
                      </p>
                    </div>
                    <Link className="pageActionLink secondary" href={`/events/${event.id}`}>
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Followed Artists</h2>
              <div className="listStack">
                {FOLLOWED_ARTISTS.map((artist) => (
                  <div key={artist.id} className="listItemRow">
                    <div>
                      <strong>{artist.name}</strong>
                      <p className="meta">{artist.location}</p>
                    </div>
                    <button type="button" className="pageActionLink secondary">
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Notifications</h2>
              <div className="emptyStateCard compact">
                <h3>No notifications yet.</h3>
                <p className="meta">You will see reminders for upcoming events and artist updates here.</p>
              </div>
            </div>

            <div className="card">
              <h2>Recommended Next Step</h2>
              <p className="meta">Complete your profile preferences to improve event recommendations.</p>
              <div className="pageActions">
                <button type="button" className="pageActionLink">
                  Update Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

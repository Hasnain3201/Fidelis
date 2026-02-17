import Link from "next/link";

export default function VenueDashboardPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card">
          <h1>Venue Dashboard</h1>
          <p className="meta">Foundation for verified venue workflows: create/edit/delete events and analytics.</p>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Upcoming Events</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Bookings</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Followers</strong>
              <p>0</p>
            </div>
          </div>

          <div className="pageActions">
            <Link href="/venues/create-event" className="pageActionLink">
              Create Event Placeholder
            </Link>
            <Link href="/dashboard" className="pageActionLink secondary">
              User Dashboard Placeholder
            </Link>
          </div>

          <div className="phaseNote">
            <strong>Phase Beta target</strong>
            <p className="meta">Hook this page to protected API routes and role checks.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

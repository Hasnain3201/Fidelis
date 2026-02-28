export default function ArtistDashboardPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card">
          <h1>Artist Dashboard</h1>
          <p className="meta">Foundation for artist profile management, media, and event linking.</p>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Upcoming Gigs</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Followers</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Messages</strong>
              <p>0</p>
            </div>
          </div>

          <div className="phaseNote">
            <strong>Phase Final target</strong>
            <p className="meta">Add profile editing, linked events, and follower notification settings.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

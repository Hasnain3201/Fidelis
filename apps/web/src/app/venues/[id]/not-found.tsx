import Link from "next/link";

export default function VenueNotFound() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="emptyStateCard">
          <h1>Venue not found</h1>
          <p className="meta">The venue may have been removed or the link is invalid.</p>
          <Link href="/venues" className="pageActionLink">
            Go to Venues
          </Link>
        </div>
      </div>
    </section>
  );
}
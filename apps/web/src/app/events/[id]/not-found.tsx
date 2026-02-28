import Link from "next/link";

export default function EventNotFound() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="emptyStateCard">
          <h1>Event not found</h1>
          <p className="meta">The event may have been removed or the link is invalid.</p>
          <Link href="/search" className="pageActionLink">
            Go to Search
          </Link>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function ArtistNotFound() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="emptyStateCard">
          <h1>Artist not found</h1>
          <p className="meta">The artist may have been removed or the link is invalid.</p>
          <Link href="/artists" className="pageActionLink">
            Go to Artists
          </Link>
        </div>
      </div>
    </section>
  );
}
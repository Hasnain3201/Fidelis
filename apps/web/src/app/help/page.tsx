import Link from "next/link";

export default function HelpPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card emptyStateCard">
          <h1>Help Center</h1>
          <p className="meta">Need support? Email us at support@livey.app and we will get back to you.</p>
          <div className="pageActions">
            <a href="mailto:support@livey.app" className="pageActionLink">
              Contact Support
            </a>
            <Link href="/search" className="pageActionLink secondary">
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

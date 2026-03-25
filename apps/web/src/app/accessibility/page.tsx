import Link from "next/link";

export default function AccessibilityPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card emptyStateCard">
          <h1>Accessibility</h1>
          <p className="meta">We are improving keyboard navigation, readable contrast, and semantic labels across LIVEY.</p>
          <div className="pageActions">
            <Link href="/help" className="pageActionLink">
              Report an Issue
            </Link>
            <Link href="/" className="pageActionLink secondary">
              Back Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

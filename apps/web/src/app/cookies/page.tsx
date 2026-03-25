import Link from "next/link";

export default function CookiesPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card emptyStateCard">
          <h1>Cookie Policy</h1>
          <p className="meta">LIVEY uses essential cookies for authentication state and core site functionality.</p>
          <div className="pageActions">
            <Link href="/privacy" className="pageActionLink">
              Privacy Policy
            </Link>
            <Link href="/accessibility" className="pageActionLink secondary">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

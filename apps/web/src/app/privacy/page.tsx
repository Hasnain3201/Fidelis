import Link from "next/link";

export default function PrivacyPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card emptyStateCard">
          <h1>Privacy Policy</h1>
          <p className="meta">LIVEY only uses account and event data needed to operate discovery and platform features.</p>
          <div className="pageActions">
            <Link href="/terms" className="pageActionLink">
              Terms of Service
            </Link>
            <Link href="/help" className="pageActionLink secondary">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

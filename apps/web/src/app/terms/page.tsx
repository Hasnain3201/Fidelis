import Link from "next/link";

export default function TermsPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card emptyStateCard">
          <h1>Terms of Service</h1>
          <p className="meta">By using LIVEY, you agree to platform usage rules, account policies, and venue/artist content guidelines.</p>
          <div className="pageActions">
            <Link href="/privacy" className="pageActionLink">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="pageActionLink secondary">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

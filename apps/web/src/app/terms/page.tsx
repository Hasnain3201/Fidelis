import Link from "next/link";

const SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: "By accessing or using LIVEY, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.",
  },
  {
    title: "User Accounts",
    body: "You are responsible for maintaining the security of your account credentials. You must provide accurate information when registering. You may not share your account or impersonate others.",
  },
  {
    title: "Venue Accounts",
    body: "Venues may publish events after account verification. Published events must be accurate and current. LIVEY reserves the right to remove events that violate platform guidelines or contain false information.",
  },
  {
    title: "Artist Accounts",
    body: "Artists may create profiles and be associated with events published by venues. You are responsible for the accuracy of your profile content, including bios, genres, and contact details.",
  },
  {
    title: "Prohibited Conduct",
    body: "You may not use LIVEY to spam, harass, or deceive other users. You may not attempt to scrape, reverse-engineer, or disrupt the platform. Accounts found in violation may be suspended or removed.",
  },
  {
    title: "Intellectual Property",
    body: "Content you submit to LIVEY (event descriptions, artist bios, etc.) remains yours. By submitting, you grant LIVEY a license to display it on the platform. LIVEY's name, logo, and design are our intellectual property.",
  },
  {
    title: "Disclaimers",
    body: "LIVEY provides event discovery as a service. We are not responsible for the accuracy of event details submitted by venues, nor for the outcome of attending events. Always verify event details with the venue directly.",
  },
  {
    title: "Changes to Terms",
    body: "We may update these terms from time to time. Continued use of LIVEY after changes are posted constitutes acceptance of the new terms.",
  },
];

export default function TermsPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <p className="dashboardPill">Legal</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 36 }}>Terms of Service</h1>
            <p className="meta" style={{ fontSize: 15 }}>
              Last updated: March 2026. Please read these terms carefully before using LIVEY.
            </p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {SECTIONS.map((section) => (
              <div
                key={section.title}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "16px 18px",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1c2334" }}>{section.title}</h3>
                <p style={{ margin: 0, color: "#6b7590", fontSize: 14, lineHeight: 1.55 }}>{section.body}</p>
              </div>
            ))}
          </div>

          <div className="pageActions" style={{ marginTop: 24 }}>
            <Link href="/privacy" className="pageActionLink">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="pageActionLink secondary">
              Cookie Policy
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

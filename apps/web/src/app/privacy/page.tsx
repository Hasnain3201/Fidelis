import Link from "next/link";

const SECTIONS = [
  {
    title: "Information We Collect",
    body: "We collect information you provide when creating an account, such as your name, email address, and role (user, venue, or artist). We also collect data about the events you save, artists you follow, and venues you interact with.",
  },
  {
    title: "How We Use Your Information",
    body: "Your information is used to operate and improve LIVEY — including personalizing event recommendations, managing your saved events and follows, and communicating platform updates. We do not sell your personal data to third parties.",
  },
  {
    title: "Data Storage",
    body: "LIVEY stores your data securely using Supabase, a managed cloud database platform. Authentication data is handled using industry-standard JWT tokens. We retain your data as long as your account is active.",
  },
  {
    title: "Cookies",
    body: "We use essential cookies and browser local storage to keep you logged in and maintain your session. We do not use advertising or tracking cookies. See our Cookie Policy for more details.",
  },
  {
    title: "Your Rights",
    body: "You may request to view, update, or delete your account data at any time by contacting support@livey.app. You can also manage saved events and follows directly from your dashboard.",
  },
  {
    title: "Contact",
    body: "If you have questions about this Privacy Policy or your data, email us at support@livey.app.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <p className="dashboardPill">Legal</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 36 }}>Privacy Policy</h1>
            <p className="meta" style={{ fontSize: 15 }}>
              Last updated: March 2026. This policy explains how LIVEY handles your personal information.
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
            <Link href="/terms" className="pageActionLink">
              Terms of Service
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

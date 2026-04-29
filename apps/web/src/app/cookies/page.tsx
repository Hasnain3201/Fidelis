import Link from "next/link";

const COOKIE_TYPES = [
  {
    name: "Essential Cookies",
    purpose: "Required for the site to function. These handle authentication sessions so you stay logged in.",
    canDisable: false,
  },
  {
    name: "Local Storage (Auth Session)",
    purpose: "We store your login session in your browser's local storage to keep you authenticated between page visits.",
    canDisable: false,
  },
  {
    name: "Analytics Cookies",
    purpose: "We do not currently use analytics or tracking cookies. No third-party advertising cookies are used on LIVEY.",
    canDisable: true,
  },
];

export default function CookiesPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <p className="dashboardPill">Legal</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 36 }}>Cookie Policy</h1>
            <p className="meta" style={{ fontSize: 15 }}>
              Last updated: March 2026. This page explains how LIVEY uses cookies and browser storage.
            </p>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e3e7f1",
              background: "#ffffff",
              padding: "16px 18px",
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1c2334" }}>What are cookies?</h3>
            <p style={{ margin: 0, color: "#6b7590", fontSize: 14, lineHeight: 1.55 }}>
              Cookies are small pieces of data stored by your browser. LIVEY uses minimal cookies — only what is necessary to keep the platform running and you logged in.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {COOKIE_TYPES.map((cookie) => (
              <div
                key={cookie.name}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "16px 18px",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: "#1c2334" }}>{cookie.name}</h3>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "2px 8px",
                        background: cookie.canDisable ? "#eefbf4" : "#fff1f4",
                        color: cookie.canDisable ? "#176344" : "#902945",
                        border: `1px solid ${cookie.canDisable ? "#d5e9de" : "#efd2d9"}`,
                      }}
                    >
                      {cookie.canDisable ? "Optional" : "Required"}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: "#6b7590", fontSize: 14, lineHeight: 1.5 }}>{cookie.purpose}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pageActions" style={{ marginTop: 24 }}>
            <Link href="/privacy" className="pageActionLink">
              Privacy Policy
            </Link>
            <Link href="/terms" className="pageActionLink secondary">
              Terms of Service
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

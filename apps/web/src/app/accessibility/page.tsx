import Link from "next/link";

const FEATURES = [
  {
    icon: "⌨️",
    title: "Keyboard Navigation",
    body: "All interactive elements on LIVEY — buttons, links, forms, and modals — are fully reachable and operable using keyboard navigation alone.",
  },
  {
    icon: "🎨",
    title: "Color Contrast",
    body: "We follow WCAG 2.1 AA guidelines for color contrast across text, buttons, and UI components to ensure readability for users with visual impairments.",
  },
  {
    icon: "🏷️",
    title: "Semantic Labels",
    body: "All images include descriptive alt text. Form inputs have associated labels. Buttons include aria-label attributes where icon-only buttons are used.",
  },
  {
    icon: "📱",
    title: "Responsive Design",
    body: "LIVEY is designed to work across all screen sizes. The layout adapts for desktop, tablet, and mobile viewports without loss of functionality.",
  },
  {
    icon: "🔎",
    title: "Focus Indicators",
    body: "Visible focus rings are maintained throughout the site so keyboard users can always identify which element is currently focused.",
  },
  {
    icon: "🚧",
    title: "Ongoing Improvements",
    body: "Accessibility is an ongoing effort. We are actively working on screen reader compatibility, skip navigation links, and additional ARIA improvements.",
  },
];

export default function AccessibilityPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <p className="dashboardPill">Accessibility</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 36 }}>Accessibility Statement</h1>
            <p className="meta" style={{ fontSize: 15 }}>
              LIVEY is committed to making our platform accessible and usable for everyone.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
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
                <span style={{ fontSize: 24, flexShrink: 0 }}>{feature.icon}</span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "#1c2334" }}>{feature.title}</h3>
                  <p style={{ margin: 0, color: "#6b7590", fontSize: 13, lineHeight: 1.5 }}>{feature.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 24,
              borderRadius: 12,
              border: "1px solid #dccfff",
              background: "#f5f0ff",
              padding: "18px 22px",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#3d2070" }}>Found an accessibility issue?</h3>
            <p style={{ margin: "0 0 14px", color: "#6b5a9a", fontSize: 14 }}>
              If you encounter any barriers while using LIVEY, please let us know. We take all reports seriously and aim to respond promptly.
            </p>
            <div className="pageActions" style={{ margin: 0 }}>
              <a href="mailto:support@livey.app" className="pageActionLink">Report an Issue</a>
              <Link href="/help" className="pageActionLink secondary">Help Center</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

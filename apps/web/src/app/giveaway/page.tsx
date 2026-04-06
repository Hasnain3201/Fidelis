import Link from "next/link";

const PRIZE_TIERS = [
  {
    tier: "Grand Prize",
    reward: "2 VIP event tickets + backstage experience",
    winners: "1 winner",
  },
  {
    tier: "Second Prize",
    reward: "$100 LIVEY event credit",
    winners: "5 winners",
  },
  {
    tier: "Third Prize",
    reward: "LIVEY merch bundle",
    winners: "20 winners",
  },
];

const ENTRY_STEPS = [
  "Create a LIVEY account (or sign in).",
  "Save at least one event to favorites.",
  "Follow at least one artist or venue.",
  "You are entered automatically.",
];

export default function GiveawayPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 12 }}>
          <div
            className="card"
            style={{
              background:
                "linear-gradient(145deg, rgba(94, 52, 214, 0.98), rgba(59, 44, 177, 0.96))",
              color: "#f7f3ff",
              borderColor: "rgba(120, 91, 225, 0.42)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.9,
              }}
            >
              Limited-Time Contest
            </p>
            <h1 style={{ margin: "10px 0 8px", fontSize: 42, lineHeight: 1.05 }}>
              LIVEY Spring Giveaway
            </h1>
            <p style={{ margin: 0, maxWidth: 680, fontSize: 16, lineHeight: 1.45, opacity: 0.95 }}>
              Win VIP experiences, event credit, and merch. Browse events and engage on LIVEY for your chance to win.
            </p>

            <div className="pageActions" style={{ margin: "18px 0 0" }}>
              <Link href="/register" className="pageActionLink">
                Create Account & Enter
              </Link>
              <Link href="/login" className="pageActionLink secondary">
                Sign In
              </Link>
              <Link href="/search" className="pageActionLink secondary">
                Browse Events
              </Link>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Prize Breakdown</h2>
              <div style={{ display: "grid", gap: 9 }}>
                {PRIZE_TIERS.map((item) => (
                  <div
                    key={item.tier}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #e2e6f2",
                      background: "#f9fbff",
                      padding: "12px 14px",
                    }}
                  >
                    <strong style={{ display: "block", fontSize: 15, color: "#222b42" }}>{item.tier}</strong>
                    <p style={{ margin: "5px 0 0", color: "#667089", fontSize: 14 }}>{item.reward}</p>
                    <p style={{ margin: "6px 0 0", color: "#4d5670", fontSize: 12, fontWeight: 700 }}>{item.winners}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>How to Enter</h2>
              <ol className="simpleList" style={{ marginTop: 2, paddingLeft: 20 }}>
                {ENTRY_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <div
                style={{
                  marginTop: 14,
                  borderRadius: 10,
                  border: "1px solid #dcdff0",
                  background: "#f6f8ff",
                  padding: "12px 13px",
                  display: "grid",
                  gap: 5,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#55607a", fontWeight: 700 }}>
                  Contest Window
                </p>
                <p style={{ margin: 0, color: "#2b3348", fontWeight: 700 }}>
                  April 8, 2026 - May 6, 2026
                </p>
                <p style={{ margin: 0, color: "#69728a", fontSize: 13 }}>
                  Winners announced by May 10, 2026.
                </p>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Rules Highlights</h2>
              <ul className="simpleList">
                <li>No purchase necessary to enter.</li>
                <li>One entry per eligible account.</li>
                <li>Must be 18+ and a legal U.S. resident.</li>
                <li>Accounts violating terms are disqualified.</li>
              </ul>
              <p className="meta" style={{ marginTop: 10, fontSize: 13 }}>
                Full legal terms are published before winner selection and may be updated for compliance.
              </p>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Ready to Join?</h2>
              <p className="meta" style={{ marginTop: 0 }}>
                Create an account to participate and track your event activity from the LIVEY dashboard.
              </p>
              <div className="pageActions">
                <Link href="/register" className="pageActionLink">
                  Enter Giveaway
                </Link>
                <Link href="/dashboard" className="pageActionLink secondary">
                  Open Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

const FAQS = [
  {
    question: "What is LIVEY?",
    answer:
      "LIVEY is a platform for discovering local live entertainment — concerts, DJ nights, comedy shows, and more — all in one place. Search by ZIP code to find events near you.",
  },
  {
    question: "How do I find events near me?",
    answer:
      "Enter your ZIP code in the search bar on the home page or the search page. You can then filter results by date, event type, and more.",
  },
  {
    question: "Do I need an account to browse events?",
    answer:
      "No! You can browse and search events as a guest. However, you need an account to save events, follow artists, and access your personal dashboard.",
  },
  {
    question: "How do I save an event?",
    answer:
      'Open any event page and click the "Save Event" button. You must be logged in with a user account. Saved events appear in your dashboard.',
  },
  {
    question: "How do I follow an artist or venue?",
    answer:
      "Visit an artist or venue profile and click the Follow button. You can also follow artists directly from event detail pages.",
  },
  {
    question: "I'm a venue owner. How do I list my events?",
    answer:
      "Create a venue account by clicking Sign Up and selecting Venue. Complete your venue profile once, then publish events through your Venue Dashboard any time.",
  },
  {
    question: "I'm an artist. How do I get on LIVEY?",
    answer:
      "Sign up as an artist and complete your profile. Venues can then associate you with events they publish. You can manage your profile from the Artist Dashboard.",
  },
  {
    question: "How do I contact support?",
    answer: "Email us at support@livey.app and we will get back to you as soon as possible.",
  },
];

export default function HelpPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <p className="dashboardPill">Support</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 36 }}>Help Center</h1>
            <p className="meta" style={{ fontSize: 15 }}>
              Answers to the most common questions about LIVEY.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {FAQS.map((faq) => (
              <div
                key={faq.question}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "16px 18px",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1c2334" }}>{faq.question}</h3>
                <p style={{ margin: 0, color: "#6b7590", fontSize: 14, lineHeight: 1.55 }}>{faq.answer}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 28,
              borderRadius: 12,
              border: "1px solid #dccfff",
              background: "#f5f0ff",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#3d2070" }}>Still need help?</h3>
              <p style={{ margin: 0, color: "#6b5a9a", fontSize: 14 }}>Our support team is happy to assist you.</p>
            </div>
            <div className="pageActions" style={{ margin: 0 }}>
              <a href="mailto:support@livey.app" className="pageActionLink">
                Email Support
              </a>
              <Link href="/search" className="pageActionLink secondary">
                Browse Events
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

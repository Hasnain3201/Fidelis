import Link from "next/link";

export default function NotFound() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div
          style={{
            maxWidth: 560,
            margin: "40px auto",
            textAlign: "center",
            padding: "48px 32px",
            borderRadius: 16,
            border: "1px solid #e3e7f1",
            background: "#ffffff",
            boxShadow: "0 8px 28px rgba(28,35,52,0.07)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f3eeff, #e9dfff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 32,
            }}
          >
            🎵
          </div>

          <p
            style={{
              fontSize: 80,
              fontWeight: 800,
              margin: "0 0 4px",
              background: "linear-gradient(135deg, #8048ff, #6d35ea)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
            }}
          >
            404
          </p>

          <h1 style={{ margin: "8px 0 10px", fontSize: 28 }}>Page Not Found</h1>

          <p className="meta" style={{ marginBottom: 24, fontSize: 15, lineHeight: 1.5 }}>
            Looks like this show got cancelled. The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>

          <div className="pageActions" style={{ justifyContent: "center" }}>
            <Link href="/" className="pageActionLink">
              Go Home
            </Link>
            <Link href="/search" className="pageActionLink secondary">
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

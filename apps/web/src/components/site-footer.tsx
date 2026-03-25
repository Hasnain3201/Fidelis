import Link from "next/link";

const CTA_ITEMS = [
  {
    icon: "🏢",
    title: "Own a Venue?",
    copy: "List your space and connect with artists and fans in your area.",
    button: "List Your Venue",
    href: "/register?role=venue",
  },
  {
    icon: "🎵",
    title: "Are You an Artist?",
    copy: "Get discovered by venues and build your fanbase locally.",
    button: "Join as Artist",
    href: "/register?role=artist",
  },
  {
    icon: "👤",
    title: "Love Live Events?",
    copy: "Never miss a show. Get personalized event recommendations.",
    button: "Sign Up Free",
    href: "/register?role=user",
  },
];

const FOOTER_COLUMNS = [
  {
    heading: "Discover",
    links: [
      { label: "Browse Events", href: "/search" },
      { label: "Find Venues", href: "/venues" },
      { label: "Explore Artists", href: "/artists" },
      { label: "This Weekend", href: "/search?date=weekend" },
      { label: "Free Events", href: "/search?query=free" },
      { label: "Fundraisers", href: "/search?query=fundraiser" },
    ],
  },
  {
    heading: "For Venues",
    links: [
      { label: "List Your Venue", href: "/register?role=venue" },
      { label: "Venue Dashboard", href: "/venues/dashboard" },
      { label: "Create Events", href: "/venues/create-event" },
      { label: "Promote Events", href: "/venues/dashboard" },
      { label: "Pricing", href: "/venues" },
      { label: "Success Stories", href: "/venues" },
    ],
  },
  {
    heading: "For Artists",
    links: [
      { label: "Join as Artist", href: "/register?role=artist" },
      { label: "Artist Dashboard", href: "/artists/dashboard" },
      { label: "Find Gigs", href: "/search" },
      { label: "Promote Yourself", href: "/artists/dashboard" },
      { label: "Resources", href: "/artists" },
      { label: "Artist Spotlight", href: "/artists" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact Us", href: "mailto:support@livey.app", external: true },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

const SOCIALS = [
  { label: "IG", href: "https://www.instagram.com", ariaLabel: "Instagram" },
  { label: "FB", href: "https://www.facebook.com", ariaLabel: "Facebook" },
  { label: "X", href: "https://x.com", ariaLabel: "X" },
  { label: "YT", href: "https://www.youtube.com", ariaLabel: "YouTube" },
];

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <section className="footerTopCta">
        <div className="siteContainer footerTopGrid">
          {CTA_ITEMS.map((item) => (
            <article key={item.title} className="footerTopCard">
              <div className="footerTopIcon" aria-hidden="true">
                {item.icon}
              </div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <Link href={item.href} className="footerTopButton">
                {item.button}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="footerMain">
        <div className="siteContainer footerMainGrid">
          <div className="footerBrandCol">
            <Link href="/" className="footerBrandRow">
              <span className="brandMark">L</span>
              <strong>LIVEY</strong>
            </Link>
            <p>
              Connecting venues, artists, and fans to create unforgettable local experiences.
            </p>
            <div className="socialRow">
              {SOCIALS.map((item) => (
                <a key={item.label} href={item.href} aria-label={item.ariaLabel} className="socialChip" target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footerBottom">
          <div className="siteContainer footerBottomInner">
            <p>© 2026 LIVEY. All rights reserved.</p>
            <p>
              Made with <span className="footerHeart">♥</span> for local communities
            </p>
          </div>
        </div>
      </section>
    </footer>
  );
}

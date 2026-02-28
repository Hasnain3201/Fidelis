import Link from "next/link";

const CTA_ITEMS = [
  {
    icon: "🏢",
    title: "Own a Venue?",
    copy: "List your space and connect with artists and fans in your area.",
    button: "List Your Venue",
  },
  {
    icon: "🎵",
    title: "Are You an Artist?",
    copy: "Get discovered by venues and build your fanbase locally.",
    button: "Join as Artist",
  },
  {
    icon: "👤",
    title: "Love Live Events?",
    copy: "Never miss a show. Get personalized event recommendations.",
    button: "Sign Up Free",
  },
];

const FOOTER_COLUMNS = [
  {
    heading: "Discover",
    links: ["Browse Events", "Find Venues", "Explore Artists", "This Weekend", "Free Events", "Fundraisers"],
  },
  {
    heading: "For Venues",
    links: ["List Your Venue", "Venue Dashboard", "Create Events", "Promote Events", "Pricing", "Success Stories"],
  },
  {
    heading: "For Artists",
    links: ["Join as Artist", "Artist Dashboard", "Find Gigs", "Promote Yourself", "Resources", "Artist Spotlight"],
  },
  {
    heading: "Support",
    links: ["Help Center", "Contact Us", "Privacy Policy", "Terms of Service", "Cookie Policy", "Accessibility"],
  },
];

const SOCIALS = ["IG", "FB", "X", "YT"];

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
              <button type="button" className="footerTopButton">
                {item.button}
              </button>
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
                <a key={item} href="#" aria-label={item} className="socialChip">
                  {item}
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#">{link}</a>
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

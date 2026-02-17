"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Events" },
  { href: "/venues", label: "Venues" },
  { href: "/artists", label: "Artists" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header>
      <div className="mainHeader">
        <div className="siteContainer mainHeaderInner">
          <Link href="/" className="brandBlock">
            <span className="brandMark">L</span>
            <span className="brandLabel">LIVEY</span>
          </Link>

          <nav className="primaryNav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={active ? "navLink active" : "navLink"}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="headerSearch">
            <input type="text" placeholder="Search events, venues, artists" />
          </div>

          <div className="authRow">
            <button className="signupBtn" type="button">
              Sign Up
            </button>
            <Link href="/login" className="loginLink">
              Login
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

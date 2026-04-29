"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/events", label: "Events" },
  { href: "/venues", label: "Venues" },
  { href: "/artists", label: "Artists" },
  { href: "/giveaway", label: "Giveaway" },
];

function getDashboardHref(session: AuthSession): string {
  if (session.role === "venue") return "/venues/dashboard";
  if (session.role === "artist") return "/artists/dashboard";
  return "/dashboard";
}

const ADMIN_NAV_ITEMS = [
  { href: "/admin/scraper", label: "Scraper" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  function handleHeaderSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = headerSearch.trim();
    if (!query) return;
    router.push(`/search?query=${encodeURIComponent(query)}`);
    setHeaderSearch("");
    searchRef.current?.blur();
  }

  useEffect(() => {
    setSession(getStoredAuthSession());

    function syncSession() {
      setSession(getStoredAuthSession());
    }

    const authChangeEvent = getAuthChangeEventName();
    window.addEventListener("storage", syncSession);
    window.addEventListener(authChangeEvent, syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(authChangeEvent, syncSession);
    };
  }, []);

  function onLogout() {
    clearAuthSession();
    setSession(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header>
      <div className="mainHeader">
        <div className="siteContainer mainHeaderInner">
          <Link href="/" className="brandBlock">
            <Image
              src="/icon.svg"
              alt="LIVEY"
              width={22}
              height={22}
              className="brandMarkImage"
            />
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

          <form className="headerSearch" onSubmit={handleHeaderSearch}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search events, venues, artists"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              aria-label="Search"
            />
          </form>

          <div className="authRow">
            {session ? (
              <>
                {session.role === "admin" &&
                  ADMIN_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={pathname === item.href ? "navLink active" : "navLink"}
                    >
                      {item.label}
                    </Link>
                  ))}
                <Link href="/profile" className="authBadge" style={{ cursor: "pointer" }}>
                  {session.role}
                </Link>
                <Link href={getDashboardHref(session)} className="signupBtn">
                  Dashboard
                </Link>
                <button type="button" className="logoutBtn" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/register" className="signupBtn">
                  Sign Up
                </Link>
                <Link href="/login" className="loginLink">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

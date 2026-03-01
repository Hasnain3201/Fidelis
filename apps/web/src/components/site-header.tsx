"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Events" },
  { href: "/venues", label: "Venues" },
  { href: "/artists", label: "Artists" },
];

function getDashboardHref(session: AuthSession): string {
  if (session.role === "venue") return "/venues/dashboard";
  if (session.role === "artist") return "/artists/dashboard";
  return "/dashboard";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

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
            {session ? (
              <>
                <span className="authBadge">{session.role}</span>
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

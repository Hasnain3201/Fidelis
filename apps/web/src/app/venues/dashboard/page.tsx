"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyVenue, listMyVenueEvents, type EventSummary, type VenueProfileResponse } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

function getRoleDashboardHref(session: AuthSession): string {
  if (session.role === "artist") return "/artists/dashboard";
  if (session.role === "user") return "/dashboard";
  return "/venues/dashboard";
}

function getLocationLabel(venue: VenueProfileResponse): string {
  const cityState = [venue.city, venue.state].filter(Boolean).join(", ");
  if (cityState) return `${cityState} ${venue.zip_code}`;
  return venue.zip_code;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VenueDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [venueProfile, setVenueProfile] = useState<VenueProfileResponse | null>(null);
  const [venueEvents, setVenueEvents] = useState<EventSummary[]>([]);
  const [isLoadingVenue, setIsLoadingVenue] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function syncSession() {
      setSession(getStoredAuthSession());
    }

    syncSession();

    const authEvent = getAuthChangeEventName();
    window.addEventListener("storage", syncSession);
    window.addEventListener(authEvent, syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(authEvent, syncSession);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVenueProfile(currentSession: AuthSession) {
      setIsLoadingVenue(true);
      setVenueError(null);

      try {
        const [profile, events] = await Promise.all([
          getMyVenue(currentSession),
          listMyVenueEvents(currentSession, 50),
        ]);
        if (cancelled) return;
        setVenueProfile(profile);
        setVenueEvents(events);
      } catch (error) {
        if (cancelled) return;
        setVenueProfile(null);
        setVenueEvents([]);
        const message = error instanceof Error ? error.message : "Unable to load venue profile.";
        setVenueError(message);
      } finally {
        if (!cancelled) {
          setIsLoadingVenue(false);
        }
      }
    }

    if (!session || session.role !== "venue") {
      setVenueProfile(null);
      setVenueEvents([]);
      setVenueError(null);
      setIsLoadingVenue(false);
      return;
    }

    void loadVenueProfile(session);

    return () => {
      cancelled = true;
    };
  }, [session, reloadKey]);

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">Log in as a venue account to manage event publishing.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">
                Login
              </Link>
              <Link href="/register" className="pageActionLink secondary">
                Create Venue Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (session.role !== "venue") {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">This dashboard is only available for venue accounts.</p>
            <div className="pageActions">
              <Link href={getRoleDashboardHref(session)} className="pageActionLink">
                Go to Your Dashboard
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

  if (isLoadingVenue) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="stateLoadingWrap">
            <div className="stateSkeletonTitle" />
            <div className="stateSkeletonLine" />
            <div className="cardsGrid eventsDense stateSkeletonGrid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`venue-dashboard-loading-${index}`} className="stateSkeletonCard compact" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (venueError) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">{venueError}</p>
            <div className="pageActions">
              <button type="button" className="pageActionLink" onClick={() => setReloadKey((current) => current + 1)}>
                Retry
              </button>
              <Link href="/venues/create-event" className="pageActionLink secondary">
                Create Event
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!venueProfile?.verified) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">
              Your venue account is not verified yet. Venue publishing tools are only available after verification.
            </p>
            <div className="pageActions">
              <Link href="/venues" className="pageActionLink secondary">
                Explore Venues
              </Link>
              <button type="button" className="pageActionLink" onClick={() => setReloadKey((current) => current + 1)}>
                Recheck Verification
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Venue Dashboard</p>
            <h1>{venueProfile.name}</h1>
            <p className="meta">Manage event publishing, monitor bookings, and track audience growth.</p>
            <p className="meta">{getLocationLabel(venueProfile)}</p>
            <div className="pageActions">
              <Link href="/venues/create-event" className="pageActionLink">
                Create Event
              </Link>
              <Link href="/dashboard" className="pageActionLink secondary">
                Switch to User Dashboard
              </Link>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Total Events</strong>
              <p>{venueEvents.length}</p>
            </div>
            <div className="miniCard">
              <strong>Upcoming</strong>
              <p>{venueEvents.filter((e) => new Date(e.start_time) > new Date()).length}</p>
            </div>
            <div className="miniCard">
              <strong>Status</strong>
              <p style={{ fontSize: 14, color: venueProfile.verified ? "#14b87d" : "#f59e0b" }}>
                {venueProfile.verified ? "✓ Verified" : "Pending"}
              </p>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Event Schedule</h2>
              {venueEvents.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No events published yet.</h3>
                  <p className="meta">Publish your first event to populate this schedule.</p>
                  <Link href="/venues/create-event" className="pageActionLink" style={{ marginTop: 8 }}>
                    Create Event
                  </Link>
                </div>
              ) : (
                <div className="listStack">
                  {venueEvents
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map((event) => {
                      const isUpcoming = new Date(event.start_time) > new Date();
                      return (
                        <div key={event.id} className="listItemRow">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 14 }}>{event.title}</strong>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  background: isUpcoming ? "#eefbf4" : "#f5f7ff",
                                  color: isUpcoming ? "#176344" : "#5a6278",
                                  border: `1px solid ${isUpcoming ? "#d5e9de" : "#dce3f2"}`,
                                }}
                              >
                                {isUpcoming ? "Upcoming" : "Past"}
                              </span>
                            </div>
                            <p className="meta" style={{ margin: "3px 0 0", fontSize: 12 }}>
                              {formatDateTime(event.start_time)} · {event.category}
                            </p>
                          </div>
                          <Link href={`/events/${event.id}`} className="pageActionLink secondary" style={{ fontSize: 12, minHeight: 28, flexShrink: 0 }}>
                            View
                          </Link>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Quick Actions</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { icon: "➕", label: "Create New Event", href: "/venues/create-event" },
                  { icon: "🔍", label: "Browse Events", href: "/search" },
                  { icon: "👤", label: "View My Profile", href: "/profile" },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="listItemRow"
                    style={{ textDecoration: "none", justifyContent: "flex-start", gap: 12 }}
                  >
                    <span style={{ fontSize: 18 }}>{action.icon}</span>
                    <strong style={{ fontSize: 14 }}>{action.label}</strong>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Publishing Checklist</h2>
              <div className="listStack">
                {[
                  { label: "Venue profile completed", done: true },
                  { label: "Account verified", done: venueProfile.verified },
                  { label: "First event published", done: venueEvents.length > 0 },
                  { label: "Ticket URL added to events", done: false },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        background: item.done ? "#eefbf4" : "#f5f7ff",
                        color: item.done ? "#176344" : "#9aa3b8",
                        border: `1px solid ${item.done ? "#d5e9de" : "#dce3f2"}`,
                        flexShrink: 0,
                      }}
                    >
                      {item.done ? "✓" : "·"}
                    </span>
                    <span style={{ fontSize: 13, color: item.done ? "#1c2334" : "#9aa3b8" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card phaseNote">
              <strong>Access and Verification</strong>
              <p className="meta">
                Verified venues can publish events. Account state is checked from `/api/v1/venues/mine`.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

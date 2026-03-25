"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyVenue, type VenueProfileResponse } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { EVENT_ITEMS } from "@/lib/mock-content";

const VENUE_EVENTS = EVENT_ITEMS.slice(0, 4);

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

export default function VenueDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [venueProfile, setVenueProfile] = useState<VenueProfileResponse | null>(null);
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
        const profile = await getMyVenue(currentSession);
        if (cancelled) return;
        setVenueProfile(profile);
      } catch (error) {
        if (cancelled) return;
        setVenueProfile(null);
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
              <strong>Upcoming Events</strong>
              <p>{VENUE_EVENTS.length}</p>
            </div>
            <div className="miniCard">
              <strong>Booked Tickets</strong>
              <p>142</p>
            </div>
            <div className="miniCard">
              <strong>Followers</strong>
              <p>928</p>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Upcoming Schedule</h2>
              <div className="listStack">
                {VENUE_EVENTS.map((event) => (
                  <div key={event.id} className="listItemRow">
                    <div>
                      <strong>{event.title}</strong>
                      <p className="meta">
                        {event.dateLabel} • {event.timeLabel} • {event.price}
                      </p>
                    </div>
                    <Link href={`/events/${event.id}`} className="pageActionLink secondary">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Draft Events</h2>
              <div className="emptyStateCard compact">
                <h3>No drafts in progress.</h3>
                <p className="meta">Create a draft to stage event details before publishing.</p>
                <Link href="/venues/create-event" className="pageActionLink">
                  Start Draft
                </Link>
              </div>
            </div>

            <div className="card">
              <h2>Publishing Checklist</h2>
              <ul className="simpleList">
                <li>Venue profile completed</li>
                <li>Account verified</li>
                <li>Ticket URL and capacity set</li>
                <li>Promotion copy approved</li>
              </ul>
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getMyProfile,
  listFavorites,
  listFollows,
  removeFavorite,
  unfollowArtist,
  type FavoriteItem,
  type FollowItem,
  type ProfileSummary,
} from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

function getRoleDashboardHref(session: AuthSession): string {
  if (session.role === "venue") return "/venues/dashboard";
  if (session.role === "artist") return "/artists/dashboard";
  return "/dashboard";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UserDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [follows, setFollows] = useState<FollowItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);
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

    async function loadDashboard(currentSession: AuthSession) {
      setIsLoading(true);
      setLoadError(null);
      setStatusMessage(null);

      try {
        const [profileResult, favoritesResult, followsResult] = await Promise.allSettled([
          getMyProfile(currentSession),
          listFavorites(currentSession),
          listFollows(currentSession),
        ]);

        if (cancelled) return;

        if (profileResult.status !== "fulfilled") {
          throw profileResult.reason;
        }

        const apiFavorites = favoritesResult.status === "fulfilled" ? favoritesResult.value : [];
        const followsData = followsResult.status === "fulfilled" ? followsResult.value : [];

        setProfile(profileResult.value);
        setFavorites(apiFavorites);
        setFollows(followsData);

        if (favoritesResult.status !== "fulfilled") {
          setStatusMessage({
            type: "error",
            text: "Live favorites unavailable right now.",
          });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load dashboard.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (!session || session.role !== "user") {
      setProfile(null);
      setFavorites([]);
      setFollows([]);
      setLoadError(null);
      setStatusMessage(null);
      setIsLoading(false);
      return;
    }

    void loadDashboard(session);

    return () => {
      cancelled = true;
    };
  }, [session, reloadKey]);

  const displayName = useMemo(() => {
    if (profile?.display_name?.trim()) return profile.display_name.trim();
    if (profile?.username?.trim()) return profile.username.trim();
    return "User";
  }, [profile]);

  async function handleUnfollow(artistId: string) {
    if (!session || session.role !== "user") return;

    setStatusMessage(null);
    setPendingFollowId(artistId);

    try {
      await unfollowArtist(artistId, session);
      setFollows((prev) => prev.filter((artist) => artist.artist_id !== artistId));
      setStatusMessage({ type: "success", text: "Artist removed from follows." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unfollow artist.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setPendingFollowId(null);
    }
  }

  async function handleUnfavorite(eventId: string) {
    if (!session || session.role !== "user") return;

    setStatusMessage(null);
    setPendingFavoriteId(eventId);

    try {
      await removeFavorite(eventId, session);
      setFavorites((prev) => prev.filter((favorite) => favorite.event_id !== eventId));
      setStatusMessage({ type: "success", text: "Event removed from favorites." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove favorite.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setPendingFavoriteId(null);
    }
  }

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>User Dashboard</h1>
            <p className="meta">Log in to view saved events and followed artists.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">
                Login
              </Link>
              <Link href="/register" className="pageActionLink secondary">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (session.role !== "user") {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>User Dashboard</h1>
            <p className="meta">This dashboard is only available for user accounts.</p>
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

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">User Dashboard</p>
            <h1>Welcome back, {displayName}</h1>
            <p className="meta">Track your saved events, followed artists, and your upcoming week in one place.</p>
            <div className="pageActions">
              <Link href="/search" className="pageActionLink">
                Find More Events
              </Link>
              <Link href="/register" className="pageActionLink secondary">
                Manage Account
              </Link>
            </div>
          </div>

          <div className="dashboardGrid" aria-busy={isLoading}>
            <div className="miniCard">
              <strong>Saved Events</strong>
              <p>{favorites.length}</p>
            </div>
            <div className="miniCard">
              <strong>Followed Artists</strong>
              <p>{follows.length}</p>
            </div>
            <div className="miniCard">
              <strong>Upcoming</strong>
              <p>{favorites.filter((f) => f.start_time && new Date(f.start_time) > new Date()).length}</p>
            </div>
          </div>

          {loadError ? <p className="statusBanner error">{loadError}</p> : null}
          {statusMessage ? (
            <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>{statusMessage.text}</p>
          ) : null}

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Saved Events</h2>
              {isLoading ? (
                <div className="listStack">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`fav-loading-${index}`} className="stateSkeletonCard compact" />
                  ))}
                </div>
              ) : favorites.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No saved events yet.</h3>
                  <p className="meta">Open an event and use Save Event to build your favorites list.</p>
                </div>
              ) : (
                <div className="listStack">
                  {favorites.map((favorite) => (
                    <div key={favorite.event_id} className="listItemRow">
                      <div>
                        <strong>{favorite.title ?? "Event"}</strong>
                        <p className="meta">{formatDate(favorite.start_time)}</p>
                      </div>
                      <div className="pageActions" style={{ margin: 0 }}>
                        <Link className="pageActionLink secondary" href={`/events/${favorite.event_id}`}>
                          Open
                        </Link>
                        <button
                          type="button"
                          className="pageActionLink secondary"
                          disabled={pendingFavoriteId === favorite.event_id}
                          onClick={() => void handleUnfavorite(favorite.event_id)}
                        >
                          {pendingFavoriteId === favorite.event_id ? "Removing..." : "Unfavorite"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Followed Artists</h2>
              {isLoading ? (
                <div className="listStack">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`follow-loading-${index}`} className="stateSkeletonCard compact" />
                  ))}
                </div>
              ) : follows.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No followed artists yet.</h3>
                  <p className="meta">Follow artists from event pages to keep up with their activity.</p>
                </div>
              ) : (
                <div className="listStack">
                  {follows.map((artist) => (
                    <div key={artist.artist_id} className="listItemRow">
                      <div>
                        <strong>{artist.stage_name ?? "Artist"}</strong>
                        <p className="meta">Following</p>
                      </div>
                      <button
                        type="button"
                        className="pageActionLink secondary"
                        disabled={pendingFollowId === artist.artist_id}
                        onClick={() => void handleUnfollow(artist.artist_id)}
                      >
                        {pendingFollowId === artist.artist_id ? "Updating..." : "Unfollow"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Notifications</h2>
              <div className="listStack">
                {[
                  {
                    icon: "🎵",
                    title: "Welcome to LIVEY!",
                    body: "Start by searching for events near your ZIP code.",
                    time: "Just now",
                    unread: true,
                  },
                  {
                    icon: "📅",
                    title: "Save events to get reminders",
                    body: "When you save an event, you will see upcoming reminders here.",
                    time: "Platform tip",
                    unread: false,
                  },
                  {
                    icon: "🎤",
                    title: "Follow artists you love",
                    body: "Get notified when followed artists are added to new events.",
                    time: "Platform tip",
                    unread: false,
                  },
                ].map((notif) => (
                  <div
                    key={notif.title}
                    className="listItemRow"
                    style={{
                      alignItems: "flex-start",
                      background: notif.unread ? "#f5f0ff" : "#f9fbff",
                      border: notif.unread ? "1px solid #dccfff" : "1px solid #e2e7f3",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "#ede8ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {notif.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>{notif.title}</strong>
                        {notif.unread && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#8048ff",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <p className="meta" style={{ margin: "2px 0 0", fontSize: 12 }}>{notif.body}</p>
                      <p className="meta" style={{ margin: "4px 0 0", fontSize: 11 }}>{notif.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Upcoming Events</h2>
              {isLoading ? (
                <div className="listStack">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`upcoming-loading-${i}`} className="stateSkeletonCard compact" />
                  ))}
                </div>
              ) : favorites.filter((f) => f.start_time && new Date(f.start_time) > new Date()).length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No upcoming events.</h3>
                  <p className="meta">Save future events and they will appear here as reminders.</p>
                </div>
              ) : (
                <div className="listStack">
                  {favorites
                    .filter((f) => f.start_time && new Date(f.start_time) > new Date())
                    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())
                    .map((fav) => {
                      const daysUntil = Math.ceil(
                        (new Date(fav.start_time!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <div key={fav.event_id} className="listItemRow">
                          <div>
                            <strong>{fav.title ?? "Event"}</strong>
                            <p className="meta">{formatDate(fav.start_time)}</p>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 999,
                                padding: "3px 9px",
                                background: daysUntil <= 3 ? "#fff1f4" : "#eefbf4",
                                color: daysUntil <= 3 ? "#902945" : "#176344",
                                border: `1px solid ${daysUntil <= 3 ? "#efd2d9" : "#d5e9de"}`,
                              }}
                            >
                              {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d away`}
                            </span>
                            <Link href={`/events/${fav.event_id}`} className="pageActionLink secondary" style={{ margin: 0, minHeight: 28, fontSize: 12 }}>
                              View
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Recommended Next Step</h2>
              <p className="meta">Complete your profile preferences to improve event recommendations.</p>
              <div className="pageActions">
                <button
                  type="button"
                  className="pageActionLink"
                  onClick={() => setReloadKey((current) => current + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? "Refreshing..." : "Refresh Dashboard"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

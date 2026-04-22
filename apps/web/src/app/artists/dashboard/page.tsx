"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createMyArtist,
  getArtistEvents,
  getMyArtist,
  updateMyArtist,
  type ArtistEventSummary,
  type ArtistProfileResponse,
  type UpdateMyArtistPayload,
} from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { Input } from "@/components/ui/input";

type StatusMessage = { type: "success" | "error"; text: string } | null;

type ArtistFormState = {
  stageName: string;
  genre: string;
  bio: string;
  mediaUrl: string;
  coverImageUrl: string;
};

const INITIAL_ARTIST_FORM: ArtistFormState = {
  stageName: "",
  genre: "",
  bio: "",
  mediaUrl: "",
  coverImageUrl: "",
};

function getRoleDashboardHref(session: AuthSession): string {
  if (session.role === "venue") return "/venues/dashboard";
  if (session.role === "user") return "/dashboard";
  return "/artists/dashboard";
}

function makeArtistForm(profile: ArtistProfileResponse | null): ArtistFormState {
  return {
    stageName: profile?.stage_name ?? "",
    genre: profile?.genre ?? "",
    bio: profile?.bio ?? "",
    mediaUrl: profile?.media_url ?? "",
    coverImageUrl: profile?.cover_image_url ?? "",
  };
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function daysUntil(value: string): number | null {
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24));
}

function isSetupError(message: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("managed artist profile not found") ||
    normalized.includes("no artist profile found") ||
    normalized.includes("no approved artist claim") ||
    normalized.includes("no artist claim found") ||
    normalized.includes("artist not found")
  );
}

function validateArtistForm(form: ArtistFormState): string | null {
  const stageName = form.stageName.trim();
  if (!stageName) return "Stage name is required.";
  if (stageName.length > 200) return "Stage name must be 200 characters or less.";

  if (form.genre.trim().length > 100) return "Genre must be 100 characters or less.";
  if (form.bio.trim().length > 3000) return "Bio must be 3000 characters or less.";

  if (form.mediaUrl.trim() && !isSafeHttpUrl(form.mediaUrl.trim())) {
    return "Media URL must start with http:// or https://.";
  }

  if (form.coverImageUrl.trim() && !isSafeHttpUrl(form.coverImageUrl.trim())) {
    return "Cover image URL must start with http:// or https://.";
  }

  return null;
}

function buildArtistUpdatePayload(
  form: ArtistFormState,
  profile: ArtistProfileResponse,
): UpdateMyArtistPayload | null {
  const payload: UpdateMyArtistPayload = {};

  const stageName = form.stageName.trim();
  const currentStageName = profile.stage_name.trim();
  if (stageName !== currentStageName) {
    payload.stage_name = stageName;
  }

  const genre = normalizeOptionalText(form.genre);
  const currentGenre = normalizeOptionalText(profile.genre ?? "");
  if (genre !== currentGenre) {
    payload.genre = genre;
  }

  const bio = normalizeOptionalText(form.bio);
  const currentBio = normalizeOptionalText(profile.bio ?? "");
  if (bio !== currentBio) {
    payload.bio = bio;
  }

  const mediaUrl = normalizeOptionalText(form.mediaUrl);
  const currentMediaUrl = normalizeOptionalText(profile.media_url ?? "");
  if (mediaUrl !== currentMediaUrl) {
    payload.media_url = mediaUrl;
  }

  const coverImageUrl = normalizeOptionalText(form.coverImageUrl);
  const currentCoverImageUrl = normalizeOptionalText(profile.cover_image_url ?? "");
  if (coverImageUrl !== currentCoverImageUrl) {
    payload.cover_image_url = coverImageUrl;
  }

  if (Object.keys(payload).length === 0) return null;
  return payload;
}

export default function ArtistDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);

  const [artistProfile, setArtistProfile] = useState<ArtistProfileResponse | null>(null);
  const [artistEvents, setArtistEvents] = useState<ArtistEventSummary[]>([]);
  const [form, setForm] = useState<ArtistFormState>(INITIAL_ARTIST_FORM);

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
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
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setReloadKey((current) => current + 1);
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard(currentSession: AuthSession) {
      setIsLoading(true);
      setLoadError(null);
      setStatusMessage(null);

      try {
        const profile = await getMyArtist(currentSession);
        if (cancelled) return;

        setArtistProfile(profile);
        setForm(makeArtistForm(profile));

        try {
          const events = await getArtistEvents(profile.id);
          if (cancelled) return;
          setArtistEvents(events);
        } catch (error) {
          if (cancelled) return;
          setArtistEvents([]);
          const message = error instanceof Error ? error.message : "Unable to load linked events.";
          setStatusMessage({ type: "error", text: message });
        }
      } catch (error) {
        if (cancelled) return;
        setArtistProfile(null);
        setArtistEvents([]);
        const message = error instanceof Error ? error.message : "Unable to load artist dashboard.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (!session || session.role !== "artist") {
      setArtistProfile(null);
      setArtistEvents([]);
      setForm(INITIAL_ARTIST_FORM);
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

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...artistEvents]
      .filter((event) => toTimestamp(event.start_time) > now)
      .sort((a, b) => toTimestamp(a.start_time) - toTimestamp(b.start_time));
  }, [artistEvents]);

  const pastEvents = useMemo(() => {
    const now = Date.now();
    return [...artistEvents]
      .filter((event) => toTimestamp(event.start_time) <= now)
      .sort((a, b) => toTimestamp(b.start_time) - toTimestamp(a.start_time));
  }, [artistEvents]);

  const profileCompletion = useMemo(() => {
    if (!artistProfile) return 0;
    const checks = [
      Boolean(artistProfile.stage_name?.trim()),
      Boolean(artistProfile.genre?.trim()),
      Boolean(artistProfile.bio?.trim()),
      Boolean(artistProfile.media_url?.trim()),
      Boolean(artistProfile.cover_image_url?.trim()),
    ];

    const completeCount = checks.filter(Boolean).length;
    return Math.round((completeCount / checks.length) * 100);
  }, [artistProfile]);

  const canShowSetupForm = !artistProfile && isSetupError(loadError);

  function updateField<K extends keyof ArtistFormState>(field: K, value: ArtistFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateProfile() {
    if (!session || session.role !== "artist") return;

    setStatusMessage(null);

    const validationError = validateArtistForm(form);
    if (validationError) {
      setStatusMessage({ type: "error", text: validationError });
      return;
    }

    try {
      setIsCreatingProfile(true);

      const created = await createMyArtist(
        {
          stage_name: form.stageName.trim(),
          genre: normalizeOptionalText(form.genre),
          bio: normalizeOptionalText(form.bio),
          media_url: normalizeOptionalText(form.mediaUrl),
          cover_image_url: normalizeOptionalText(form.coverImageUrl),
        },
        session,
      );

      setArtistProfile(created);
      setForm(makeArtistForm(created));
      setLoadError(null);

      try {
        const events = await getArtistEvents(created.id);
        setArtistEvents(events);
      } catch {
        setArtistEvents([]);
      }

      setStatusMessage({ type: "success", text: "Artist profile created and connected to your account." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create artist profile.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsCreatingProfile(false);
    }
  }

  async function handleSaveProfile() {
    if (!session || session.role !== "artist" || !artistProfile) return;

    setStatusMessage(null);

    const validationError = validateArtistForm(form);
    if (validationError) {
      setStatusMessage({ type: "error", text: validationError });
      return;
    }

    const payload = buildArtistUpdatePayload(form, artistProfile);
    if (!payload) {
      setStatusMessage({ type: "success", text: "No changes to save." });
      return;
    }

    try {
      setIsSavingProfile(true);
      const updated = await updateMyArtist(payload, session);
      setArtistProfile(updated);
      setForm(makeArtistForm(updated));
      setStatusMessage({ type: "success", text: "Artist profile updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update artist profile.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleCreateProfile();
  }

  function submitUpdateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSaveProfile();
  }

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Artist Dashboard</h1>
            <p className="meta">Log in as an artist account to manage your profile and linked events.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">
                Login
              </Link>
              <Link href="/register?role=artist" className="pageActionLink secondary">
                Create Artist Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (session.role !== "artist") {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Artist Dashboard</h1>
            <p className="meta">This dashboard is only available for artist accounts.</p>
            <div className="pageActions">
              <Link href={getRoleDashboardHref(session)} className="pageActionLink">
                Go to Your Dashboard
              </Link>
              <Link href="/artists" className="pageActionLink secondary">
                Explore Artists
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="stateLoadingWrap">
            <div className="stateSkeletonTitle" />
            <div className="stateSkeletonLine" />
            <div className="cardsGrid eventsDense stateSkeletonGrid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`artist-dashboard-loading-${index}`} className="stateSkeletonCard compact" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!artistProfile && canShowSetupForm) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="dashboardShell">
            <div className="card dashboardHeroCard">
              <p className="dashboardPill">Artist Dashboard</p>
              <h1>Set Up Your Artist Profile</h1>
              <p className="meta">Create your managed profile to unlock dashboard tools and event linking.</p>
            </div>

            <div className="card">
              <h2>Create Artist Profile</h2>
              <p className="meta" style={{ marginTop: 0 }}>
                This submits to backend <code>POST /api/v1/artists/mine</code> and auto-links the profile to your account.
              </p>

              {loadError ? <p className="statusBanner error">{loadError}</p> : null}
              {statusMessage ? (
                <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>
                  {statusMessage.text}
                </p>
              ) : null}

              <form onSubmit={submitCreateForm} className="createEventForm" noValidate>
                <Input
                  label="Stage Name"
                  value={form.stageName}
                  onChange={(event) => updateField("stageName", event.target.value.slice(0, 200))}
                  placeholder="Midnight Echo"
                  required
                />
                <Input
                  label="Genre"
                  value={form.genre}
                  onChange={(event) => updateField("genre", event.target.value.slice(0, 100))}
                  placeholder="Indie Rock"
                />
                <label className="uiInputWrap">
                  <span className="uiInputLabel">Bio</span>
                  <textarea
                    className="uiTextArea"
                    value={form.bio}
                    onChange={(event) => updateField("bio", event.target.value.slice(0, 3000))}
                    placeholder="Tell venues and fans about your style, history, and upcoming goals."
                    rows={5}
                  />
                </label>
                <Input
                  label="Media URL"
                  value={form.mediaUrl}
                  onChange={(event) => updateField("mediaUrl", event.target.value.slice(0, 500))}
                  placeholder="https://youtube.com/..."
                />
                <Input
                  label="Cover Image URL"
                  value={form.coverImageUrl}
                  onChange={(event) => updateField("coverImageUrl", event.target.value.slice(0, 500))}
                  placeholder="https://..."
                />

                <div className="pageActions" style={{ marginTop: 2 }}>
                  <button type="submit" className="pageActionLink" disabled={isCreatingProfile}>
                    {isCreatingProfile ? "Creating..." : "Create Artist Profile"}
                  </button>
                  <button
                    type="button"
                    className="pageActionLink secondary"
                    onClick={() => setReloadKey((current) => current + 1)}
                    disabled={isCreatingProfile}
                  >
                    Refresh
                  </button>
                  <Link href="/artists" className="pageActionLink secondary">
                    Browse Artists
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!artistProfile) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Artist Dashboard</h1>
            <p className="meta">{loadError ?? "Unable to load artist profile."}</p>
            <div className="pageActions">
              <button
                type="button"
                className="pageActionLink"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                Retry
              </button>
              <Link href="/artists" className="pageActionLink secondary">
                Explore Artists
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
            <p className="dashboardPill">Artist Dashboard</p>
            <h1>{artistProfile.stage_name}</h1>
            <p className="meta">Manage your profile, track linked gigs, and keep your public page current.</p>
            <div className="pageActions">
              <Link href={`/artists/${artistProfile.id}`} className="pageActionLink">
                View Public Profile
              </Link>
              <Link href="/events" className="pageActionLink secondary">
                Browse Events
              </Link>
              <button
                type="button"
                className="pageActionLink secondary"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={isLoading}
              >
                Refresh Dashboard
              </button>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Linked Events</strong>
              <p>{artistEvents.length}</p>
            </div>
            <div className="miniCard">
              <strong>Upcoming Gigs</strong>
              <p>{upcomingEvents.length}</p>
            </div>
            <div className="miniCard">
              <strong>Profile Complete</strong>
              <p>{profileCompletion}%</p>
            </div>
          </div>

          {statusMessage ? (
            <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>{statusMessage.text}</p>
          ) : null}

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Artist Profile</h2>
              <p className="meta" style={{ marginTop: 0 }}>
                Updates are saved to backend <code>PATCH /api/v1/artists/mine</code>.
              </p>

              <form onSubmit={submitUpdateForm} className="createEventForm" noValidate>
                <Input
                  label="Stage Name"
                  value={form.stageName}
                  onChange={(event) => updateField("stageName", event.target.value.slice(0, 200))}
                  required
                />
                <Input
                  label="Genre"
                  value={form.genre}
                  onChange={(event) => updateField("genre", event.target.value.slice(0, 100))}
                />
                <label className="uiInputWrap">
                  <span className="uiInputLabel">Bio</span>
                  <textarea
                    className="uiTextArea"
                    value={form.bio}
                    onChange={(event) => updateField("bio", event.target.value.slice(0, 3000))}
                    rows={5}
                  />
                </label>
                <Input
                  label="Media URL"
                  value={form.mediaUrl}
                  onChange={(event) => updateField("mediaUrl", event.target.value.slice(0, 500))}
                />
                <Input
                  label="Cover Image URL"
                  value={form.coverImageUrl}
                  onChange={(event) => updateField("coverImageUrl", event.target.value.slice(0, 500))}
                />

                <div className="pageActions" style={{ marginTop: 2 }}>
                  <button type="submit" className="pageActionLink" disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </button>
                  <button
                    type="button"
                    className="pageActionLink secondary"
                    onClick={() => setForm(makeArtistForm(artistProfile))}
                    disabled={isSavingProfile}
                  >
                    Reset Changes
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h2>Upcoming Gigs</h2>
              {upcomingEvents.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No upcoming linked events.</h3>
                  <p className="meta">When venues link your artist profile to events, upcoming gigs appear here.</p>
                </div>
              ) : (
                <div className="listStack">
                  {upcomingEvents.slice(0, 6).map((event) => {
                    const remainingDays = daysUntil(event.start_time);
                    return (
                      <div key={event.id} className="listItemRow">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{event.title || "Event"}</strong>
                          <p className="meta" style={{ margin: "3px 0 0", fontSize: 12 }}>
                            {formatDateTime(event.start_time)}
                            {event.venue_name ? ` · ${event.venue_name}` : ""}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                          {remainingDays !== null ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 999,
                                padding: "3px 9px",
                                background: remainingDays <= 3 ? "#fff1f4" : "#eefbf4",
                                color: remainingDays <= 3 ? "#902945" : "#176344",
                                border: `1px solid ${remainingDays <= 3 ? "#efd2d9" : "#d5e9de"}`,
                              }}
                            >
                              {remainingDays <= 0 ? "Today" : remainingDays === 1 ? "Tomorrow" : `${remainingDays}d`}
                            </span>
                          ) : null}
                          <Link href={`/events/${event.id}`} className="pageActionLink secondary" style={{ minHeight: 28, fontSize: 12 }}>
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
              <h2>Recent Appearances</h2>
              {pastEvents.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No past events yet.</h3>
                  <p className="meta">Your completed appearances will appear after event dates pass.</p>
                </div>
              ) : (
                <div className="listStack">
                  {pastEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="listItemRow">
                      <div>
                        <strong>{event.title || "Event"}</strong>
                        <p className="meta" style={{ margin: "3px 0 0", fontSize: 12 }}>
                          {formatDateTime(event.start_time)}
                          {event.venue_name ? ` · ${event.venue_name}` : ""}
                        </p>
                      </div>
                      <Link href={`/events/${event.id}`} className="pageActionLink secondary" style={{ minHeight: 28, fontSize: 12 }}>
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Quick Actions</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { icon: "👤", label: "Open Public Artist Page", href: `/artists/${artistProfile.id}` },
                  { icon: "🔎", label: "Explore Artists", href: "/artists" },
                  { icon: "📅", label: "Browse Event Search", href: "/search" },
                  { icon: "🏠", label: "Open User Dashboard", href: "/dashboard" },
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

            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Artist Readiness Checklist</h2>
              <div className="listStack" style={{ marginTop: 8 }}>
                {[
                  { label: "Stage name added", done: Boolean(artistProfile.stage_name?.trim()) },
                  { label: "Genre selected", done: Boolean(artistProfile.genre?.trim()) },
                  { label: "Bio completed", done: Boolean(artistProfile.bio?.trim()) },
                  { label: "Media link added", done: Boolean(artistProfile.media_url?.trim()) },
                  { label: "At least one upcoming linked event", done: upcomingEvents.length > 0 },
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
          </div>
        </div>
      </div>
    </section>
  );
}

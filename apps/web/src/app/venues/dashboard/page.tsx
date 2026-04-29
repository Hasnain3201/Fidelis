"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createMyVenue,
  getMyVenue,
  listMyVenueEvents,
  updateMyVenue,
  type EventSummary,
  type UpdateMyVenuePayload,
  type VenueProfileResponse,
} from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { isValidZipCode, normalizeZipInput, toZip5 } from "@/lib/zip";

type StatusMessage = { type: "success" | "error"; text: string } | null;

type VenueFormState = {
  name: string;
  description: string;
  addressLine: string;
  city: string;
  state: string;
  zipCode: string;
  coverImageUrl: string;
};

const INITIAL_VENUE_FORM: VenueFormState = {
  name: "",
  description: "",
  addressLine: "",
  city: "",
  state: "",
  zipCode: "",
  coverImageUrl: "",
};

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

function makeVenueForm(profile: VenueProfileResponse | null): VenueFormState {
  return {
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    addressLine: profile?.address_line ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    zipCode: profile?.zip_code ?? "",
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

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
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

function isSetupError(message: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("managed venue profile not found") ||
    normalized.includes("no venue profile found") ||
    normalized.includes("no approved venue claim") ||
    normalized.includes("no venue claim found") ||
    normalized.includes("venue not found")
  );
}

function validateVenueForm(form: VenueFormState): string | null {
  const name = form.name.trim();
  if (!name) return "Venue name is required.";
  if (name.length > 200) return "Venue name must be 200 characters or less.";

  if (form.description.trim().length > 3000) return "Description must be 3000 characters or less.";
  if (form.addressLine.trim().length > 300) return "Address line must be 300 characters or less.";
  if (form.city.trim().length > 100) return "City must be 100 characters or less.";

  const normalizedState = form.state.trim().toUpperCase();
  if (normalizedState && normalizedState.length !== 2) {
    return "State must be a 2-letter code (for example, NY).";
  }

  if (!form.zipCode.trim()) {
    return "ZIP code is required.";
  }

  if (!isValidZipCode(form.zipCode.trim())) {
    return "ZIP code must be in format 12345 or 12345-6789.";
  }

  if (toZip5(form.zipCode).length !== 5) {
    return "ZIP code must include 5 digits.";
  }

  if (form.coverImageUrl.trim() && !isSafeHttpUrl(form.coverImageUrl.trim())) {
    return "Cover image URL must start with http:// or https://.";
  }

  return null;
}

function buildVenueUpdatePayload(
  form: VenueFormState,
  profile: VenueProfileResponse,
): UpdateMyVenuePayload | null {
  const payload: UpdateMyVenuePayload = {};

  const name = form.name.trim();
  if (name !== profile.name.trim()) payload.name = name;

  const description = normalizeOptionalText(form.description);
  const currentDescription = normalizeOptionalText(profile.description ?? "");
  if (description !== currentDescription) payload.description = description;

  const addressLine = normalizeOptionalText(form.addressLine);
  const currentAddressLine = normalizeOptionalText(profile.address_line ?? "");
  if (addressLine !== currentAddressLine) payload.address_line = addressLine;

  const city = normalizeOptionalText(form.city);
  const currentCity = normalizeOptionalText(profile.city ?? "");
  if (city !== currentCity) payload.city = city;

  const state = normalizeOptionalText(form.state.toUpperCase());
  const currentState = normalizeOptionalText((profile.state ?? "").toUpperCase());
  if (state !== currentState) payload.state = state;

  const zipCode = toZip5(form.zipCode);
  if (zipCode && zipCode !== profile.zip_code) payload.zip_code = zipCode;

  const coverImageUrl = normalizeOptionalText(form.coverImageUrl);
  const currentCoverImageUrl = normalizeOptionalText(profile.cover_image_url ?? "");
  if (coverImageUrl !== currentCoverImageUrl) payload.cover_image_url = coverImageUrl;

  if (Object.keys(payload).length === 0) return null;
  return payload;
}

export default function VenueDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [venueProfile, setVenueProfile] = useState<VenueProfileResponse | null>(null);
  const [venueEvents, setVenueEvents] = useState<EventSummary[]>([]);
  const [form, setForm] = useState<VenueFormState>(INITIAL_VENUE_FORM);

  const [isLoadingVenue, setIsLoadingVenue] = useState(false);
  const [isSavingVenue, setIsSavingVenue] = useState(false);
  const [isCreatingVenue, setIsCreatingVenue] = useState(false);

  const [venueError, setVenueError] = useState<string | null>(null);
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

    async function loadVenueProfile(currentSession: AuthSession) {
      setIsLoadingVenue(true);
      setVenueError(null);
      setStatusMessage(null);

      try {
        const [profileResult, eventsResult] = await Promise.allSettled([
          getMyVenue(currentSession),
          listMyVenueEvents(currentSession, 100),
        ]);

        if (profileResult.status !== "fulfilled") {
          throw profileResult.reason;
        }

        if (cancelled) return;

        const events = eventsResult.status === "fulfilled" ? eventsResult.value : [];

        setVenueProfile(profileResult.value);
        setForm(makeVenueForm(profileResult.value));
        setVenueEvents(events);

        if (eventsResult.status !== "fulfilled") {
          setStatusMessage({
            type: "error",
            text: "Live event schedule is temporarily unavailable.",
          });
        }
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
      setForm(INITIAL_VENUE_FORM);
      setVenueError(null);
      setStatusMessage(null);
      setIsLoadingVenue(false);
      return;
    }

    void loadVenueProfile(session);

    return () => {
      cancelled = true;
    };
  }, [session, reloadKey]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...venueEvents]
      .filter((event) => toTimestamp(event.start_time) > now)
      .sort((a, b) => toTimestamp(a.start_time) - toTimestamp(b.start_time));
  }, [venueEvents]);

  const pastEvents = useMemo(() => {
    const now = Date.now();
    return [...venueEvents]
      .filter((event) => toTimestamp(event.start_time) <= now)
      .sort((a, b) => toTimestamp(b.start_time) - toTimestamp(a.start_time));
  }, [venueEvents]);

  const profileCompletion = useMemo(() => {
    if (!venueProfile) return 0;

    const checks = [
      Boolean(venueProfile.name?.trim()),
      Boolean(venueProfile.description?.trim()),
      Boolean(venueProfile.address_line?.trim()),
      Boolean(venueProfile.city?.trim()),
      Boolean(venueProfile.state?.trim()),
      Boolean(venueProfile.cover_image_url?.trim()),
    ];

    const completeCount = checks.filter(Boolean).length;
    return Math.round((completeCount / checks.length) * 100);
  }, [venueProfile]);

  const canShowSetupForm = !venueProfile && isSetupError(venueError);

  function updateField<K extends keyof VenueFormState>(field: K, value: VenueFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateVenueProfile() {
    if (!session || session.role !== "venue") return;

    setStatusMessage(null);

    const validationError = validateVenueForm(form);
    if (validationError) {
      setStatusMessage({ type: "error", text: validationError });
      return;
    }

    try {
      setIsCreatingVenue(true);

      const created = await createMyVenue(
        {
          name: form.name.trim(),
          description: normalizeOptionalText(form.description),
          address_line: normalizeOptionalText(form.addressLine),
          city: normalizeOptionalText(form.city),
          state: normalizeOptionalText(form.state.toUpperCase()),
          zip_code: toZip5(form.zipCode),
          cover_image_url: normalizeOptionalText(form.coverImageUrl),
        },
        session,
      );

      setVenueProfile(created);
      setForm(makeVenueForm(created));
      setVenueError(null);

      try {
        const events = await listMyVenueEvents(session, 100);
        setVenueEvents(events);
      } catch {
        setVenueEvents([]);
      }

      setStatusMessage({ type: "success", text: "Venue profile created and connected to your account." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create venue profile.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsCreatingVenue(false);
    }
  }

  async function handleSaveVenueProfile() {
    if (!session || session.role !== "venue" || !venueProfile) return;

    setStatusMessage(null);

    const validationError = validateVenueForm(form);
    if (validationError) {
      setStatusMessage({ type: "error", text: validationError });
      return;
    }

    const payload = buildVenueUpdatePayload(form, venueProfile);
    if (!payload) {
      setStatusMessage({ type: "success", text: "No changes to save." });
      return;
    }

    try {
      setIsSavingVenue(true);
      const updated = await updateMyVenue(payload, session);
      setVenueProfile(updated);
      setForm(makeVenueForm(updated));
      setStatusMessage({ type: "success", text: "Venue profile updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update venue profile.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsSavingVenue(false);
    }
  }

  function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleCreateVenueProfile();
  }

  function submitUpdateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSaveVenueProfile();
  }

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">Log in as a venue account to manage your profile and event publishing.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">
                Login
              </Link>
              <Link href="/register?role=venue" className="pageActionLink secondary">
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
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`venue-dashboard-loading-${index}`} className="stateSkeletonCard compact" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!venueProfile && canShowSetupForm) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="dashboardShell">
            <div className="card dashboardHeroCard">
              <p className="dashboardPill">Venue Dashboard</p>
              <h1>Set Up Your Venue Profile</h1>
              <p className="meta">Create your managed venue profile to access event publishing and dashboard analytics.</p>
            </div>

            <div className="card">
              <h2>Create Venue Profile</h2>
              <p className="meta" style={{ marginTop: 0 }}>
                This sends data to backend <code>POST /api/v1/venues/mine</code> and auto-links it to your venue account.
              </p>

              {venueError ? <p className="statusBanner error">{venueError}</p> : null}
              {statusMessage ? (
                <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>
                  {statusMessage.text}
                </p>
              ) : null}

              <form onSubmit={submitCreateForm} className="createEventForm" noValidate>
                <Input
                  label="Venue Name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value.slice(0, 200))}
                  placeholder="Blue Room"
                  required
                />
                <label className="uiInputWrap">
                  <span className="uiInputLabel">Description</span>
                  <textarea
                    className="uiTextArea"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value.slice(0, 3000))}
                    placeholder="Tell artists and fans about your space."
                    rows={5}
                  />
                </label>
                <Input
                  label="Address Line"
                  value={form.addressLine}
                  onChange={(event) => updateField("addressLine", event.target.value.slice(0, 300))}
                  placeholder="123 Main St"
                />
                <div className="inlineFields twoCol">
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value.slice(0, 100))}
                    placeholder="Brooklyn"
                  />
                  <Input
                    label="State"
                    value={form.state}
                    onChange={(event) => updateField("state", event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))}
                    placeholder="NY"
                  />
                </div>
                <Input
                  label="ZIP Code"
                  value={form.zipCode}
                  onChange={(event) => updateField("zipCode", normalizeZipInput(event.target.value))}
                  placeholder="11201"
                  required
                />
                <Input
                  label="Cover Image URL"
                  value={form.coverImageUrl}
                  onChange={(event) => updateField("coverImageUrl", event.target.value.slice(0, 500))}
                  placeholder="https://..."
                />

                <div className="pageActions" style={{ marginTop: 2 }}>
                  <button type="submit" className="pageActionLink" disabled={isCreatingVenue}>
                    {isCreatingVenue ? "Creating..." : "Create Venue Profile"}
                  </button>
                  <button
                    type="button"
                    className="pageActionLink secondary"
                    onClick={() => setReloadKey((current) => current + 1)}
                    disabled={isCreatingVenue}
                  >
                    Refresh
                  </button>
                  <Link href="/venues" className="pageActionLink secondary">
                    Browse Venues
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!venueProfile) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Venue Dashboard</h1>
            <p className="meta">{venueError ?? "Unable to load venue profile."}</p>
            <div className="pageActions">
              <button
                type="button"
                className="pageActionLink"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                Retry
              </button>
              <Link href="/venues" className="pageActionLink secondary">
                Explore Venues
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
            <p className="dashboardPill">Venue Dashboard</p>
            <h1>{venueProfile.name}</h1>
            <p className="meta">Manage your venue profile, publishing workflow, and event schedule.</p>
            <p className="meta">{getLocationLabel(venueProfile)}</p>
            <div className="pageActions">
              <Link href={`/venues/${venueProfile.id}`} className="pageActionLink">
                View Public Venue Page
              </Link>
              <Link href="/venues/create-event" className="pageActionLink secondary">
                Create Event
              </Link>
              <button
                type="button"
                className="pageActionLink secondary"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={isLoadingVenue}
              >
                Refresh Dashboard
              </button>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Total Events</strong>
              <p>{venueEvents.length}</p>
            </div>
            <div className="miniCard">
              <strong>Upcoming Events</strong>
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
              <h2>Venue Profile</h2>
              <p className="meta" style={{ marginTop: 0 }}>
                Updates are saved to backend <code>PATCH /api/v1/venues/mine</code>.
              </p>

              <form onSubmit={submitUpdateForm} className="createEventForm" noValidate>
                <Input
                  label="Venue Name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value.slice(0, 200))}
                  required
                />
                <label className="uiInputWrap">
                  <span className="uiInputLabel">Description</span>
                  <textarea
                    className="uiTextArea"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value.slice(0, 3000))}
                    rows={5}
                  />
                </label>
                <Input
                  label="Address Line"
                  value={form.addressLine}
                  onChange={(event) => updateField("addressLine", event.target.value.slice(0, 300))}
                />
                <div className="inlineFields twoCol">
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value.slice(0, 100))}
                  />
                  <Input
                    label="State"
                    value={form.state}
                    onChange={(event) => updateField("state", event.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))}
                  />
                </div>
                <Input
                  label="ZIP Code"
                  value={form.zipCode}
                  onChange={(event) => updateField("zipCode", normalizeZipInput(event.target.value))}
                  required
                />
                <Input
                  label="Cover Image URL"
                  value={form.coverImageUrl}
                  onChange={(event) => updateField("coverImageUrl", event.target.value.slice(0, 500))}
                />

                <div className="pageActions" style={{ marginTop: 2 }}>
                  <button type="submit" className="pageActionLink" disabled={isSavingVenue}>
                    {isSavingVenue ? "Saving..." : "Save Profile"}
                  </button>
                  <button
                    type="button"
                    className="pageActionLink secondary"
                    onClick={() => setForm(makeVenueForm(venueProfile))}
                    disabled={isSavingVenue}
                  >
                    Reset Changes
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h2>Event Schedule</h2>
              {upcomingEvents.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No upcoming events.</h3>
                  <p className="meta">Create your next event to keep your venue calendar active.</p>
                  <Link href="/venues/create-event" className="pageActionLink" style={{ marginTop: 8 }}>
                    Create Event
                  </Link>
                </div>
              ) : (
                <div className="listStack">
                  {upcomingEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="listItemRow">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{event.title}</strong>
                        <p className="meta" style={{ margin: "3px 0 0", fontSize: 12 }}>
                          {formatDateTime(event.start_time)} · {event.category}
                        </p>
                      </div>
                      <Link href={`/events/${event.id}`} className="pageActionLink secondary" style={{ minHeight: 28, fontSize: 12 }}>
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Past Events</h2>
              {pastEvents.length === 0 ? (
                <div className="emptyStateCard compact">
                  <h3>No past events yet.</h3>
                  <p className="meta">Completed events will move here automatically after their start dates.</p>
                </div>
              ) : (
                <div className="listStack">
                  {pastEvents.slice(0, 6).map((event) => (
                    <div key={event.id} className="listItemRow">
                      <div>
                        <strong>{event.title}</strong>
                        <p className="meta" style={{ margin: "3px 0 0", fontSize: 12 }}>
                          {formatDateTime(event.start_time)} · {event.category}
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
                  { icon: "➕", label: "Create New Event", href: "/venues/create-event" },
                  { icon: "🏛️", label: "Open Public Venue Page", href: `/venues/${venueProfile.id}` },
                  { icon: "🔍", label: "Browse Event Search", href: "/search" },
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
              <h2>Publishing Checklist</h2>
              <div className="listStack" style={{ marginTop: 8 }}>
                {[
                  { label: "Venue profile created", done: true },
                  { label: "Profile details completed", done: profileCompletion >= 80 },
                  { label: "At least one event published", done: venueEvents.length > 0 },
                  { label: "At least one upcoming event", done: upcomingEvents.length > 0 },
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

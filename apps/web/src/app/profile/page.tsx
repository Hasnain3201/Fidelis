"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { getMyProfile, updateMyPreferences, type ProfileSummary } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { getPoints, getVipStatus } from "@/lib/points";
import { LiveyPointsBadge } from "@/components/livey-points";

const AVATAR_KEY = "livey.profile.avatar";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://fidelisappsapi-production.up.railway.app";

const GENRE_OPTIONS = [
  "live-music",
  "concert",
  "comedy",
  "dj-set",
  "electronic",
  "hip-hop",
  "jazz",
  "country",
];

const EVENT_TYPE_OPTIONS = [
  "bar-lounge",
  "club-night",
  "festival",
  "acoustic-set",
  "comedy-show",
  "open-mic",
];

type SaveStatus = { type: "success" | "error"; text: string } | null;

type ProfileFormState = {
  displayName: string;
  username: string;
  homeZip: string;
  city: string;
  state: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  preferredGenres: string[];
  preferredEventTypes: string[];
  budgetMin: string;
  budgetMax: string;
  maxDistanceMiles: number;
};

function getStoredAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

function saveAvatar(dataUrl: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AVATAR_KEY, dataUrl);
  } catch {}
}

function removeAvatar() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AVATAR_KEY);
  } catch {}
}

function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMoneyInput(raw: string): string {
  const cleaned = raw
    .split("")
    .filter((ch) => (ch >= "0" && ch <= "9") || ch === ".")
    .join("");

  const [wholeRaw, ...rest] = cleaned.split(".");
  const whole = wholeRaw ?? "";
  const decimals = rest.join("").slice(0, 2);

  return (decimals ? `${whole}.${decimals}` : whole).slice(0, 10);
}

function normalizeZipInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function toZip5(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

function isValidZip(raw: string): boolean {
  return /^\d{5}$/.test(raw) || /^\d{5}-\d{4}$/.test(raw);
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function makeInitialForm(profile: ProfileSummary | null): ProfileFormState {
  return {
    displayName: profile?.display_name ?? "",
    username: profile?.username ?? "",
    homeZip: profile?.home_zip ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    emailOptIn: Boolean(profile?.email_opt_in),
    smsOptIn: Boolean(profile?.sms_opt_in),
    preferredGenres: profile?.preferred_genres ?? [],
    preferredEventTypes: profile?.preferred_event_types ?? [],
    budgetMin:
      typeof profile?.budget_min === "number" ? String(profile.budget_min) : "",
    budgetMax:
      typeof profile?.budget_max === "number" ? String(profile.budget_max) : "",
    maxDistanceMiles:
      typeof profile?.max_distance_miles === "number"
        ? profile.max_distance_miles
        : 25,
  };
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as {
      detail?: string;
      message?: string;
      error?: string;
    };
    return parsed.detail || parsed.message || parsed.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function patchMyProfile(
  session: AuthSession,
  payload: {
    display_name: string | null;
    username: string | null;
    home_zip: string | null;
    city: string | null;
    state: string | null;
    email_opt_in: boolean;
    sms_opt_in: boolean;
  },
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/profiles/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export default function ProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [form, setForm] = useState<ProfileFormState>(makeInitialForm(null));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function syncSession() {
      setSession(getStoredAuthSession());
    }

    syncSession();
    setAvatarUrl(getStoredAvatar());

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

    async function loadProfile(currentSession: AuthSession) {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getMyProfile(currentSession);
        if (cancelled) return;
        setProfile(data);
        setForm(makeInitialForm(data));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (!session) {
      setProfile(null);
      setForm(makeInitialForm(null));
      return;
    }

    void loadProfile(session);
    return () => {
      cancelled = true;
    };
  }, [session]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarFeedback("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarFeedback("Image must be under 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result) return;
      saveAvatar(result);
      setAvatarUrl(result);
      setAvatarFeedback("Profile picture updated!");
      window.setTimeout(() => setAvatarFeedback(null), 3000);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    removeAvatar();
    setAvatarUrl(null);
    setAvatarFeedback("Profile picture removed.");
    window.setTimeout(() => setAvatarFeedback(null), 3000);
  }

  function toggleArrayValue(
    current: string[],
    value: string,
    setter: (next: string[]) => void,
  ) {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
      return;
    }
    setter([...current, value]);
  }

  function resetFormFromProfile() {
    setForm(makeInitialForm(profile));
  }

  async function handleSaveProfile() {
    if (!session) return;

    setSaveStatus(null);

    if (form.homeZip.trim() && !isValidZip(form.homeZip.trim())) {
      setSaveStatus({
        type: "error",
        text: "Home ZIP must be in format 12345 or 12345-6789.",
      });
      return;
    }

    const budgetMin = parseOptionalNumber(form.budgetMin);
    const budgetMax = parseOptionalNumber(form.budgetMax);

    if (form.budgetMin.trim() && budgetMin === undefined) {
      setSaveStatus({ type: "error", text: "Budget min must be a valid number." });
      return;
    }

    if (form.budgetMax.trim() && budgetMax === undefined) {
      setSaveStatus({ type: "error", text: "Budget max must be a valid number." });
      return;
    }

    if (budgetMin !== undefined && budgetMin < 0) {
      setSaveStatus({ type: "error", text: "Budget min must be >= 0." });
      return;
    }

    if (budgetMax !== undefined && budgetMax < 0) {
      setSaveStatus({ type: "error", text: "Budget max must be >= 0." });
      return;
    }

    if (
      budgetMin !== undefined &&
      budgetMax !== undefined &&
      budgetMin > budgetMax
    ) {
      setSaveStatus({
        type: "error",
        text: "Budget min cannot exceed budget max.",
      });
      return;
    }

    if (!Number.isInteger(form.maxDistanceMiles) || form.maxDistanceMiles < 1 || form.maxDistanceMiles > 250) {
      setSaveStatus({
        type: "error",
        text: "Max distance must be between 1 and 250 miles.",
      });
      return;
    }

    try {
      setIsSaving(true);

      await patchMyProfile(session, {
        display_name: form.displayName.trim() || null,
        username: form.username.trim() || null,
        home_zip: form.homeZip.trim() ? toZip5(form.homeZip.trim()) : null,
        city: form.city.trim() || null,
        state: form.state.trim() ? form.state.trim().toUpperCase() : null,
        email_opt_in: form.emailOptIn,
        sms_opt_in: form.smsOptIn,
      });

      await updateMyPreferences(session, {
        preferredGenres: form.preferredGenres,
        preferredEventTypes: form.preferredEventTypes,
        budgetMin,
        budgetMax,
        maxDistanceMiles: form.maxDistanceMiles,
        markOnboardingComplete: true,
      });

      const refreshed = await getMyProfile(session);
      setProfile(refreshed);
      setForm(makeInitialForm(refreshed));
      setIsEditing(false);
      setSaveStatus({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setSaveStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>My Profile</h1>
            <p className="meta">Log in to view your profile.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">Login</Link>
              <Link href="/register" className="pageActionLink secondary">Create Account</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <p className="dashboardPill">Account</p>
            <h1 style={{ margin: "8px 0 4px", fontSize: 34 }}>My Profile</h1>
            <p className="meta">View and edit your LIVEY profile and personalization preferences.</p>
          </div>

          {error ? <p className="statusBanner error">{error}</p> : null}
          {saveStatus ? (
            <p className={`statusBanner ${saveStatus.type === "success" ? "success" : "error"}`}>
              {saveStatus.text}
            </p>
          ) : null}

          {isLoading ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="stateSkeletonCard compact" />
              <div className="stateSkeletonCard compact" />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "20px 22px",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Change profile picture"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: avatarUrl ? "transparent" : "linear-gradient(135deg, #8048ff, #6d35ea)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: 28,
                      fontWeight: 700,
                      flexShrink: 0,
                      border: "3px solid #e0d5ff",
                      cursor: "pointer",
                      overflow: "hidden",
                      padding: 0,
                    }}
                    aria-label="Change profile picture"
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (profile?.display_name ?? profile?.username ?? session.email ?? "U")[0].toUpperCase()
                    )}
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#8048ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      border: "2px solid #fff",
                      pointerEvents: "none",
                    }}
                  >
                    📷
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>
                    {profile?.display_name ?? profile?.username ?? "LIVEY User"}
                  </h2>
                  <p className="meta" style={{ margin: 0, fontSize: 13 }}>{session.email}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "3px 9px",
                        background: "#f3eeff",
                        color: "#6942d6",
                        border: "1px solid #dacfff",
                        textTransform: "capitalize",
                      }}
                    >
                      {profile?.role ?? session.role}
                    </span>
                    <LiveyPointsBadge />
                    {(() => {
                      const pts = getPoints();
                      const vip = getVipStatus(pts);
                      if (!vip.isVip) return null;
                      return (
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: "3px 9px",
                            background: "linear-gradient(135deg,#f5b942,#e88c1a)",
                            color: "#fff",
                            border: "1px solid #e88c1a",
                          }}
                        >
                          {vip.label}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        fontSize: 11,
                        color: "#7040ef",
                        fontWeight: 700,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Change photo
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        style={{
                          fontSize: 11,
                          color: "#c0365a",
                          fontWeight: 700,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                  {avatarFeedback && (
                    <p className="meta" role="status" style={{ margin: "6px 0 0", fontSize: 12, color: "#6942d6", fontWeight: 600 }}>
                      {avatarFeedback}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "18px 22px",
                  display: "grid",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {isEditing ? "Edit Profile" : "Profile Details"}
                  </h3>
                  {!isEditing ? (
                    <button type="button" className="pageActionLink" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </button>
                  ) : null}
                </div>

                {!isEditing ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {[
                      { label: "Display Name", value: profile?.display_name ?? "—" },
                      { label: "Username", value: profile?.username ?? "—" },
                      { label: "Home ZIP", value: profile?.home_zip ?? "—" },
                      { label: "City", value: profile?.city ?? "—" },
                      { label: "State", value: profile?.state ?? "—" },
                      { label: "Email Opt-in", value: profile?.email_opt_in ? "Yes" : "No" },
                      { label: "SMS Opt-in", value: profile?.sms_opt_in ? "Yes" : "No" },
                      {
                        label: "Preferred Genres",
                        value: (profile?.preferred_genres ?? []).length
                          ? (profile?.preferred_genres ?? []).map(titleCaseSlug).join(", ")
                          : "—",
                      },
                      {
                        label: "Preferred Event Types",
                        value: (profile?.preferred_event_types ?? []).length
                          ? (profile?.preferred_event_types ?? []).map(titleCaseSlug).join(", ")
                          : "—",
                      },
                      {
                        label: "Budget Range",
                        value:
                          profile?.budget_min != null || profile?.budget_max != null
                            ? `${profile?.budget_min ?? "—"} to ${profile?.budget_max ?? "—"}`
                            : "—",
                      },
                      {
                        label: "Max Distance (miles)",
                        value: profile?.max_distance_miles != null ? String(profile.max_distance_miles) : "—",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "#f9fbff",
                          border: "1px solid #edf0f8",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#5a6278", fontWeight: 600 }}>{item.label}</span>
                        <span style={{ fontSize: 13, color: "#1c2334", fontWeight: 600, textAlign: "right" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div className="inlineFields twoCol">
                      <label className="uiInputWrap">
                        <span className="uiInputLabel">Display Name</span>
                        <input
                          className="uiInput"
                          value={form.displayName}
                          onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value.slice(0, 80) }))}
                          maxLength={80}
                        />
                      </label>

                      <label className="uiInputWrap">
                        <span className="uiInputLabel">Username</span>
                        <input
                          className="uiInput"
                          value={form.username}
                          onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value.slice(0, 40) }))}
                          maxLength={40}
                        />
                      </label>
                    </div>

                    <div className="inlineFields threeCol">
                      <label className="uiInputWrap">
                        <span className="uiInputLabel">Home ZIP</span>
                        <input
                          className="uiInput"
                          value={form.homeZip}
                          onChange={(e) => setForm((prev) => ({ ...prev, homeZip: normalizeZipInput(e.target.value) }))}
                          maxLength={10}
                          inputMode="numeric"
                        />
                      </label>

                      <label className="uiInputWrap">
                        <span className="uiInputLabel">City</span>
                        <input
                          className="uiInput"
                          value={form.city}
                          onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value.slice(0, 80) }))}
                          maxLength={80}
                        />
                      </label>

                      <label className="uiInputWrap">
                        <span className="uiInputLabel">State</span>
                        <input
                          className="uiInput"
                          value={form.state}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              state: e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2),
                            }))
                          }
                          maxLength={2}
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <label className="checkItem" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={form.emailOptIn}
                          onChange={(e) => setForm((prev) => ({ ...prev, emailOptIn: e.target.checked }))}
                        />
                        Email notifications enabled
                      </label>

                      <label className="checkItem" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={form.smsOptIn}
                          onChange={(e) => setForm((prev) => ({ ...prev, smsOptIn: e.target.checked }))}
                        />
                        SMS notifications enabled
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <span className="uiInputLabel">Preferred Genres</span>
                      <div className="checkboxGrid">
                        {GENRE_OPTIONS.map((genre) => (
                          <label key={genre} className="checkItem" style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={form.preferredGenres.includes(genre)}
                              onChange={() =>
                                toggleArrayValue(form.preferredGenres, genre, (next) =>
                                  setForm((prev) => ({ ...prev, preferredGenres: next })),
                                )
                              }
                            />
                            {titleCaseSlug(genre)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <span className="uiInputLabel">Preferred Event Types</span>
                      <div className="checkboxGrid">
                        {EVENT_TYPE_OPTIONS.map((eventType) => (
                          <label key={eventType} className="checkItem" style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={form.preferredEventTypes.includes(eventType)}
                              onChange={() =>
                                toggleArrayValue(form.preferredEventTypes, eventType, (next) =>
                                  setForm((prev) => ({ ...prev, preferredEventTypes: next })),
                                )
                              }
                            />
                            {titleCaseSlug(eventType)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="inlineFields twoCol">
                      <label className="uiInputWrap">
                        <span className="uiInputLabel">Budget Min ($)</span>
                        <input
                          className="uiInput"
                          value={form.budgetMin}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, budgetMin: normalizeMoneyInput(e.target.value) }))
                          }
                          inputMode="decimal"
                        />
                      </label>

                      <label className="uiInputWrap">
                        <span className="uiInputLabel">Budget Max ($)</span>
                        <input
                          className="uiInput"
                          value={form.budgetMax}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, budgetMax: normalizeMoneyInput(e.target.value) }))
                          }
                          inputMode="decimal"
                        />
                      </label>
                    </div>

                    <label className="uiInputWrap">
                      <span className="uiInputLabel">
                        Max Distance: {form.maxDistanceMiles} miles
                      </span>
                      <input
                        className="uiInput"
                        type="range"
                        min={1}
                        max={250}
                        step={1}
                        value={form.maxDistanceMiles}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, maxDistanceMiles: Number(e.target.value) }))
                        }
                      />
                    </label>

                    <div className="pageActions" style={{ marginBottom: 0 }}>
                      <button
                        type="button"
                        className="pageActionLink"
                        disabled={isSaving}
                        onClick={() => void handleSaveProfile()}
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        className="pageActionLink secondary"
                        disabled={isSaving}
                        onClick={() => {
                          resetFormFromProfile();
                          setIsEditing(false);
                          setSaveStatus(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pageActions">
                <Link href="/dashboard" className="pageActionLink">
                  My Dashboard
                </Link>
                <Link href="/events" className="pageActionLink secondary">
                  Browse Events
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
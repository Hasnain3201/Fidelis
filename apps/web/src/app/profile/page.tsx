"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getMyProfile, type ProfileSummary } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

const AVATAR_KEY = "livey.profile.avatar";

function getStoredAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
}

function saveAvatar(dataUrl: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch {}
}

export default function ProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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
      const result = reader.result as string;
      saveAvatar(result);
      setAvatarUrl(result);
      setAvatarFeedback("Profile picture updated!");
      setTimeout(() => setAvatarFeedback(null), 3000);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(AVATAR_KEY); } catch {}
    }
    setAvatarUrl(null);
    setAvatarFeedback("Profile picture removed.");
    setTimeout(() => setAvatarFeedback(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(currentSession: AuthSession) {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getMyProfile(currentSession);
        if (cancelled) return;
        setProfile(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (!session) {
      setProfile(null);
      return;
    }
    void loadProfile(session);
    return () => { cancelled = true; };
  }, [session]);

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
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <p className="dashboardPill">Account</p>
            <h1 style={{ margin: "8px 0 4px", fontSize: 34 }}>My Profile</h1>
            <p className="meta">Your account details on LIVEY.</p>
          </div>

          {error ? <p className="statusBanner error">{error}</p> : null}

          {isLoading ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="stateSkeletonCard compact" />
              <div className="stateSkeletonCard compact" />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {/* Avatar + Name */}
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
                {/* Avatar with click-to-upload */}
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
                  {/* Camera overlay on hover */}
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

              {/* Profile Details */}
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid #e3e7f1",
                  background: "#ffffff",
                  padding: "18px 22px",
                }}
              >
                <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Profile Details</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    { label: "Display Name", value: profile?.display_name ?? "—" },
                    { label: "Username", value: profile?.username ?? "—" },
                    { label: "Home ZIP", value: profile?.home_zip ?? "—" },
                    { label: "City", value: profile?.city ?? "—" },
                    { label: "State", value: profile?.state ?? "—" },
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
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#5a6278", fontWeight: 600 }}>{item.label}</span>
                      <span style={{ fontSize: 13, color: "#1c2334", fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pageActions">
                <Link href="/dashboard" className="pageActionLink">
                  My Dashboard
                </Link>
                <Link href="/search" className="pageActionLink secondary">
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

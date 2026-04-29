"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMyProfile,
  updateMyPreferences,
  type ProfileSummary,
} from "@/lib/api";
import {
  getAuthChangeEventName,
  getStoredAuthSession,
  type AuthSession,
} from "@/lib/auth";

const GENRE_OPTIONS = [
  { label: "Live Music", value: "live-music" },
  { label: "Concert", value: "concert" },
  { label: "Comedy", value: "comedy" },
  { label: "DJ", value: "dj-set" },
  { label: "Electronic", value: "electronic" },
  { label: "Hip Hop", value: "hip-hop" },
  { label: "Jazz", value: "jazz" },
  { label: "Country", value: "country" },
];

const EVENT_TYPE_OPTIONS = [
  { label: "Bar / Lounge", value: "bar-lounge" },
  { label: "Club Night", value: "club-night" },
  { label: "Festival", value: "festival" },
  { label: "Acoustic Set", value: "acoustic-set" },
  { label: "Comedy Show", value: "comedy-show" },
  { label: "Open Mic", value: "open-mic" },
];

function getRoleDashboardHref(session: AuthSession): string {
  if (session.role === "venue") return "/venues/dashboard";
  if (session.role === "artist") return "/artists/dashboard";
  return "/dashboard";
}

export default function OnboardingPage() {
  const router = useRouter();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [preferredEventTypes, setPreferredEventTypes] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [maxDistanceMiles, setMaxDistanceMiles] = useState(25);

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

    async function load() {
      if (!session || session.role !== "user") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getMyProfile(session);
        if (cancelled) return;

        setProfile(data);
        setPreferredGenres(data.preferred_genres ?? []);
        setPreferredEventTypes(data.preferred_event_types ?? []);
        setBudgetMin(
          typeof data.budget_min === "number" ? String(data.budget_min) : "",
        );
        setBudgetMax(
          typeof data.budget_max === "number" ? String(data.budget_max) : "",
        );
        setMaxDistanceMiles(
          typeof data.max_distance_miles === "number"
            ? data.max_distance_miles
            : 25,
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const stepTitle = useMemo(() => {
    if (step === 0) return "What genres do you like?";
    if (step === 1) return "What event types do you prefer?";
    if (step === 2) return "What is your budget range?";
    return "How far are you willing to travel?";
  }, [step]);

  function toggleValue(current: string[], value: string, setFn: (next: string[]) => void) {
    if (current.includes(value)) {
      setFn(current.filter((item) => item !== value));
      return;
    }
    setFn([...current, value]);
  }

  async function completeOnboarding(skipAll = false) {
    if (!session) return;
    setError(null);

    const minVal = budgetMin.trim() ? Number(budgetMin) : undefined;
    const maxVal = budgetMax.trim() ? Number(budgetMax) : undefined;

    if (!skipAll) {
      if (minVal !== undefined && (Number.isNaN(minVal) || minVal < 0)) {
        setError("Budget min must be a positive number.");
        return;
      }

      if (maxVal !== undefined && (Number.isNaN(maxVal) || maxVal < 0)) {
        setError("Budget max must be a positive number.");
        return;
      }

      if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
        setError("Budget min cannot exceed budget max.");
        return;
      }
    }

    try {
      setIsSaving(true);

      await updateMyPreferences(session, {
        preferredGenres: skipAll ? [] : preferredGenres,
        preferredEventTypes: skipAll ? [] : preferredEventTypes,
        budgetMin: skipAll ? undefined : minVal,
        budgetMax: skipAll ? undefined : maxVal,
        maxDistanceMiles: skipAll ? 25 : maxDistanceMiles,
        markOnboardingComplete: true,
      });

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!session) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>Personalize Your Account</h1>
            <p className="meta">Sign in first to continue onboarding.</p>
            <div className="pageActions">
              <Link href="/login" className="pageActionLink">Login</Link>
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
            <h1>Personalize Your Account</h1>
            <p className="meta">This onboarding flow is currently for user accounts.</p>
            <div className="pageActions">
              <Link href={getRoleDashboardHref(session)} className="pageActionLink">
                Go to Dashboard
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
            <div className="stateSkeletonCard tall" />
          </div>
        </div>
      </section>
    );
  }

  if (profile?.onboarding_completed_at) {
    return (
      <section className="siteSection pageUtility">
        <div className="siteContainer">
          <div className="card emptyStateCard">
            <h1>You are all set</h1>
            <p className="meta">Your personalization preferences are already saved.</p>
            <div className="pageActions">
              <Link href="/dashboard" className="pageActionLink">Open Dashboard</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p className="dashboardPill">Onboarding</p>
              <h1 style={{ margin: "8px 0 4px" }}>{stepTitle}</h1>
              <p className="meta">Step {step + 1} of 4</p>
            </div>
            <button
              type="button"
              className="textResetBtn"
              disabled={isSaving}
              onClick={() => void completeOnboarding(true)}
            >
              Skip all for now
            </button>
          </div>

          {error ? <p className="statusBanner error">{error}</p> : null}

          <div style={{ marginTop: 14 }}>
            {step === 0 && (
              <div className="checkboxGrid">
                {GENRE_OPTIONS.map((item) => (
                  <label key={item.value} className="checkItem">
                    <input
                      type="checkbox"
                      checked={preferredGenres.includes(item.value)}
                      onChange={() => toggleValue(preferredGenres, item.value, setPreferredGenres)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="checkboxGrid">
                {EVENT_TYPE_OPTIONS.map((item) => (
                  <label key={item.value} className="checkItem">
                    <input
                      type="checkbox"
                      checked={preferredEventTypes.includes(item.value)}
                      onChange={() =>
                        toggleValue(preferredEventTypes, item.value, setPreferredEventTypes)
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="inlineFields twoCol">
                <Input
                  label="Budget Min ($)"
                  inputMode="decimal"
                  placeholder="0"
                  value={budgetMin}
                  onChange={(e) =>
                    setBudgetMin(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))
                  }
                />
                <Input
                  label="Budget Max ($)"
                  inputMode="decimal"
                  placeholder="100"
                  value={budgetMax}
                  onChange={(e) =>
                    setBudgetMax(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))
                  }
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <label className="uiInputWrap">
                  <span className="uiInputLabel">Max Distance: {maxDistanceMiles} miles</span>
                  <input
                    className="uiInput"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={maxDistanceMiles}
                    onChange={(e) => setMaxDistanceMiles(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="pageActions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="pageActionLink secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || isSaving}
            >
              Back
            </button>

            {step < 3 ? (
              <>
                <button
                  type="button"
                  className="pageActionLink secondary"
                  disabled={isSaving}
                  onClick={() => setStep((s) => Math.min(3, s + 1))}
                >
                  Skip this step
                </button>
                <Button type="button" disabled={isSaving} onClick={() => setStep((s) => Math.min(3, s + 1))}>
                  Next
                </Button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="pageActionLink secondary"
                  disabled={isSaving}
                  onClick={() => void completeOnboarding(true)}
                >
                  Skip and Finish
                </button>
                <Button type="button" disabled={isSaving} onClick={() => void completeOnboarding(false)}>
                  {isSaving ? "Saving..." : "Save Preferences"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
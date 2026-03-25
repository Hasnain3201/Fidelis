"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

const LOCAL_VENUE_FOLLOWS_KEY = "livey.local.venue-follows.v1";

function readLocalVenueFollows(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_VENUE_FOLLOWS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeLocalVenueFollows(nextIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_VENUE_FOLLOWS_KEY, JSON.stringify(nextIds));
}

type VenueFollowButtonProps = {
  venueId: string;
};

export function VenueFollowButton({ venueId }: VenueFollowButtonProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

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
    if (!session || session.role !== "user") {
      setIsFollowing(false);
      return;
    }

    const followed = readLocalVenueFollows();
    setIsFollowing(followed.includes(venueId));
  }, [session, venueId]);

  function onToggleFollow() {
    if (!session || session.role !== "user") return;

    const current = readLocalVenueFollows();

    if (current.includes(venueId)) {
      const next = current.filter((id) => id !== venueId);
      writeLocalVenueFollows(next);
      setIsFollowing(false);
      return;
    }

    const next = [...current, venueId];
    writeLocalVenueFollows(next);
    setIsFollowing(true);
  }

  if (!session) {
    return (
      <Link href="/login" className="followBtn" aria-label="Login to follow venue">
        Login
      </Link>
    );
  }

  if (session.role !== "user") {
    return (
      <button type="button" className="followBtn" disabled title="Switch to a user account to follow venues.">
        User only
      </button>
    );
  }

  return (
    <button
      type="button"
      className="followBtn"
      onClick={onToggleFollow}
      aria-pressed={isFollowing}
      title="Follow venue (local demo mode)"
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

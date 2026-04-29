"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { followVenue, listVenueFollows, unfollowVenue } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

type VenueFollowButtonProps = {
  venueId: string;
};

export function VenueFollowButton({ venueId }: VenueFollowButtonProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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

    async function loadFollowState(currentSession: AuthSession) {
      try {
        const follows = await listVenueFollows(currentSession);
        if (cancelled) return;
        setIsFollowing(follows.some((follow) => follow.venue_id === venueId));
      } catch {
        if (cancelled) return;
        setIsFollowing(false);
      }
    }

    if (!session || session.role !== "user") {
      setIsFollowing(false);
      return;
    }

    void loadFollowState(session);
    return () => {
      cancelled = true;
    };
  }, [session, venueId]);

  async function onToggleFollow() {
    setFeedback(null);
    if (!session || session.role !== "user") return;

    setIsPending(true);
    try {
      if (isFollowing) {
        await unfollowVenue(venueId, session);
        setIsFollowing(false);
        setFeedback("Venue unfollowed.");
      } else {
        await followVenue(venueId, session);
        setIsFollowing(true);
        setFeedback("Venue followed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update venue follow.";
      setFeedback(message);
    } finally {
      setIsPending(false);
    }
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
    <div style={{ display: "grid", gap: 4 }}>
      <button type="button" className="followBtn" onClick={onToggleFollow} aria-pressed={isFollowing} disabled={isPending}>
        {isPending ? "..." : isFollowing ? "Following" : "Follow"}
      </button>
      {feedback ? (
        <p className="meta" role="status" style={{ margin: 0, fontSize: 12 }}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

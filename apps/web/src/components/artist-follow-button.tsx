"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { followArtist, listFollows, unfollowArtist } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

type ArtistFollowButtonProps = {
  artistId: string;
};

export function ArtistFollowButton({ artistId }: ArtistFollowButtonProps) {
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
        const follows = await listFollows(currentSession);
        if (cancelled) return;
        setIsFollowing(follows.some((follow) => follow.artist_id === artistId));
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
  }, [artistId, session]);

  async function onToggleFollow() {
    if (!session || session.role !== "user") return;

    setFeedback(null);
    setIsPending(true);

    try {
      if (isFollowing) {
        await unfollowArtist(artistId, session);
        setIsFollowing(false);
        setFeedback("Artist unfollowed.");
      } else {
        await followArtist(artistId, session);
        setIsFollowing(true);
        setFeedback("Artist followed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update artist follow.";
      setFeedback(message);
    } finally {
      setIsPending(false);
    }
  }

  if (!session) {
    return (
      <Link href="/login" className="followBtn" aria-label="Login to follow artist">
        Login
      </Link>
    );
  }

  if (session.role !== "user") {
    return (
      <button type="button" className="followBtn" disabled title="Switch to a user account to follow artists.">
        User only
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button type="button" className="followBtn" onClick={onToggleFollow} disabled={isPending} aria-pressed={isFollowing}>
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

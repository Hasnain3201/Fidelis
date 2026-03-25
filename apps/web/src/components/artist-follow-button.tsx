"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { followArtist, listFollows, unfollowArtist } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

const LOCAL_ARTIST_FOLLOWS_KEY = "livey.local.artist-follows.v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readLocalArtistFollows(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_ARTIST_FOLLOWS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeLocalArtistFollows(nextIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_ARTIST_FOLLOWS_KEY, JSON.stringify(nextIds));
}

type ArtistFollowButtonProps = {
  artistId: string;
};

export function ArtistFollowButton({ artistId }: ArtistFollowButtonProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const usesBackendFollow = useMemo(() => UUID_PATTERN.test(artistId), [artistId]);

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
      if (usesBackendFollow) {
        try {
          const follows = await listFollows(currentSession);
          if (cancelled) return;
          setIsFollowing(follows.some((follow) => follow.artist_id === artistId));
          return;
        } catch {
          if (cancelled) return;
          setIsFollowing(false);
          return;
        }
      }

      const localFollows = readLocalArtistFollows();
      if (cancelled) return;
      setIsFollowing(localFollows.includes(artistId));
    }

    if (!session || session.role !== "user") {
      setIsFollowing(false);
      return;
    }

    void loadFollowState(session);

    return () => {
      cancelled = true;
    };
  }, [artistId, session, usesBackendFollow]);

  async function onToggleFollow() {
    if (!session || session.role !== "user") return;

    setIsPending(true);

    try {
      if (usesBackendFollow) {
        if (isFollowing) {
          await unfollowArtist(artistId, session);
          setIsFollowing(false);
        } else {
          await followArtist(artistId, session);
          setIsFollowing(true);
        }

        return;
      }

      const current = readLocalArtistFollows();

      if (current.includes(artistId)) {
        const next = current.filter((id) => id !== artistId);
        writeLocalArtistFollows(next);
        setIsFollowing(false);
      } else {
        const next = [...current, artistId];
        writeLocalArtistFollows(next);
        setIsFollowing(true);
      }
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
    <button
      type="button"
      className="followBtn"
      onClick={onToggleFollow}
      disabled={isPending}
      aria-pressed={isFollowing}
      title={usesBackendFollow ? "Follow artist" : "Follow artist (local demo mode)"}
    >
      {isPending ? "..." : isFollowing ? "Following" : "Follow"}
    </button>
  );
}

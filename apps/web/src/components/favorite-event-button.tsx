"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/api";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

type FavoriteEventButtonProps = {
  eventId: string;
  className?: string;
};

export function FavoriteEventButton({
  eventId,
  className = "pageActionLink secondary",
}: FavoriteEventButtonProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSaved, setIsSaved] = useState(false);
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

    async function loadFavoriteState(currentSession: AuthSession) {
      try {
        const favorites = await listFavorites(currentSession);
        if (cancelled) return;
        setIsSaved(favorites.some((favorite) => favorite.event_id === eventId));
      } catch {
        if (cancelled) return;
        setIsSaved(false);
      }
    }

    if (!session || session.role !== "user") {
      setIsSaved(false);
      return;
    }

    void loadFavoriteState(session);

    return () => {
      cancelled = true;
    };
  }, [eventId, session]);

  async function onToggleFavorite() {
    setFeedback(null);

    if (!session) return;

    if (session.role !== "user") {
      setFeedback("Favorites are available for user accounts.");
      return;
    }

    setIsPending(true);
    try {
      if (isSaved) {
        await removeFavorite(eventId, session);
        setIsSaved(false);
        setFeedback("Removed from favorites.");
      } else {
        await addFavorite(eventId, session);
        setIsSaved(true);
        setFeedback("Saved to favorites.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update favorites.";
      setFeedback(message);
    } finally {
      setIsPending(false);
    }
  }

  if (!session) {
    return (
      <Link href="/login" className={className}>
        Login to Save
      </Link>
    );
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button type="button" className={className} disabled={isPending} onClick={onToggleFavorite}>
        {isPending ? "Updating..." : isSaved ? "Saved • Remove" : "Save Event"}
      </button>
      {feedback ? (
        <p className="meta" role="status" style={{ margin: 0, fontSize: 12 }}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

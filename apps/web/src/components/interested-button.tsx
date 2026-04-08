"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

const INTERESTED_KEY = "livey.interested.events";

function getInterestedEvents(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(INTERESTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveInterestedEvents(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTERESTED_KEY, JSON.stringify([...ids]));
}

type InterestedButtonProps = {
  eventId: string;
  className?: string;
};

export function InterestedButton({ eventId, className = "pageActionLink secondary" }: InterestedButtonProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isInterested, setIsInterested] = useState(false);
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
    const interested = getInterestedEvents();
    setIsInterested(interested.has(eventId));
  }, [eventId]);

  function onToggle() {
    const interested = getInterestedEvents();
    if (isInterested) {
      interested.delete(eventId);
      setIsInterested(false);
      setFeedback("Removed from interested.");
    } else {
      interested.add(eventId);
      setIsInterested(true);
      setFeedback(session ? "Marked as interested!" : "Marked as interested! Sign up to get reminders.");
    }
    saveInterestedEvents(interested);
    setTimeout(() => setFeedback(null), 3000);
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button
        type="button"
        className={className}
        onClick={onToggle}
        style={{
          background: isInterested ? "#f3eeff" : undefined,
          borderColor: isInterested ? "#dccfff" : undefined,
          color: isInterested ? "#6942d6" : undefined,
        }}
        aria-pressed={isInterested}
      >
        {isInterested ? "⭐ Interested" : "☆ Interested"}
      </button>
      {feedback ? (
        <div style={{ display: "grid", gap: 4 }}>
          <p className="meta" role="status" style={{ margin: 0, fontSize: 12 }}>{feedback}</p>
          {!session && (
            <Link href="/register" style={{ fontSize: 12, color: "#7040ef", fontWeight: 700 }}>
              Create a free account →
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

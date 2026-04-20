"use client";

import { useEffect, useState } from "react";

const REMINDERS_KEY = "livey.event.reminders";

function getReminders(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "[]") as string[]; } catch { return []; }
}

function saveReminder(eventId: string) {
  const current = getReminders();
  if (!current.includes(eventId)) {
    current.push(eventId);
    try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(current)); } catch {}
  }
}

function removeReminder(eventId: string) {
  const current = getReminders().filter((id) => id !== eventId);
  try { localStorage.setItem(REMINDERS_KEY, JSON.stringify(current)); } catch {}
}

type EventReminderProps = {
  eventId: string;
  eventTitle: string;
};

export function EventReminder({ eventId, eventTitle }: EventReminderProps) {
  const [isSet, setIsSet] = useState(false);
  const [status, setStatus] = useState<"idle" | "asking" | "denied" | "set">("idle");

  useEffect(() => {
    setIsSet(getReminders().includes(eventId));
    if (getReminders().includes(eventId)) setStatus("set");
  }, [eventId]);

  async function handleClick() {
    if (isSet) {
      removeReminder(eventId);
      setIsSet(false);
      setStatus("idle");
      return;
    }

    setStatus("asking");

    if (!("Notification" in window)) {
      // Notifications not supported — save to local list anyway
      saveReminder(eventId);
      setIsSet(true);
      setStatus("set");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      saveReminder(eventId);
      setIsSet(true);
      setStatus("set");
      // Show a confirmation notification right away
      new Notification("Reminder set! 🎟", {
        body: `We'll remind you about "${eventTitle}"`,
        icon: "/favicon.ico",
      });
    } else if (permission === "denied") {
      setStatus("denied");
      // Still save locally
      saveReminder(eventId);
      setIsSet(true);
      setTimeout(() => setStatus("set"), 2000);
    } else {
      setStatus("idle");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13,
          fontWeight: 700,
          borderRadius: 10,
          padding: "9px 16px",
          background: isSet ? "#efffed" : "#f3eeff",
          color: isSet ? "#29a347" : "#6942d6",
          border: isSet ? "1px solid #b8f0c4" : "1px solid #dacfff",
          cursor: "pointer",
          transition: "all 0.2s",
          width: "100%",
          justifyContent: "center",
        }}
      >
        {status === "asking"
          ? "Setting reminder…"
          : isSet
          ? "✓ Reminder Set"
          : "🔔 Get Reminded"}
      </button>
      {status === "denied" && (
        <p className="meta" style={{ fontSize: 11, marginTop: 6, color: "#e88c1a" }}>
          Notifications blocked — reminder saved to your dashboard instead.
        </p>
      )}
      {isSet && status === "set" && (
        <p className="meta" style={{ fontSize: 11, marginTop: 6, color: "#29a347" }}>
          Reminder saved! Check your dashboard for upcoming events.
        </p>
      )}
    </div>
  );
}

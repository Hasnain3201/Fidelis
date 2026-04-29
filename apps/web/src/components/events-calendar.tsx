"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type FavoriteItem } from "@/lib/api";

type EventsCalendarProps = {
  favorites: FavoriteItem[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function EventsCalendar({ favorites }: EventsCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const eventsByDate = useMemo(() => {
    const map: Record<string, FavoriteItem[]> = {};
    for (const fav of favorites) {
      if (!fav.start_time) continue;
      const d = new Date(fav.start_time);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(fav);
    }
    return map;
  }, [favorites]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={prevMonth}
          style={{ border: "1px solid #e3e7f1", background: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}
        >
          ‹
        </button>
        <strong style={{ fontSize: 15, color: "#1c2334" }}>
          {MONTHS[viewMonth]} {viewYear}
        </strong>
        <button
          type="button"
          onClick={nextMonth}
          style={{ border: "1px solid #e3e7f1", background: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}
        >
          ›
        </button>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9aa3b8", padding: "4px 0" }}>
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const key = `${viewYear}-${viewMonth}-${day}`;
          const events = eventsByDate[key] ?? [];
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          const hasEvent = events.length > 0;

          return (
            <div
              key={key}
              style={{
                borderRadius: 8,
                padding: "6px 4px",
                textAlign: "center",
                background: isToday ? "linear-gradient(135deg, #8048ff, #6d35ea)" : hasEvent ? "#f3eeff" : "transparent",
                border: hasEvent && !isToday ? "1px solid #dccfff" : "1px solid transparent",
                position: "relative",
                minHeight: 38,
              }}
              title={events.map((e) => e.title).join(", ")}
            >
              <span style={{ fontSize: 12, fontWeight: isToday || hasEvent ? 700 : 400, color: isToday ? "#fff" : hasEvent ? "#6942d6" : "#4d5670" }}>
                {day}
              </span>
              {hasEvent && (
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2, flexWrap: "wrap" }}>
                  {events.slice(0, 2).map((e) => (
                    <Link key={e.event_id} href={`/events/${e.event_id}`}>
                      <span style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: isToday ? "#fff" : "#8048ff" }} title={e.title} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Events this month */}
      {Object.entries(eventsByDate)
        .filter(([key]) => {
          const [y, m] = key.split("-").map(Number);
          return y === viewYear && m === viewMonth;
        })
        .flatMap(([, evs]) => evs)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .map((fav) => (
          <Link key={fav.event_id} href={`/events/${fav.event_id}`} style={{ textDecoration: "none" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e2e7f3",
                background: "#f9fbff",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #f3eeff, #e9dfff)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                🎵
              </div>
              <div>
                <strong style={{ fontSize: 13, color: "#1c2334" }}>{fav.title}</strong>
                <p style={{ margin: 0, fontSize: 11, color: "#9aa3b8" }}>
                  {new Date(fav.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          </Link>
        ))}

      {!Object.entries(eventsByDate).some(([key]) => {
        const [y, m] = key.split("-").map(Number);
        return y === viewYear && m === viewMonth;
      }) && (
        <div className="emptyStateCard compact">
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>No saved events this month.</p>
        </div>
      )}
    </div>
  );
}

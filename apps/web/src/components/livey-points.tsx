"use client";

import { useEffect, useState } from "react";
import { getPoints, getPointsLog, getVipStatus, type PointsLogEntry } from "@/lib/points";

export function LiveyPointsBadge() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    setPoints(getPoints());
    function sync() { setPoints(getPoints()); }
    window.addEventListener("storage", sync);
    window.addEventListener("livey:points", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("livey:points", sync);
    };
  }, []);

  const status = getVipStatus(points);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 999,
        padding: "4px 10px",
        background: status.isVip ? "linear-gradient(135deg,#f5b942,#e88c1a)" : "#f3eeff",
        color: status.isVip ? "#fff" : "#6942d6",
        border: status.isVip ? "1px solid #e88c1a" : "1px solid #dacfff",
      }}
    >
      🎟 {points} pts
    </span>
  );
}

export function LiveyPointsCard() {
  const [points, setPoints] = useState(0);
  const [log, setLog] = useState<PointsLogEntry[]>([]);

  useEffect(() => {
    setPoints(getPoints());
    setLog(getPointsLog());
    function sync() {
      setPoints(getPoints());
      setLog(getPointsLog());
    }
    window.addEventListener("storage", sync);
    window.addEventListener("livey:points", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("livey:points", sync);
    };
  }, []);

  const status = getVipStatus(points);
  const progress = status.nextTier > 0 ? Math.min(100, Math.round((points / status.nextTier) * 100)) : 100;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid #e3e7f1",
        background: "#fff",
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🎟 Livey Points</h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "3px 10px",
            background: status.isVip ? "linear-gradient(135deg,#f5b942,#e88c1a)" : "#f3eeff",
            color: status.isVip ? "#fff" : "#6942d6",
            border: status.isVip ? "1px solid #e88c1a" : "1px solid #dacfff",
          }}
        >
          {status.label}
        </span>
      </div>

      <div style={{ fontSize: 36, fontWeight: 800, color: "#1c2334", marginBottom: 4 }}>{points}</div>
      <p className="meta" style={{ margin: "0 0 12px", fontSize: 13 }}>
        {status.nextTier > 0
          ? `${status.nextTier - points} points until ${status.nextTier >= 100 ? "⭐ VIP" : "next tier"}`
          : "You've reached the top tier!"}
      </p>

      {status.nextTier > 0 && (
        <div style={{ background: "#f0eeff", borderRadius: 999, height: 6, marginBottom: 16, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg,#8048ff,#6d35ea)",
              borderRadius: 999,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}

      <p className="meta" style={{ fontSize: 11, marginBottom: 8, color: "#888" }}>
        Earn points by saving events (+5), leaving reviews (+10), sharing (+3), marking interested (+2), inviting friends (+15)
      </p>

      {log.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          {log.slice(0, 5).map((entry, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                padding: "5px 8px",
                borderRadius: 7,
                background: "#f9fbff",
              }}
            >
              <span style={{ color: "#444" }}>{entry.label}</span>
              <span style={{ fontWeight: 700, color: "#6942d6" }}>+{entry.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

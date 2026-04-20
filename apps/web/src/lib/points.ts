// Livey Points System
// Points are stored in localStorage under key "livey.points"

const POINTS_KEY = "livey.points";
const POINTS_LOG_KEY = "livey.points.log";

export type PointsAction =
  | "save_event"
  | "review_event"
  | "share_event"
  | "interested_event"
  | "invite_friend";

export const POINTS_VALUES: Record<PointsAction, number> = {
  save_event: 5,
  review_event: 10,
  share_event: 3,
  interested_event: 2,
  invite_friend: 15,
};

export const POINTS_LABELS: Record<PointsAction, string> = {
  save_event: "Saved an event",
  review_event: "Left a review",
  share_event: "Shared an event",
  interested_event: "Marked Interested",
  invite_friend: "Invited a friend",
};

export type PointsLogEntry = {
  action: PointsAction;
  points: number;
  label: string;
  timestamp: string;
  ref?: string; // event id or other reference
};

export function getPoints(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(POINTS_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function getPointsLog(): PointsLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(POINTS_LOG_KEY) ?? "[]") as PointsLogEntry[];
  } catch {
    return [];
  }
}

export function awardPoints(action: PointsAction, ref?: string): number {
  if (typeof window === "undefined") return 0;
  const earned = POINTS_VALUES[action];
  const current = getPoints();
  const next = current + earned;
  try {
    localStorage.setItem(POINTS_KEY, String(next));
    const log = getPointsLog();
    log.unshift({
      action,
      points: earned,
      label: POINTS_LABELS[action],
      timestamp: new Date().toISOString(),
      ref,
    });
    localStorage.setItem(POINTS_LOG_KEY, JSON.stringify(log.slice(0, 50)));
  } catch {}
  return next;
}

export function getVipStatus(points: number): {
  isVip: boolean;
  tier: "bronze" | "silver" | "gold" | "vip" | null;
  label: string;
  nextTier: number;
} {
  if (points >= 100) return { isVip: true, tier: "vip", label: "⭐ VIP Insider", nextTier: 0 };
  if (points >= 50) return { isVip: true, tier: "gold", label: "🥇 Gold Member", nextTier: 100 };
  if (points >= 20) return { isVip: false, tier: "silver", label: "🥈 Silver Member", nextTier: 50 };
  if (points >= 5) return { isVip: false, tier: "bronze", label: "🥉 Bronze Member", nextTier: 20 };
  return { isVip: false, tier: null, label: "New Member", nextTier: 5 };
}

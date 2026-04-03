export type RecentlyViewedKind = "event" | "artist" | "venue";

export type RecentlyViewedEntry = {
  id: string;
  kind: RecentlyViewedKind;
  label: string;
  image: string;
  href: string;
  viewedAt: number;
};

const STORAGE_KEY = "livey.recentlyViewed.v1";
const MAX_ITEMS = 20;

export function readRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as RecentlyViewedEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          (item.kind === "event" || item.kind === "artist" || item.kind === "venue") &&
          typeof item.label === "string" &&
          typeof item.image === "string" &&
          typeof item.href === "string" &&
          typeof item.viewedAt === "number",
      )
      .sort((a, b) => b.viewedAt - a.viewedAt);
  } catch {
    return [];
  }
}

export function writeRecentlyViewed(entries: RecentlyViewedEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
}

export function pushRecentlyViewed(entry: Omit<RecentlyViewedEntry, "viewedAt">) {
  const current = readRecentlyViewed();
  const next: RecentlyViewedEntry[] = [
    { ...entry, viewedAt: Date.now() },
    ...current.filter((x) => !(x.kind === entry.kind && x.id === entry.id)),
  ].slice(0, MAX_ITEMS);

  writeRecentlyViewed(next);
}

export function removeRecentlyViewed(kind: RecentlyViewedKind, id: string): RecentlyViewedEntry[] {
  const current = readRecentlyViewed();
  const next = current.filter((item) => !(item.kind === kind && item.id === id));
  writeRecentlyViewed(next);
  return next;
}

export function clearRecentlyViewed() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
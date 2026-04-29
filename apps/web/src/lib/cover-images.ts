export type CoverEntityType = "artist" | "venue" | "event";
 
const FALLBACKS: Record<CoverEntityType, string> = {
  artist: "/placeholders/artist-placeholder.svg",
  venue: "/placeholders/venue-placeholder.svg",
  event: "/placeholders/event-placeholder.svg",
};
 
export function getCoverImage(
  coverImageUrl: string | null | undefined,
  type: CoverEntityType,
): string {
  const value = (coverImageUrl ?? "").trim();
  return value || FALLBACKS[type];
}
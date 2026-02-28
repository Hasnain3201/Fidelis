export type EventSummary = {
  id: string;
  title: string;
  venue_name: string;
  start_time: string;
  category: string;
  zip_code: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function searchEvents(zip: string, genre?: string): Promise<EventSummary[]> {
  const url = new URL("/api/v1/events/search", API_BASE);
  url.searchParams.set("zip_code", zip);
  if (genre && genre !== "all") {
    url.searchParams.set("genre", genre);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  return response.json();
}

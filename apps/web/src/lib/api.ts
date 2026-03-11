import type { AuthSession } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/auth";

export type EventSummary = {
  id: string;
  title: string;
  venue_name: string;
  start_time: string;
  category: string;
  zip_code: string;
};

export type EventSearchResponse = {
  items: EventSummary[];
  page: number;
  limit: number;
  total: number;
};

export type EventSearchSort = "recommended" | "dateSoonest" | "dateLatest";

export type EventSearchParams = {
  zip: string;
  genre?: string;
  query?: string;
  venue?: string;
  types?: string[];
  sort?: EventSearchSort;
  startAfter?: string;
  startBefore?: string;
  page?: number;
  limit?: number;
};

export type EventDetailResponse = {
  id: string;
  title: string;
  description: string;
  venue_name: string;
  category: string;
  start_time: string;
  end_time: string;
  zip_code: string;
  ticket_url?: string | null;
};

export type CreateVenueEventPayload = {
  title: string;
  description: string;
  category: string;
  start_time: string;
  end_time: string;
  zip_code: string;
  ticket_url?: string | null;
};

export type CreateVenueEventResponse = {
  id: string;
  status: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as { detail?: string; message?: string };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (typeof parsed.message === "string") return parsed.message;
    return `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, API_BASE);
  const response = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function searchEvents(zip: string, genre?: string): Promise<EventSearchResponse> {
  return searchEventsWithFilters({ zip, genre });
}

export async function searchEventsWithFilters(params: EventSearchParams): Promise<EventSearchResponse> {
  const url = new URL("/api/v1/events/search", API_BASE);
  url.searchParams.set("zip_code", params.zip);

  if (params.genre && params.genre !== "all") {
    url.searchParams.set("genre", params.genre);
  }
  if (params.query?.trim()) {
    url.searchParams.set("query", params.query.trim());
  }
  if (params.venue?.trim()) {
    url.searchParams.set("venue", params.venue.trim());
  }
  if (params.types?.length) {
    url.searchParams.set("types", params.types.join(","));
  }
  if (params.sort && params.sort !== "recommended") {
    url.searchParams.set("sort", params.sort);
  }
  if (params.startAfter) {
    url.searchParams.set("start_after", params.startAfter);
  }
  if (params.startBefore) {
    url.searchParams.set("start_before", params.startBefore);
  }
  if (params.page && params.page > 1) {
    url.searchParams.set("page", String(params.page));
  }
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as EventSearchResponse;
}

export async function getEventDetail(eventId: string): Promise<EventDetailResponse> {
  return fetchApi<EventDetailResponse>(`/api/v1/events/${eventId}`);
}

export async function createVenueEvent(
  payload: CreateVenueEventPayload,
  session: AuthSession,
): Promise<CreateVenueEventResponse> {
  return fetchApi<CreateVenueEventResponse>("/api/v1/venues/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

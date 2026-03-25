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
  categories?: string[];
  query?: string;
  venue?: string;
  city?: string;
  state?: string;
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

export type EventArtist = {
  id: string;
  stage_name: string;
  genre?: string | null;
  media_url?: string | null;
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

export type ProfileSummary = {
  id: string;
  role: "user" | "venue" | "artist" | "admin";
  display_name?: string | null;
  username?: string | null;
  home_zip?: string | null;
  city?: string | null;
  state?: string | null;
};

export type FavoriteItem = {
  event_id: string;
  created_at: string;
  title: string;
  start_time: string;
};

export type FollowItem = {
  artist_id: string;
  created_at: string;
  stage_name: string;
};

export type VenueProfileResponse = {
  id: string;
  name: string;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code: string;
  verified: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw error instanceof Error ? error : new Error("Network request failed.");
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as {
      detail?: string | { msg?: string } | Array<{ msg?: string; loc?: unknown[] }>;
      message?: string;
      error?: string;
    };

    if (typeof parsed.detail === "string") return parsed.detail;

    if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
      const first = parsed.detail[0];
      if (first && typeof first.msg === "string") return first.msg;
    }

    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;

    return `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function sortEventItems(items: EventSummary[], sort: EventSearchSort): EventSummary[] {
  if (sort === "recommended") return items;

  const sorted = [...items];
  sorted.sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    if (sort === "dateLatest") return bTime - aTime;
    return aTime - bTime;
  });

  return sorted;
}

type FetchApiInit = RequestInit & {
  session?: AuthSession;
};

async function fetchApi<T>(path: string, init?: FetchApiInit): Promise<T> {
  const { session, headers, ...requestInit } = init ?? {};

  const url = new URL(path, API_BASE);
  const mergedHeaders: HeadersInit = {
    ...(headers ?? {}),
    ...(session ? getAuthHeaders(session) : {}),
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), {
      ...requestInit,
      headers: mergedHeaders,
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function searchEvents(zip: string): Promise<EventSearchResponse> {
  return searchEventsWithFilters({ zip });
}

export async function searchEventsWithFilters(params: EventSearchParams): Promise<EventSearchResponse> {
  const url = new URL("/api/v1/events/search", API_BASE);
  url.searchParams.set("zip_code", params.zip);

  if (params.query?.trim()) {
    url.searchParams.set("query", params.query.trim());
  }

  if (params.venue?.trim()) {
    url.searchParams.set("venue", params.venue.trim());
  }

  if (params.city?.trim()) {
    url.searchParams.set("city", params.city.trim());
  }

  if (params.state?.trim()) {
    url.searchParams.set("state", params.state.trim());
  }

  for (const category of params.categories ?? []) {
    if (category.trim()) {
      url.searchParams.append("categories", category.trim());
    }
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

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as EventSearchResponse;

  if (params.sort) {
    payload.items = sortEventItems(payload.items, params.sort);
  }

  return payload;
}

export async function getEventDetail(eventId: string): Promise<EventDetailResponse> {
  return fetchApi<EventDetailResponse>(`/api/v1/events/${encodeURIComponent(eventId)}`);
}

export async function getEventArtists(eventId: string): Promise<EventArtist[]> {
  return fetchApi<EventArtist[]>(`/api/v1/events/${encodeURIComponent(eventId)}/artists`);
}

export async function createVenueEvent(
  payload: CreateVenueEventPayload,
  session: AuthSession,
): Promise<CreateVenueEventResponse> {
  return fetchApi<CreateVenueEventResponse>("/api/v1/venues/events", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getMyProfile(session: AuthSession): Promise<ProfileSummary> {
  return fetchApi<ProfileSummary>("/api/v1/profiles/me", { session });
}

export async function listFavorites(session: AuthSession): Promise<FavoriteItem[]> {
  return fetchApi<FavoriteItem[]>("/api/v1/favorites/", { session });
}

export async function addFavorite(eventId: string, session: AuthSession): Promise<FavoriteItem> {
  return fetchApi<FavoriteItem>("/api/v1/favorites/", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_id: eventId }),
  });
}

export async function removeFavorite(eventId: string, session: AuthSession): Promise<void> {
  await fetchApi<void>(`/api/v1/favorites/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    session,
  });
}

export async function listFollows(session: AuthSession): Promise<FollowItem[]> {
  return fetchApi<FollowItem[]>("/api/v1/follows/", { session });
}

export async function followArtist(artistId: string, session: AuthSession): Promise<FollowItem> {
  return fetchApi<FollowItem>("/api/v1/follows/", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ artist_id: artistId }),
  });
}

export async function unfollowArtist(artistId: string, session: AuthSession): Promise<void> {
  await fetchApi<void>(`/api/v1/follows/${encodeURIComponent(artistId)}`, {
    method: "DELETE",
    session,
  });
}

export async function getMyVenue(session: AuthSession): Promise<VenueProfileResponse> {
  return fetchApi<VenueProfileResponse>("/api/v1/venues/mine", { session });
}

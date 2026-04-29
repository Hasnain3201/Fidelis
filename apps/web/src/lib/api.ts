import type { AuthSession } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/auth";

export type EventSummary = {
  id: string;
  title: string;
  venue_name: string;
  start_time: string;
  category: string;
  zip_code?: string | null;
  is_promoted: boolean;
  cover_image_url?: string | null;
  price?: number | null;
};

export type EventSearchResponse = {
  items: EventSummary[];
  page: number;
  limit: number;
  total: number;
};

export type EventSearchSort = "recommended" | "dateSoonest" | "dateLatest";

export type EventSearchParams = {
  zip?: string;
  radiusMiles?: number;
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
  isPromoted?: boolean;
};

export type EventDetailResponse = {
  id: string;
  title: string;
  description: string;
  venue_name: string;
  category: string;
  start_time: string;
  end_time: string;
  zip_code?: string | null;
  ticket_url?: string | null;
  cover_image_url?: string | null;
  price?: number | null;
  age_requirement?: string | null;
  capacity?: number | null;
};

export type EventArtist = {
  id: string;
  stage_name: string;
  genre?: string | null;
  media_url?: string | null;
};

export type ArtistSummary = {
  id: string;
  stage_name: string;
  genre?: string | null;
  bio?: string | null;
  media_url?: string | null;
  cover_image_url?: string | null;
};

export type ArtistSearchResponse = {
  items: ArtistSummary[];
  page: number;
  limit: number;
  total: number;
};

export type ArtistSearchParams = {
  query?: string;
  genre?: string;
  page?: number;
  limit?: number;
};

export type ArtistDetailResponse = {
  id: string;
  stage_name: string;
  genre?: string | null;
  bio?: string | null;
  media_url?: string | null;
  cover_image_url?: string | null;
};

export type ArtistProfileResponse = {
  id: string;
  stage_name: string;
  genre?: string | null;
  bio?: string | null;
  media_url?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UpdateMyArtistPayload = {
  stage_name?: string;
  genre?: string | null;
  bio?: string | null;
  media_url?: string | null;
  cover_image_url?: string | null;
};

export type CreateMyArtistPayload = {
  stage_name: string;
  genre?: string | null;
  bio?: string | null;
  media_url?: string | null;
  cover_image_url?: string | null;
};

export type ArtistEventSummary = {
  id: string;
  title: string;
  start_time: string;
  venue_name?: string | null;
};

export type TrendingContentItem = {
  item_type: "event" | "artist";
  item_id: string;
  label: string;
  start_time?: string | null;
  category?: string | null;
  zip_code?: string | null;
  venue_name?: string | null;
  popularity_count: number;
};

export type VenueSummary = {
  id: string;
  name: string;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  verified: boolean;
  cover_image_url?: string | null;
};

export type VenueSearchResponse = {
  items: VenueSummary[];
  page: number;
  limit: number;
  total: number;
};

export type VenueSearchParams = {
  query?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  verified?: boolean;
  page?: number;
  limit?: number;
};

export type CreateVenueEventPayload = {
  title: string;
  description: string;
  category: string;
  start_time: string;
  end_time: string;
  zip_code: string;
  ticket_url?: string | null;
  cover_image_url?: string | null;
  price?: number | null;
  age_requirement?: string | null;
  capacity?: number | null;
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
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
  preferred_genres?: string[];
  preferred_event_types?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  max_distance_miles?: number | null;
  onboarding_completed_at?: string | null;
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

export type VenueFollowItem = {
  venue_id: string;
  created_at: string;
  venue_name: string;
};

export type VenueProfileResponse = {
  id: string;
  name: string;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  verified: boolean;
  cover_image_url?: string | null;
};

export type UpdateMyVenuePayload = {
  name?: string;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string;
  cover_image_url?: string | null;
};

export type CreateMyVenuePayload = {
  name: string;
  description?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code: string;
  cover_image_url?: string | null;
};

const DEFAULT_API_BASE = "https://fidelisappsapi-production.up.railway.app";
const CONFIGURED_API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE;
const REQUEST_TIMEOUT_MS = 10000;

function normalizeApiBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function isLocalApiBase(base: string): boolean {
  try {
    const hostname = new URL(base).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}

const API_BASES = Array.from(
  new Set([
    normalizeApiBase(CONFIGURED_API_BASE),
    ...(!isLocalApiBase(CONFIGURED_API_BASE) ? [DEFAULT_API_BASE] : []),
  ]),
);
const API_BASE = API_BASES[0];

function formatApiBaseList(): string {
  return API_BASES.join(" or ");
}

function shouldTryNextApiBase(status: number, message: string): boolean {
  return status === 404 && message.toLowerCase().includes("application not found");
}

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

async function fetchFromApiBases(
  buildUrl: (base: string) => URL,
  init?: RequestInit,
): Promise<Response> {
  let lastMessage = "Network request failed.";

  for (let index = 0; index < API_BASES.length; index += 1) {
    const base = API_BASES[index];
    const url = buildUrl(base);

    let response: Response;
    try {
      response = await fetchWithTimeout(url.toString(), {
        ...init,
        cache: init?.cache ?? "no-store",
      });
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Network request failed.";
      if (index < API_BASES.length - 1) continue;
      break;
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      lastMessage = message;
      if (index < API_BASES.length - 1 && shouldTryNextApiBase(response.status, message)) {
        continue;
      }
      throw new Error(message);
    }

    return response;
  }

  throw new Error(`${lastMessage} Confirm the API is running at ${formatApiBaseList()}.`);
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

  const mergedHeaders: HeadersInit = {
    ...(headers ?? {}),
    ...(session ? getAuthHeaders(session) : {}),
  };

  const response = await fetchFromApiBases((base) => new URL(path, base), {
    ...requestInit,
    headers: mergedHeaders,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function searchEvents(zip: string): Promise<EventSearchResponse> {
  return searchEventsWithFilters({ zip });
}

export async function searchEventsWithFilters(params: EventSearchParams): Promise<EventSearchResponse> {
  const buildSearchUrl = (base: string) => {
    const url = new URL("/api/v1/events/search", base);

    const zip = params.zip?.trim();
    if (zip) {
      url.searchParams.set("zip_code", zip);
    }

  if (typeof params.radiusMiles === "number" && params.radiusMiles > 0) {
    url.searchParams.set("radius_miles", String(params.radiusMiles));
  }

    if (params.query?.trim()) url.searchParams.set("query", params.query.trim());
    if (params.venue?.trim()) url.searchParams.set("venue", params.venue.trim());
    if (params.city?.trim()) url.searchParams.set("city", params.city.trim());
    if (params.state?.trim()) url.searchParams.set("state", params.state.trim());

    for (const category of params.categories ?? []) {
      if (category.trim()) url.searchParams.append("categories", category.trim());
    }

    if (params.startAfter) url.searchParams.set("start_after", params.startAfter);
    if (params.startBefore) url.searchParams.set("start_before", params.startBefore);
    if (params.page && params.page > 1) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));

    return url;
  };

  const response = await fetchFromApiBases(buildSearchUrl);

  const payload = (await response.json()) as EventSearchResponse;
  if (params.sort) payload.items = sortEventItems(payload.items, params.sort);
  return payload;
}

export async function getEventDetail(eventId: string): Promise<EventDetailResponse> {
  return fetchApi<EventDetailResponse>(`/api/v1/events/${encodeURIComponent(eventId)}`);
}

export async function getEventArtists(eventId: string): Promise<EventArtist[]> {
  return fetchApi<EventArtist[]>(`/api/v1/events/${encodeURIComponent(eventId)}/artists`);
}

export async function listArtists(params?: { query?: string; genre?: string; limit?: number }): Promise<ArtistSummary[]> {
  const url = new URL("/api/v1/artists/", API_BASE);
  if (params?.query?.trim()) url.searchParams.set("query", params.query.trim());
  if (params?.genre?.trim()) url.searchParams.set("genre", params.genre.trim());
  if (params?.limit) url.searchParams.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as ArtistSummary[];
}

export async function searchArtistsWithFilters(
  params: ArtistSearchParams,
): Promise<ArtistSearchResponse> {
  const url = new URL("/api/v1/artists/search", API_BASE);
  if (params.query?.trim()) url.searchParams.set("query", params.query.trim());
  if (params.genre?.trim()) url.searchParams.set("genre", params.genre.trim());
  if (params.page && params.page > 1) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as ArtistSearchResponse;
}

export async function getPopularArtists(limit = 20): Promise<ArtistSummary[]> {
  const url = new URL("/api/v1/artists/popular", API_BASE);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as ArtistSummary[];
}

export async function getRecommendedArtists(
  session: AuthSession,
  limit = 20,
): Promise<ArtistSummary[]> {
  return fetchApi<ArtistSummary[]>(`/api/v1/artists/recommended?limit=${limit}`, { session });
}

export async function getTrendingContent(limit = 10): Promise<TrendingContentItem[]> {
  const url = new URL("/api/v1/events/trending/content", API_BASE);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as TrendingContentItem[];
}

export async function listVenues(params?: {
  query?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  limit?: number;
}): Promise<VenueSummary[]> {
  const url = new URL("/api/v1/venues/", API_BASE);
  if (params?.query?.trim()) url.searchParams.set("query", params.query.trim());
  if (params?.city?.trim()) url.searchParams.set("city", params.city.trim());
  if (params?.state?.trim()) url.searchParams.set("state", params.state.trim());
  if (params?.zip_code?.trim()) url.searchParams.set("zip_code", params.zip_code.trim());
  if (params?.limit) url.searchParams.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSummary[];
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

export async function searchVenuesWithFilters(
  params: VenueSearchParams,
): Promise<VenueSearchResponse> {
  const url = new URL("/api/v1/venues/search", API_BASE);

  if (params.query?.trim()) url.searchParams.set("query", params.query.trim());
  if (params.city?.trim()) url.searchParams.set("city", params.city.trim());
  if (params.state?.trim()) url.searchParams.set("state", params.state.trim().toUpperCase());
  if (params.zip_code?.trim()) url.searchParams.set("zip_code", params.zip_code.trim());
  if (typeof params.verified === "boolean") {
    url.searchParams.set("verified", String(params.verified));
  }
  if (params.page && params.page > 1) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }

  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSearchResponse;
}

export async function getPopularVenues(limit = 20): Promise<VenueSummary[]> {
  const url = new URL("/api/v1/venues/popular", API_BASE);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetchWithTimeout(url.toString(), { cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new Error(`${message} Confirm the API is running at ${API_BASE}.`);
  }
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as VenueSummary[];
}

export async function getRecommendedVenues(
  session: AuthSession,
  limit = 20,
): Promise<VenueSummary[]> {
  return fetchApi<VenueSummary[]>(`/api/v1/venues/recommended?limit=${limit}`, { session });
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

export async function listVenueFollows(session: AuthSession): Promise<VenueFollowItem[]> {
  return fetchApi<VenueFollowItem[]>("/api/v1/follows/venues", { session });
}

export async function followVenue(venueId: string, session: AuthSession): Promise<VenueFollowItem> {
  return fetchApi<VenueFollowItem>("/api/v1/follows/venues", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ venue_id: venueId }),
  });
}

export async function unfollowVenue(venueId: string, session: AuthSession): Promise<void> {
  await fetchApi<void>(`/api/v1/follows/venues/${encodeURIComponent(venueId)}`, {
    method: "DELETE",
    session,
  });
}

export async function getMyVenue(session: AuthSession): Promise<VenueProfileResponse> {
  return fetchApi<VenueProfileResponse>("/api/v1/venues/mine", { session });
}

export async function createMyVenue(
  payload: CreateMyVenuePayload,
  session: AuthSession,
): Promise<VenueProfileResponse> {
  return fetchApi<VenueProfileResponse>("/api/v1/venues/mine", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateMyVenue(
  payload: UpdateMyVenuePayload,
  session: AuthSession,
): Promise<VenueProfileResponse> {
  return fetchApi<VenueProfileResponse>("/api/v1/venues/mine", {
    method: "PATCH",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getMyArtist(session: AuthSession): Promise<ArtistProfileResponse> {
  return fetchApi<ArtistProfileResponse>("/api/v1/artists/mine", { session });
}

export async function createMyArtist(
  payload: CreateMyArtistPayload,
  session: AuthSession,
): Promise<ArtistProfileResponse> {
  return fetchApi<ArtistProfileResponse>("/api/v1/artists/mine", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateMyArtist(
  payload: UpdateMyArtistPayload,
  session: AuthSession,
): Promise<ArtistProfileResponse> {
  return fetchApi<ArtistProfileResponse>("/api/v1/artists/mine", {
    method: "PATCH",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function listMyVenueEvents(session: AuthSession, limit = 50): Promise<EventSummary[]> {
  return fetchApi<EventSummary[]>(`/api/v1/venues/mine/events?limit=${limit}`, { session });
}

export type UpdateMyPreferencesPayload = {
  preferredGenres?: string[];
  preferredEventTypes?: string[];
  budgetMin?: number;
  budgetMax?: number;
  maxDistanceMiles?: number;
  markOnboardingComplete?: boolean;
};

export async function updateMyPreferences(
  session: AuthSession,
  payload: UpdateMyPreferencesPayload,
): Promise<ProfileSummary> {
  return fetchApi<ProfileSummary>("/api/v1/profiles/me/preferences", {
    method: "PATCH",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      preferred_genres: payload.preferredGenres,
      preferred_event_types: payload.preferredEventTypes,
      budget_min: payload.budgetMin,
      budget_max: payload.budgetMax,
      max_distance_miles: payload.maxDistanceMiles,
      mark_onboarding_complete: Boolean(payload.markOnboardingComplete),
    }),
  });
}

export async function getVenueDetail(venueId: string): Promise<VenueProfileResponse> {
  return fetchApi<VenueProfileResponse>(`/api/v1/venues/${encodeURIComponent(venueId)}`);
}

export async function getVenueEvents(venueId: string, limit = 50): Promise<EventSummary[]> {
  return fetchApi<EventSummary[]>(
    `/api/v1/venues/${encodeURIComponent(venueId)}/events?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function getArtistDetail(artistId: string): Promise<ArtistDetailResponse> {
  return fetchApi<ArtistDetailResponse>(`/api/v1/artists/${encodeURIComponent(artistId)}`);
}

export async function getArtistEvents(artistId: string): Promise<ArtistEventSummary[]> {
  return fetchApi<ArtistEventSummary[]>(`/api/v1/artists/${encodeURIComponent(artistId)}/events`);
}

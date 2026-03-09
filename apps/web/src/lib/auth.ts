export type UserRole = "user" | "venue" | "artist" | "admin";

export type AuthSession = {
  accessToken: string;
  expiresAtMs: number;
  userId: string;
  role: UserRole;
  email?: string;
};

type SupabaseTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: {
    id?: string;
    email?: string;
  };
};

type SupabaseSignUpResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
  };
};

type SignUpResult = {
  session: AuthSession | null;
  requiresEmailVerification: boolean;
};

const AUTH_STORAGE_KEY = "livey.auth.session.v1";
const AUTH_CHANGE_EVENT = "livey-auth-changed";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, "=");
    const payload = atob(padded);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toUserRole(value: string | undefined): UserRole {
  if (value === "venue" || value === "artist" || value === "admin") return value;
  return "user";
}

function getUserIdFromToken(token: string, fallbackId?: string): string | null {
  const payload = parseJwtPayload(token);
  const sub = payload?.sub;
  if (typeof sub === "string" && sub) return sub;
  if (fallbackId) return fallbackId;
  return null;
}

async function getJsonOrThrow<T>(response: Response): Promise<T> {
  const bodyText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "msg" in parsed &&
      typeof (parsed as { msg?: unknown }).msg === "string"
        ? (parsed as { msg: string }).msg
        : typeof parsed === "object" &&
            parsed !== null &&
            "error_description" in parsed &&
            typeof (parsed as { error_description?: unknown }).error_description === "string"
          ? (parsed as { error_description: string }).error_description
          : typeof parsed === "object" &&
              parsed !== null &&
              "detail" in parsed &&
              typeof (parsed as { detail?: unknown }).detail === "string"
            ? (parsed as { detail: string }).detail
            : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

async function resolveUserRole(userId: string, accessToken: string): Promise<UserRole> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-User-Id": userId,
      },
      cache: "no-store",
    });
    const profile = await getJsonOrThrow<{ role?: string }>(response);
    return toUserRole(profile.role);
  } catch {
    return "user";
  }
}

function toSession(payload: SupabaseTokenResponse, role: UserRole): AuthSession {
  const userId = getUserIdFromToken(payload.access_token, payload.user?.id);
  if (!userId) {
    throw new Error("Unable to resolve authenticated user id from JWT.");
  }

  return {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + Math.max(payload.expires_in, 1) * 1000,
    userId,
    role,
    email: payload.user?.email,
  };
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  emitAuthChange();
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChange();
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAtMs !== "number" ||
      typeof parsed.userId !== "string"
    ) {
      clearAuthSession();
      return null;
    }

    if (parsed.expiresAtMs <= Date.now()) {
      clearAuthSession();
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      expiresAtMs: parsed.expiresAtMs,
      userId: parsed.userId,
      role: toUserRole(parsed.role),
      email: typeof parsed.email === "string" ? parsed.email : undefined,
    };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAuthChangeEventName(): string {
  return AUTH_CHANGE_EVENT;
}

export function getAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.accessToken}`,
    "X-User-Id": session.userId,
    "X-User-Role": session.role,
  };
}

export async function signInWithSupabase(email: string, password: string): Promise<AuthSession> {
  assertSupabaseConfigured();

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await getJsonOrThrow<SupabaseTokenResponse>(response);
  const userId = getUserIdFromToken(payload.access_token, payload.user?.id);
  if (!userId) {
    throw new Error("Supabase did not return a valid user id.");
  }

  const resolvedRole = await resolveUserRole(userId, payload.access_token);
  return toSession(payload, resolvedRole);
}

export async function signUpWithSupabase(
  fullName: string,
  email: string,
  password: string,
  requestedRole: UserRole,
): Promise<SignUpResult> {
  const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      role: requestedRole,
    }),
  });

  await getJsonOrThrow<{ status: string; user_id?: string; email?: string }>(response);

  return {
    session: null,
    requiresEmailVerification: false,
  };
}

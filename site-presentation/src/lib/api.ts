// Thin fetch wrapper around the FastAPI backend, plus the auth gate helpers.
//
// The internal tool has two users (CDC), and the backend uses HTTP Basic. We
// store the base64 `user:pass` token client-side and attach it to API calls.
// Fine for a two-person internal console; revisit if the user base ever grows.
//
// The console is served by this site under /dce but calls the API on its own
// origin, so NEXT_PUBLIC_API_URL must point at the backend service (and that
// origin must be allowed by the backend's CORS_ALLOW_ORIGINS).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "publique_auth";

export type ReadyStatus = {
  status: "ok" | "degraded";
  checks: Record<string, string>;
};

// --- token storage -------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Basic ${token}` } : {};
}

// --- auth ----------------------------------------------------------------

/** Verify credentials against the backend; on success, persist the token. */
export async function login(user: string, password: string): Promise<string> {
  const token = btoa(`${user}:${password}`);
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Basic ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Identifiants invalides.");
  if (!res.ok) throw new Error(`Erreur backend (${res.status}).`);
  const data = (await res.json()) as { user: string };
  setToken(token);
  return data.user;
}

/** Return the current user, or throw if the stored token is missing/invalid. */
export async function getMe(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("unauthorized");
  const data = (await res.json()) as { user: string };
  return data.user;
}

// --- health (unauthenticated) --------------------------------------------

export async function getReady(): Promise<ReadyStatus> {
  const res = await fetch(`${API_URL}/ready`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Backend /ready returned ${res.status}`);
  }
  return res.json();
}

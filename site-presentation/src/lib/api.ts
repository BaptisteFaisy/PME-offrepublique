// Client-side helpers for the internal console auth.
//
// Auth is handled entirely by this web app via same-origin route handlers under
// /dce/api (see src/app/dce/api and src/lib/auth.ts) — no external backend, no
// CORS. The session lives in an httpOnly cookie the browser sends automatically,
// so there is nothing to store client-side.

/** Verify credentials; on success the server sets the session cookie. */
export async function login(user: string, password: string): Promise<string> {
  const res = await fetch("/dce/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, password }),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Identifiants invalides.");
  if (!res.ok) throw new Error(`Erreur (${res.status}).`);
  const data = (await res.json()) as { user: string };
  return data.user;
}

/** Return the current user, or throw if there is no valid session. */
export async function getMe(): Promise<string> {
  const res = await fetch("/dce/api/me", { cache: "no-store" });
  if (!res.ok) throw new Error("unauthorized");
  const data = (await res.json()) as { user: string };
  return data.user;
}

/** Clear the session cookie. */
export async function logout(): Promise<void> {
  await fetch("/dce/api/logout", { method: "POST", cache: "no-store" });
}

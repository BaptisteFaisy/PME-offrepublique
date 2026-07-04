// Server-only auth helpers for the internal console (/dce).
//
// The console is fully self-contained in this web app: credentials are checked
// here (Node runtime, server side) against the DCE_AUTH_USERS env var — no
// external backend, no CORS. The session is an httpOnly cookie holding the
// base64 user:pass, re-validated against the env on every request (so a forged
// cookie is worthless without a real credential). Fine for a 2-user internal
// tool; swap for sessions/OAuth if the user base ever grows.
//
// NOTE: only imported by server route handlers under /dce/api — never by client
// components — so it is never shipped to the browser.

import { timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "dce_auth";

/** Parse DCE_AUTH_USERS ("user:pass,user:pass") into a {user -> pass} map. */
function parseUsers(): Map<string, string> {
  let raw = process.env.DCE_AUTH_USERS ?? "";
  // Dev convenience only: never applies in production (Railway sets NODE_ENV).
  if (!raw && process.env.NODE_ENV !== "production") {
    raw = "baptiste:changeme";
  }
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const p = pair.trim();
    const i = p.indexOf(":");
    if (i <= 0) continue;
    map.set(p.slice(0, i).trim(), p.slice(i + 1));
  }
  return map;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyCredentials(user: string, password: string): boolean {
  if (!user || !password) return false;
  const expected = parseUsers().get(user);
  return expected !== undefined && safeEqual(expected, password);
}

export function encodeToken(user: string, password: string): string {
  return Buffer.from(`${user}:${password}`).toString("base64");
}

/** Decode a session cookie and re-validate it against the env; null if invalid. */
export function userFromToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i <= 0) return null;
    const user = decoded.slice(0, i);
    const password = decoded.slice(i + 1);
    return verifyCredentials(user, password) ? user : null;
  } catch {
    return null;
  }
}

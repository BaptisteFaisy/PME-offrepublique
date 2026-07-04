// Server-only proxy helpers for the internal console (/dce).
//
// The browser never talks to the FastAPI backend directly: it calls same-origin
// route handlers under /dce/api, which (1) verify the console session cookie and
// (2) forward the request to the backend with a service Basic-auth credential
// held only on the server. This keeps backend credentials out of the browser and
// sidesteps CORS entirely (server-to-server fetch is not subject to it).
//
// NOTE: imported only by server route handlers under /dce/api — never by client
// components — so it is never shipped to the browser.

import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, userFromToken } from "@/lib/auth";

/** Base URL of the FastAPI backend (no trailing slash). */
export function backendBase(): string {
  const raw = process.env.DCE_BACKEND_URL ?? "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

/** The Basic-auth header the proxy uses to authenticate to the backend. */
export function backendAuthHeader(): string {
  const user = process.env.DCE_BACKEND_USER ?? "baptiste";
  const pass = process.env.DCE_BACKEND_PASSWORD ?? "changeme";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

/** Resolve the authenticated console user from the request, or null. */
export function consoleUser(req: NextRequest): string | null {
  return userFromToken(req.cookies.get(AUTH_COOKIE)?.value);
}

/** 401 for a missing/invalid console session. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** 502 when the backend can't be reached (service down, wrong URL). */
function backendDown(): NextResponse {
  return NextResponse.json(
    {
      detail:
        "Service d'analyse injoignable. Vérifiez que le backend FastAPI est démarré (docker compose up).",
    },
    { status: 502 },
  );
}

/** Mirror a backend Response back to the browser, preserving status + body. */
async function mirror(res: Response): Promise<NextResponse> {
  const contentType = res.headers.get("content-type") ?? "application/json";
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

/** GET a backend path (auth-gated) and passthrough the response. */
export async function proxyGet(req: NextRequest, path: string): Promise<NextResponse> {
  if (!consoleUser(req)) return unauthorized();
  try {
    const res = await fetch(`${backendBase()}${path}`, {
      headers: { Authorization: backendAuthHeader() },
      cache: "no-store",
    });
    return mirror(res);
  } catch {
    return backendDown();
  }
}

/** POST a body (e.g. multipart FormData) to a backend path, auth-gated. */
export async function proxyPost(
  req: NextRequest,
  path: string,
  body: BodyInit,
): Promise<NextResponse> {
  if (!consoleUser(req)) return unauthorized();
  try {
    const res = await fetch(`${backendBase()}${path}`, {
      method: "POST",
      // No explicit Content-Type: fetch sets it (with the multipart boundary)
      // from the FormData body.
      headers: { Authorization: backendAuthHeader() },
      body,
      cache: "no-store",
    });
    return mirror(res);
  } catch {
    return backendDown();
  }
}

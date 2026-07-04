// Session gate for the M1 route handlers (server-only).
//
// Every /dce/api/uploads/* handler is gated on the console session cookie the
// web app issues (src/lib/auth.ts) — same self-contained auth as the rest of the
// console, no external service.

import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, userFromToken } from "@/lib/auth";

export function consoleUser(req: NextRequest): string | null {
  return userFromToken(req.cookies.get(AUTH_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

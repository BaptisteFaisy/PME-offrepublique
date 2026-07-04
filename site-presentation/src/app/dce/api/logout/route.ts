import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Expire the session cookie.
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    path: "/dce",
    maxAge: 0,
  });
  return res;
}

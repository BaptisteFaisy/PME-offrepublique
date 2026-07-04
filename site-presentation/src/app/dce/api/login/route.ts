import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, encodeToken, verifyCredentials } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { user?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const user = (body.user ?? "").trim();
  const password = body.password ?? "";

  if (!verifyCredentials(user, password)) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ user });
  res.cookies.set(AUTH_COOKIE, encodeToken(user, password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/dce",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

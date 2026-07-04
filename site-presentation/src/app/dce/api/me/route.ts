import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, userFromToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = userFromToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

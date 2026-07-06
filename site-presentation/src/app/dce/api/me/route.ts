import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, userFromToken } from "@/lib/auth";
import { getSettings } from "@/lib/dce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = userFromToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Display-only label of the Codex account powering the LLM backend.
  return NextResponse.json({ user, codexAccount: getSettings().codexAccount });
}

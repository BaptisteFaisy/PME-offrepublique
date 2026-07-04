import { NextRequest, NextResponse } from "next/server";

import { consoleUser, unauthorized } from "@/lib/dce/guard";
import { getUpload } from "@/lib/dce/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id] — upload lifecycle status (received/processing/ready/failed).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!consoleUser(req)) return unauthorized();
  const { id } = await ctx.params;
  const rec = await getUpload(id);
  if (!rec) return NextResponse.json({ detail: "Upload introuvable" }, { status: 404 });
  return NextResponse.json({
    id: rec.id,
    original_filename: rec.original_filename,
    status: rec.status,
    error: rec.error,
    created_at: rec.created_at,
  });
}

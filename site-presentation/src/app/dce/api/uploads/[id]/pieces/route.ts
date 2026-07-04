import { NextRequest, NextResponse } from "next/server";

import { consoleUser, unauthorized } from "@/lib/dce/guard";
import { getUpload } from "@/lib/dce/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id]/pieces — the classified pieces of the DCE.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!consoleUser(req)) return unauthorized();
  const { id } = await ctx.params;
  const rec = await getUpload(id);
  if (!rec) return NextResponse.json({ detail: "Upload introuvable" }, { status: 404 });
  return NextResponse.json(
    rec.pieces.map((p) => ({
      id: p.id,
      filename: p.filename,
      piece_type: p.piece_type,
      page_count: p.page_count,
    })),
  );
}

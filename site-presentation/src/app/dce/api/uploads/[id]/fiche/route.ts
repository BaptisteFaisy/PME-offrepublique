import { NextRequest, NextResponse } from "next/server";

import { consoleUser, unauthorized } from "@/lib/dce/guard";
import { getUpload } from "@/lib/dce/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id]/fiche — the structured Fiche AO + go/no-go.
// Returns 409 while the pipeline is still running.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!consoleUser(req)) return unauthorized();
  const { id } = await ctx.params;
  const rec = await getUpload(id);
  if (!rec) return NextResponse.json({ detail: "Upload introuvable" }, { status: 404 });
  if (!rec.fiche) {
    return NextResponse.json(
      { detail: `Fiche AO pas encore disponible (statut: ${rec.status}).` },
      { status: 409 },
    );
  }
  return NextResponse.json({
    upload_id: rec.id,
    status: rec.status,
    fiche: rec.fiche.fiche,
    gonogo: rec.fiche.gonogo,
    warnings: rec.fiche.warnings ?? [],
    model: rec.fiche.model,
  });
}

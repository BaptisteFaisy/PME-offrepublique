import { NextRequest } from "next/server";

import { proxyGet } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id]/pieces/[pieceId]/pages/[page] — the exact page text a
// Fiche AO field points to. This is the click-through target that makes every
// extracted value verifiable at its source (CDC §6 traceability).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; pieceId: string; page: string }> },
) {
  const { id, pieceId, page } = await ctx.params;
  return proxyGet(
    req,
    `/dce/${encodeURIComponent(id)}/pieces/${encodeURIComponent(pieceId)}/pages/${encodeURIComponent(page)}`,
  );
}

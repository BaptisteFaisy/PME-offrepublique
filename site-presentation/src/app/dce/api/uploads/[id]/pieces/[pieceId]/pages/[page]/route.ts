import { NextRequest, NextResponse } from "next/server";

import { consoleUser, unauthorized } from "@/lib/dce/guard";
import { getUpload } from "@/lib/dce/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id]/pieces/[pieceId]/pages/[page] — the exact page text a
// Fiche AO field points to. This is the click-through target that makes every
// extracted value verifiable at its source (CDC §6 traceability).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; pieceId: string; page: string }> },
) {
  if (!consoleUser(req)) return unauthorized();
  const { id, pieceId, page } = await ctx.params;
  const rec = await getUpload(id);
  if (!rec) return NextResponse.json({ detail: "Upload introuvable" }, { status: 404 });

  const piece = rec.pieces.find((p) => p.id === pieceId);
  if (!piece) return NextResponse.json({ detail: "Pièce introuvable" }, { status: 404 });

  const pageNumber = Number(page);
  const pageText = piece.pages.find((p) => p.page_number === pageNumber);
  if (!pageText) return NextResponse.json({ detail: "Page introuvable" }, { status: 404 });

  return NextResponse.json({
    piece_id: piece.id,
    page_number: pageText.page_number,
    text: pageText.text,
    ocr_used: pageText.ocr_used,
  });
}

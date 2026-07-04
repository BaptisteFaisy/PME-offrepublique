import { NextRequest } from "next/server";

import { proxyGet } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /dce/api/uploads/[id] — upload lifecycle status (received/processing/ready/failed).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyGet(req, `/dce/${encodeURIComponent(id)}`);
}

import { NextRequest } from "next/server";

import { proxyKbRequest } from "@/lib/kb/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Context) {
  const { path } = await ctx.params;
  return proxyKbRequest(req, path ?? []);
}

export async function GET(req: NextRequest, ctx: Context) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: Context) {
  return proxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: Context) {
  return proxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Context) {
  return proxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Context) {
  return proxy(req, ctx);
}

// Server-only proxy helpers for the M2 KB API.

import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE, userFromToken } from "@/lib/auth";

export const KB_BACKEND_URL =
  process.env.KB_API_BASE_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export async function proxyKbRequest(
  req: NextRequest,
  segments: string[],
): Promise<NextResponse> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!userFromToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = new URL(`/kb/${segments.map(encodeURIComponent).join("/")}`, KB_BACKEND_URL);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "cookie") {
      headers.set(key, value);
    }
  });
  headers.set("authorization", `Basic ${token}`);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower)) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

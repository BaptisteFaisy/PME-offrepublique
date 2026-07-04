import { NextRequest, NextResponse } from "next/server";

import { consoleUser, proxyPost, unauthorized } from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /dce/api/uploads — accept the DCE upload and forward it to the backend
// (POST /dce), which stores it and enqueues the M1 parse job.
export async function POST(req: NextRequest) {
  if (!consoleUser(req)) return unauthorized();

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return NextResponse.json({ detail: "Requête invalide (multipart attendu)." }, { status: 400 });
  }

  const file = inForm.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "Champ 'file' manquant." }, { status: 400 });
  }

  // Rebuild a clean FormData so fetch sets the multipart boundary itself.
  const outForm = new FormData();
  outForm.append("file", file, file.name);

  return proxyPost(req, "/dce", outForm);
}

import { NextRequest, NextResponse } from "next/server";

import { consoleUser, unauthorized } from "@/lib/dce/guard";
import { startProcessing } from "@/lib/dce/pipeline";
import { createUpload, newId, saveRaw } from "@/lib/dce/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = [".zip", ".pdf", ".docx", ".xlsx"];

// POST /dce/api/uploads — accept the DCE upload, store it, and kick off the M1
// parse job in the background. The client polls the status endpoint until ready.
export async function POST(req: NextRequest) {
  if (!consoleUser(req)) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ detail: "Requête invalide (multipart attendu)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "Champ 'file' manquant." }, { status: 400 });
  }

  const name = file.name || "upload.bin";
  if (!ALLOWED.some((s) => name.toLowerCase().endsWith(s))) {
    return NextResponse.json(
      { detail: `Format non supporté. Attendu: ${ALLOWED.join(", ")}` },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ detail: "Fichier vide" }, { status: 400 });
  }

  const id = newId();
  await saveRaw(id, buf);
  await createUpload(id, name);
  startProcessing(id);

  return NextResponse.json({ upload_id: id, status: "received", job_id: id }, { status: 202 });
}

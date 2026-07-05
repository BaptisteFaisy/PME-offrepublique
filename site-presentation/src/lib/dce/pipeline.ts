// M1 ingestion pipeline orchestrator (server-only).
//
// processUpload runs the pipeline end to end for one upload: read raw ->
// unzip+dedup -> extract text (page-anchored) -> classify -> Fiche AO (2 LLM
// passes) -> go/no-go, persisting the result to the store. It runs in the
// background (fired, not awaited, from the upload route); the client polls the
// upload status until it is "ready" or "failed".

import { classifyPiece } from "./classify";
import { getSettings, type DceSettings } from "./config";
import { extractText } from "./extract";
import { buildCorpus, extractFiche, type CorpusPiece } from "./fiche";
import { evaluate } from "./gonogo";
import { resolveAgent, resolveIntensity } from "./options";
import {
  getUpload,
  newId,
  patchUpload,
  readRaw,
  saveUpload,
  type StoredPiece,
} from "./store";
import { extractUpload } from "./unzip";

export async function processUpload(uploadId: string): Promise<void> {
  const upload = await getUpload(uploadId);
  if (!upload) return;

  // Apply the agent (model) + intensity (reasoning) chosen for this upload,
  // falling back to the env defaults for legacy records.
  const agent = resolveAgent(upload.agent_id);
  const reasoning = resolveIntensity(upload.intensity);
  const settings: DceSettings = { ...getSettings(), model: agent.model, reasoning };

  try {
    await patchUpload(uploadId, { status: "processing", error: null, pieces: [], fiche: null });

    // 1) unzip + dedup
    const raw = await readRaw(uploadId);
    const files = extractUpload(raw, upload.original_filename);
    if (files.length === 0) {
      throw new Error("Aucun document exploitable (pdf/docx/xlsx/image) dans l'upload.");
    }

    const warnings: string[] = [];
    const pieces: StoredPiece[] = [];
    const corpusPieces: CorpusPiece[] = [];

    // 2-4) extract text, classify, keep page-anchored text
    for (const ef of files) {
      const result = await extractText(ef.filename, ef.content, settings);
      warnings.push(...result.warnings);

      const firstPage = result.pages[0]?.text ?? null;
      const pieceType = await classifyPiece(ef.filename, firstPage, settings);

      pieces.push({
        id: newId(),
        filename: ef.filename,
        piece_type: pieceType,
        page_count: result.pages.length,
        pages: result.pages.map((p) => ({
          page_number: p.pageNumber,
          text: p.text,
          ocr_used: p.ocrUsed,
        })),
      });
      corpusPieces.push({
        filename: ef.filename,
        pieceType,
        pages: result.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
      });
    }

    // Persist the page-anchored text early: even if the LLM step fails, sources stay.
    const withPages = await patchUpload(uploadId, { pieces });
    if (!withPages) return;

    // 5) structured Fiche AO extraction (two LLM passes)
    const corpus = buildCorpus(corpusPieces, settings.maxContextChars);
    const fiche = await extractFiche(corpus, settings);

    // go/no-go (no client profile yet — that arrives with M2)
    const gonogo = evaluate(fiche, new Date(), null);

    withPages.fiche = {
      fiche,
      gonogo,
      warnings,
      model: settings.model,
      reasoning: settings.reasoning,
    };
    withPages.status = "ready";
    withPages.error = null;
    await saveUpload(withPages);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await patchUpload(uploadId, { status: "failed", error: message });
  }
}

/** Fire the pipeline in the background; the client polls status. */
export function startProcessing(uploadId: string): void {
  void processUpload(uploadId).catch(() => {
    // processUpload already records failure in the store; nothing to do here.
  });
}

// OCR engine for scanned pages / image files (server-only).
//
// Autonomous: Tesseract.js (WASM) — no external API, no LLM, no per-page cost,
// which is why it is preferred over the vision-model path (completeVision, kept
// available in llm.ts). A single worker is created lazily and reused across
// pages and documents: worker init loads the WASM engine + French language data
// and is by far the expensive part. The language data is fetched once and cached
// under the data dir (a Railway volume in prod) so it survives redeploys.
//
// OCR calls are serialized: one Tesseract worker is single-threaded and not safe
// for concurrent recognize() calls, and two DCE uploads can be processed at once.
// A process-wide queue is plenty for this low-volume internal tool.

import fs from "node:fs/promises";
import path from "node:path";

import type { Worker } from "tesseract.js";

import { getSettings } from "./config";

const OCR_LANG = process.env.DCE_OCR_LANG ?? "fra";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      const cachePath = path.join(getSettings().dataDir, "tessdata");
      await fs.mkdir(cachePath, { recursive: true }).catch(() => {});
      // Language data is downloaded on first use, then read from cachePath.
      return createWorker(OCR_LANG, OEM.LSTM_ONLY, { cachePath });
    })().catch((err) => {
      // Don't cache a failed init — let the next call retry (e.g. transient
      // network error while fetching the language data).
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

// Serialize recognize() calls across the process (single shared worker).
let queue: Promise<unknown> = Promise.resolve();

/** OCR a PNG/JPEG/… image buffer to plain text. Returns "" if nothing legible. */
export function ocrImage(image: Buffer): Promise<string> {
  const run = queue.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return (data.text ?? "").trim();
  });
  // Keep the queue alive regardless of an individual page's failure.
  queue = run.catch(() => undefined);
  return run;
}

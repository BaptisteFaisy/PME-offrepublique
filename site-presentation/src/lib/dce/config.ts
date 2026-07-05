// M1 pipeline configuration (server-only), read from the environment.
//
// Everything runs inside the Next.js web service — no separate backend. State is
// persisted to a light file store under DCE_DATA_DIR (point this at a Railway
// volume in production so uploads survive redeploys).

import path from "node:path";

import { resolveIntensity, type Intensity } from "./options";

export type DceSettings = {
  /** Directory for the file-based store (uploads, pages, fiches). */
  dataDir: string;
  /** LLM API key for the OpenAI-compatible endpoint. Optional: the local Codex
   *  server ignores it unless started with --api-key; a real key is only needed
   *  when pointing at an authenticated endpoint (e.g. api.openai.com). */
  apiKey: string;
  /** Base URL of the OpenAI-compatible endpoint (must end in /v1). Defaults to
   *  the local `openai-api-server-via-codex` server. On Railway, override this
   *  with a reachable endpoint (DCE_LLM_BASE_URL) — 127.0.0.1 is not reachable
   *  from the container. */
  baseUrl: string;
  /** Model id for classification + extraction (default: gpt-5.5). Overridden
   *  per-upload by the "agent" chosen in the UI (see options.ts). */
  model: string;
  /** Reasoning effort for the LLM calls (default: xhigh). Overridden per-upload
   *  by the "intensity" chosen in the UI (see options.ts). */
  reasoning: Intensity;
  /** Max output tokens for the extraction JSON. */
  maxTokens: number;
  /** A PDF page with fewer native chars than this is treated as scanned. */
  ocrMinChars: number;
  /** OCR scanned pages by sending a page image to a vision-capable model. */
  ocrEnabled: boolean;
  /** Vision-capable model id used for OCR (Codex gpt-5.5 reads images). */
  ocrModel: string;
  /** Reasoning effort for OCR — transcription needs little (default "low"). */
  ocrReasoning: Intensity;
  /** Page render scale for OCR images (higher = sharper, more tokens). */
  ocrScale: number;
  /** Max scanned pages OCR'd per document (cost/time guard). */
  ocrMaxPages: number;
  /** Max output tokens for one OCR page transcription. */
  ocrMaxTokens: number;
  /** Cap the page-anchored corpus sent to the LLM (cost guard on huge DCE). */
  maxContextChars: number;
};

export function getSettings(): DceSettings {
  return {
    dataDir: process.env.DCE_DATA_DIR ?? path.join(process.cwd(), ".dce-data"),
    // DCE_LLM_API_KEY is the provider-neutral name; ANTHROPIC_API_KEY kept as a
    // fallback so existing deploys keep working.
    apiKey: process.env.DCE_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    baseUrl: process.env.DCE_LLM_BASE_URL ?? "http://127.0.0.1:18080/v1",
    model: process.env.DCE_LLM_MODEL ?? "gpt-5.5",
    // Default intensity; a per-upload choice overrides this in the pipeline.
    reasoning: resolveIntensity(process.env.DCE_LLM_REASONING),
    // xhigh reasoning burns a lot of completion tokens before the answer starts,
    // so keep this generous — too low truncates the JSON mid-reasoning.
    maxTokens: Number(process.env.DCE_LLM_MAX_TOKENS ?? 32000),
    ocrMinChars: Number(process.env.DCE_OCR_MIN_CHARS ?? 120),
    ocrEnabled: (process.env.DCE_OCR_ENABLED ?? "true").toLowerCase() !== "false",
    ocrModel: process.env.DCE_OCR_MODEL ?? process.env.DCE_LLM_MODEL ?? "gpt-5.5",
    ocrReasoning: resolveIntensity(process.env.DCE_OCR_REASONING ?? "low"),
    ocrScale: Number(process.env.DCE_OCR_SCALE ?? 2),
    ocrMaxPages: Number(process.env.DCE_OCR_MAX_PAGES ?? 40),
    ocrMaxTokens: Number(process.env.DCE_OCR_MAX_TOKENS ?? 8000),
    maxContextChars: Number(process.env.DCE_MAX_CONTEXT_CHARS ?? 350_000),
  };
}

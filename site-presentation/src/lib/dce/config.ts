// M1 pipeline configuration (server-only), read from the environment.
//
// Everything runs inside the Next.js web service — no separate backend. State is
// persisted to a light file store under DCE_DATA_DIR (point this at a Railway
// volume in production so uploads survive redeploys).

import path from "node:path";

export type DceSettings = {
  /** Directory for the file-based store (uploads, pages, fiches). */
  dataDir: string;
  /** LLM API key (z.ai / any Anthropic-compatible endpoint). Required for
   *  classification + Fiche AO extraction. */
  apiKey: string;
  /** Base URL of the Anthropic-compatible endpoint. Empty string = official
   *  Anthropic API (api.anthropic.com). Defaults to z.ai's endpoint. */
  baseUrl: string;
  /** Model id for classification + extraction (z.ai default: glm-4.6). */
  model: string;
  /** Max output tokens for the extraction JSON. */
  maxTokens: number;
  /** A PDF page with fewer native chars than this is treated as scanned. */
  ocrMinChars: number;
  /** Cap the page-anchored corpus sent to the LLM (cost guard on huge DCE). */
  maxContextChars: number;
};

export function getSettings(): DceSettings {
  return {
    dataDir: process.env.DCE_DATA_DIR ?? path.join(process.cwd(), ".dce-data"),
    // DCE_LLM_API_KEY is the provider-neutral name; ANTHROPIC_API_KEY kept as a
    // fallback so existing deploys keep working.
    apiKey: process.env.DCE_LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
    baseUrl: process.env.DCE_LLM_BASE_URL ?? "https://api.z.ai/api/anthropic",
    model: process.env.DCE_LLM_MODEL ?? "glm-4.6",
    maxTokens: Number(process.env.DCE_LLM_MAX_TOKENS ?? 8000),
    ocrMinChars: Number(process.env.DCE_OCR_MIN_CHARS ?? 120),
    maxContextChars: Number(process.env.DCE_MAX_CONTEXT_CHARS ?? 350_000),
  };
}

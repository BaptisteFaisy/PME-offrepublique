// M1 pipeline configuration (server-only), read from the environment.
//
// Everything runs inside the Next.js web service — no separate backend. State is
// persisted to a light file store under DCE_DATA_DIR (point this at a Railway
// volume in production so uploads survive redeploys).

import path from "node:path";

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
  /** Model id for classification + extraction (default: gpt-5.5). */
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
    apiKey: process.env.DCE_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    baseUrl: process.env.DCE_LLM_BASE_URL ?? "http://127.0.0.1:18080/v1",
    model: process.env.DCE_LLM_MODEL ?? "gpt-5.5",
    // xhigh reasoning burns a lot of completion tokens before the answer starts,
    // so keep this generous — too low truncates the JSON mid-reasoning.
    maxTokens: Number(process.env.DCE_LLM_MAX_TOKENS ?? 32000),
    ocrMinChars: Number(process.env.DCE_OCR_MIN_CHARS ?? 120),
    maxContextChars: Number(process.env.DCE_MAX_CONTEXT_CHARS ?? 350_000),
  };
}

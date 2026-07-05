// LLM access for the M1 pipeline (server-only).
//
// Thin wrapper around the OpenAI TypeScript SDK, pointed by default at the local
// OpenAI-compatible server exposed by `openai-api-server-via-codex` (see config.ts,
// DCE_LLM_BASE_URL — default http://127.0.0.1:18080/v1) so it drives Codex-backed
// GPT models. Point DCE_LLM_BASE_URL at any other OpenAI-compatible endpoint
// (including https://api.openai.com/v1) to switch providers.
//
// Two entry points:
// - completeText — short free-text answer (piece classification).
// - completeJson — schema-constrained JSON (Fiche AO extraction) via structured
//   outputs (response_format: json_schema), degrading to plain JSON mode and then
//   a prompt-only call if the endpoint rejects the constraint. parseJson tolerates
//   a code fence in every case.
//
// The model and reasoning effort are picked per-upload: the model comes from the
// chosen "agent" and the reasoning effort from the chosen "intensity" (see
// options.ts), both carried on `settings` (config.ts holds the defaults). Higher
// intensity (xhigh) burns many completion tokens before the answer starts, so the
// token caps (below / config.maxTokens) must stay large.

import OpenAI from "openai";

import { getSettings, type DceSettings } from "./config";

export class LLMError extends Error {}

let cachedClient: OpenAI | null = null;
let cachedClientKey = "";

function getClient(settings: DceSettings): OpenAI {
  // The local Codex server ignores auth unless started with --api-key, but the
  // OpenAI SDK still requires a non-empty key — hence the "local" placeholder.
  const apiKey = settings.apiKey || "local";
  const clientKey = `${settings.baseUrl} ${apiKey}`;
  if (!cachedClient || cachedClientKey !== clientKey) {
    cachedClient = new OpenAI({
      apiKey,
      baseURL: settings.baseUrl || undefined,
    });
    cachedClientKey = clientKey;
  }
  return cachedClient;
}

function messageText(completion: OpenAI.Chat.Completions.ChatCompletion): string {
  return completion.choices[0]?.message?.content ?? "";
}

/** Turn common endpoint errors (unreachable, expired auth) into actionable messages. */
function toFriendly(err: unknown, settings: DceSettings): unknown {
  if (err instanceof OpenAI.APIConnectionError) {
    const url = settings.baseUrl || "https://api.openai.com/v1";
    return new LLMError(
      `Serveur LLM injoignable sur ${url} — démarre \`openai-api-server-via-codex\` ` +
        "ou configure DCE_LLM_BASE_URL vers un endpoint compatible OpenAI accessible.",
    );
  }
  // 401 — usually the ChatGPT/Codex session behind the endpoint got invalidated
  // ("Your authentication token has been invalidated. Please try signing in
  // again."). Tell the operator how to recover; distinguish that from a plain
  // bearer-key mismatch (DCE_LLM_API_KEY ≠ the server's LLM_API_KEY).
  if (
    err instanceof OpenAI.AuthenticationError ||
    (err instanceof OpenAI.APIError && err.status === 401)
  ) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/invalidat|sign\s*in\s*again|expired/i.test(raw)) {
      return new LLMError(
        "Session Codex expirée (401 renvoyé par l'API ChatGPT). Régénère l'accès : " +
          "exécute `codex-llm-server/refresh-codex-auth.ps1` (ou `codex login` puis " +
          "mets à jour la variable CODEX_AUTH_JSON du service Railway).",
      );
    }
    return new LLMError(
      "Authentification LLM refusée (401). Vérifie que DCE_LLM_API_KEY correspond au " +
        "LLM_API_KEY du serveur Codex, sinon régénère la session Codex avec " +
        "`codex-llm-server/refresh-codex-auth.ps1`.",
    );
  }
  return err;
}

/** Parse a JSON object out of a model response (tolerates code fences). */
function parseJson(text: string): unknown {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) t = fenced[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new LLMError("Réponse LLM non parsable en JSON.");
  }
}

export async function completeText(
  system: string,
  user: string,
  opts: { settings?: DceSettings; maxTokens?: number } = {},
): Promise<string> {
  const settings = opts.settings ?? getSettings();
  try {
    const completion = await getClient(settings).chat.completions.create({
      model: settings.model,
      // Answer is one word, but high/xhigh reasoning needs headroom before it emits.
      max_completion_tokens: opts.maxTokens ?? 4096,
      reasoning_effort: settings.reasoning,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return messageText(completion).trim();
  } catch (err) {
    throw toFriendly(err, settings);
  }
}

/** Vision call — read text/content from one or more page images (OCR of scanned
 *  PDF pages). The Codex-backed GPT models accept `image_url` content parts. */
export async function completeVision(
  system: string,
  user: string,
  imageUrls: string[],
  opts: {
    settings?: DceSettings;
    model?: string;
    reasoning?: DceSettings["reasoning"];
    maxTokens?: number;
  } = {},
): Promise<string> {
  const settings = opts.settings ?? getSettings();
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: user },
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  try {
    const completion = await getClient(settings).chat.completions.create({
      model: opts.model ?? settings.model,
      max_completion_tokens: opts.maxTokens ?? 8000,
      reasoning_effort: opts.reasoning ?? settings.reasoning,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    });
    return messageText(completion).trim();
  } catch (err) {
    throw toFriendly(err, settings);
  }
}

export async function completeJson(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: { settings?: DceSettings } = {},
): Promise<unknown> {
  const settings = opts.settings ?? getSettings();
  const client = getClient(settings);

  const base: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: settings.model,
    max_completion_tokens: settings.maxTokens,
    reasoning_effort: settings.reasoning,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  try {
    // 1) Structured outputs — steer the model with the Fiche AO JSON schema.
    try {
      const completion = await client.chat.completions.create({
        ...base,
        response_format: {
          type: "json_schema",
          json_schema: { name: "fiche_ao", schema, strict: false },
        },
      });
      return parseJson(messageText(completion));
    } catch (err) {
      if (!(err instanceof OpenAI.BadRequestError)) throw err;
    }

    // 2) Generic JSON mode — endpoint rejected the schema constraint.
    try {
      const completion = await client.chat.completions.create({
        ...base,
        response_format: { type: "json_object" },
      });
      return parseJson(messageText(completion));
    } catch (err) {
      if (!(err instanceof OpenAI.BadRequestError)) throw err;
    }

    // 3) Prompt-only — endpoint rejected response_format entirely.
    const completion = await client.chat.completions.create(base);
    return parseJson(messageText(completion));
  } catch (err) {
    throw toFriendly(err, settings);
  }
}

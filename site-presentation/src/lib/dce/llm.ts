// Claude API access for the M1 pipeline (server-only).
//
// Thin wrapper around the Anthropic TypeScript SDK. Two entry points:
// - completeText  — short free-text answer (piece classification).
// - completeJson  — schema-constrained JSON (Fiche AO extraction) via structured
//   outputs (output_config.format), with a prompt-only fallback if the model
//   rejects the constraint.
//
// The CDC picks Sonnet for cost/quality (config.ts, DCE_LLM_MODEL). Thinking is
// disabled to keep per-DCE cost under the CDC budget (< 3 € LLM+OCR).

import Anthropic from "@anthropic-ai/sdk";

import { getSettings, type DceSettings } from "./config";

export class LLMError extends Error {}

let cachedClient: Anthropic | null = null;

function getClient(settings: DceSettings): Anthropic {
  if (!settings.anthropicApiKey) {
    throw new LLMError(
      "ANTHROPIC_API_KEY manquant — l'extraction Fiche AO nécessite la clé Claude.",
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: settings.anthropicApiKey });
  }
  return cachedClient;
}

function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
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
  const message = await getClient(settings).messages.create({
    model: settings.model,
    max_tokens: opts.maxTokens ?? 64,
    system,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: user }],
  });
  return responseText(message).trim();
}

export async function completeJson(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: { settings?: DceSettings } = {},
): Promise<unknown> {
  const settings = opts.settings ?? getSettings();
  const client = getClient(settings);

  const base = {
    model: settings.model,
    max_tokens: settings.maxTokens,
    system,
    thinking: { type: "disabled" as const },
    messages: [{ role: "user" as const, content: user }],
  };

  try {
    const message = await client.messages.create({
      ...base,
      output_config: { format: { type: "json_schema", schema } },
    });
    return parseJson(responseText(message));
  } catch (err) {
    // Fall back to prompt-only JSON if the schema constraint is rejected.
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    const message = await client.messages.create(base);
    return parseJson(responseText(message));
  }
}

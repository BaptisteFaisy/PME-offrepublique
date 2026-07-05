// Selectable analysis options for the M1 DCE pipeline: the "agent" (which model
// runs the analysis) and the "intensity" (how hard it reasons).
//
// Shared by the client (the uploader dropdowns) AND the server (upload route +
// pipeline), so this module must stay free of any node-only import — keep it to
// plain data + pure helpers.
//
// - An "agent" maps to a model id served by the same OpenAI-compatible endpoint
//   (DCE_LLM_BASE_URL, the Codex server). Only the `model` field changes.
// - An "intensity" maps to the OpenAI `reasoning_effort`.

export type Intensity = "none" | "low" | "medium" | "high" | "xhigh";

export type AgentOption = {
  /** Stable id stored on the upload and sent from the upload form. */
  id: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** Model id passed to the LLM endpoint. */
  model: string;
  /** Short hint shown under the label. */
  hint?: string;
};

export type IntensityOption = {
  id: Intensity;
  /** Human label shown in the dropdown. */
  label: string;
  /** Raw reasoning_effort value, surfaced as a hint. */
  hint: string;
};

/** Models exposed by the current Codex-backed endpoint (same baseUrl + key). */
export const AGENTS: AgentOption[] = [
  { id: "gpt-5.5", label: "GPT-5.5", model: "gpt-5.5", hint: "Polyvalent — défaut" },
  { id: "gpt-5", label: "GPT-5", model: "gpt-5", hint: "Généraliste" },
  { id: "gpt-5-codex", label: "GPT-5 Codex", model: "gpt-5-codex", hint: "Orienté structuré" },
];

export const DEFAULT_AGENT_ID = "gpt-5.5";

/** Reasoning effort, from fastest/cheapest to deepest. "Fast" (none) skips
 *  deliberation entirely — near-instant, lowest token cost.
 *  NB: the model accepts `none | low | medium | high | xhigh`; `minimal` is
 *  rejected by gpt-5.5 (400), so it is intentionally not offered. */
export const INTENSITIES: IntensityOption[] = [
  { id: "none", label: "Fast", hint: "none" },
  { id: "low", label: "Rapide", hint: "low" },
  { id: "medium", label: "Équilibré", hint: "medium" },
  { id: "high", label: "Poussé", hint: "high" },
  { id: "xhigh", label: "Maximal", hint: "xhigh" },
];

export const DEFAULT_INTENSITY: Intensity = "xhigh";

/** Resolve a stored/submitted agent id to a known agent, falling back to default. */
export function resolveAgent(id: string | null | undefined): AgentOption {
  return (
    AGENTS.find((a) => a.id === id) ??
    AGENTS.find((a) => a.id === DEFAULT_AGENT_ID) ??
    AGENTS[0]
  );
}

/** Resolve a stored/submitted intensity id to a known value, falling back to default. */
export function resolveIntensity(id: string | null | undefined): Intensity {
  return INTENSITIES.some((i) => i.id === id) ? (id as Intensity) : DEFAULT_INTENSITY;
}

/** Human label for an intensity id (for display), falling back to the id itself. */
export function intensityLabel(id: string | null | undefined): string {
  return INTENSITIES.find((i) => i.id === id)?.label ?? String(id ?? "");
}

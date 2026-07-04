// Pipeline step 2 — classify each piece (RC / CCAP / CCTP / AE / prix / annexe).
//
// Filename rules first (fast, free, deterministic); an LLM pass on the first page
// only when the filename is ambiguous. Acronyms are matched as whole tokens to
// avoid false hits inside longer words; multi-word labels match the whole name.

import type { DceSettings } from "./config";
import { completeText } from "./llm";

export const CATEGORIES = ["RC", "CCAP", "CCTP", "AE", "prix", "annexe"] as const;
export type PieceType = (typeof CATEGORIES)[number] | "inconnu";

// [phrases matched anywhere in the normalized name, acronyms matched as tokens].
const RULES: Record<string, { phrases: string[]; acronyms: string[] }> = {
  RC: {
    phrases: ["reglement de consultation", "reglement consultation", "reglement de la consultation"],
    acronyms: ["rc"],
  },
  CCAP: { phrases: ["clauses administratives", "cahier des clauses administratives"], acronyms: ["ccap"] },
  CCTP: { phrases: ["clauses techniques", "cahier des clauses techniques"], acronyms: ["cctp"] },
  AE: { phrases: ["acte d engagement", "acte engagement"], acronyms: ["ae"] },
  prix: {
    phrases: ["bordereau", "detail quantitatif", "decomposition", "grille tarifaire", "quantitatif estimatif"],
    acronyms: ["bpu", "dqe", "dpgf"],
  },
  annexe: {
    phrases: ["annexe", "cadre de reponse", "cadre reponse", "attestation", "memoire technique", "planning", "plan de"],
    acronyms: ["dume"],
  },
};

function normalize(text: string): string {
  // Strip combining marks after NFKD decomposition (é -> e, ç -> c, …).
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function classifyByFilename(filename: string): PieceType | null {
  const stem = normalize(filename).replace(/\.(pdf|docx|xlsx|zip)$/, "");
  const spaced = stem.replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = new Set(spaced.split(" ").filter(Boolean));

  const matched: string[] = [];
  for (const category of CATEGORIES) {
    const { phrases, acronyms } = RULES[category];
    if (phrases.some((p) => spaced.includes(p)) || acronyms.some((a) => tokens.has(a))) {
      matched.push(category);
    }
  }
  if (matched.length >= 1) return matched[0] as PieceType; // fixed priority (most decisive first)
  return null;
}

const LLM_SYSTEM =
  "Tu classes une pièce d'un dossier de consultation (marché public). " +
  "Réponds par UN SEUL mot parmi: RC, CCAP, CCTP, AE, prix, annexe. " +
  "RC=règlement de consultation, CCAP=clauses administratives, CCTP=clauses techniques, " +
  "AE=acte d'engagement, prix=bordereau/BPU/DQE/DPGF, annexe=tout le reste. " +
  "Ne donne aucune explication.";

/** Return the piece type. Falls back to an LLM pass only when the name is ambiguous. */
export async function classifyPiece(
  filename: string,
  firstPageText: string | null,
  settings: DceSettings,
  useLlm = true,
): Promise<PieceType> {
  const byName = classifyByFilename(filename);
  if (byName !== null) return byName;

  if (!useLlm || !firstPageText || !firstPageText.trim() || !settings.anthropicApiKey) {
    return "inconnu";
  }

  try {
    const excerpt = firstPageText.trim().slice(0, 2000);
    const answer = await completeText(
      LLM_SYSTEM,
      `Nom du fichier: ${filename}\n\nPremière page:\n${excerpt}`,
      { settings },
    );
    const token = answer.replace(/[^A-Za-z]/g, "").toLowerCase();
    for (const category of CATEGORIES) {
      if (token === category.toLowerCase()) return category;
    }
  } catch {
    // Classification must never sink ingestion.
  }
  return "inconnu";
}

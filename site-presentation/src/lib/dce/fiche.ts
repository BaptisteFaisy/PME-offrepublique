// Pipeline step 5 — structured Fiche AO extraction (two LLM passes).
//
// Pass 1 extracts the Fiche AO from the page-anchored corpus. Pass 2 re-reads
// the corpus and audits pass 1: it corrects wrong source pages and nulls out any
// value it cannot ground in the text (the anti-hallucination rule — an honest gap
// beats a fluent invention, CDC §4/§10).

import type { Fiche } from "@/lib/api";

import type { DceSettings } from "./config";
import { completeJson } from "./llm";
import { FICHE_AO_SCHEMA, mergeOntoTemplate } from "./schema";

const PIECE_PRIORITY: Record<string, number> = {
  RC: 0,
  CCAP: 1,
  CCTP: 2,
  AE: 3,
  prix: 4,
  annexe: 5,
  inconnu: 6,
};

export type CorpusPiece = {
  filename: string;
  pieceType: string;
  pages: { pageNumber: number; text: string }[];
};

/** Format pieces into a page-anchored corpus, capped at maxChars. */
export function buildCorpus(pieces: CorpusPiece[], maxChars: number): string {
  const ordered = [...pieces].sort(
    (a, b) => (PIECE_PRIORITY[a.pieceType] ?? 9) - (PIECE_PRIORITY[b.pieceType] ?? 9),
  );
  const chunks: string[] = [];
  let total = 0;
  for (const piece of ordered) {
    const header = `\n=== FICHIER: ${piece.filename} (type: ${piece.pieceType}) ===\n`;
    chunks.push(header);
    total += header.length;
    for (const { pageNumber, text } of piece.pages) {
      const block = `--- page ${pageNumber} ---\n${(text ?? "").trim()}\n`;
      if (total + block.length > maxChars) {
        chunks.push("--- [corpus tronqué pour limite de contexte] ---\n");
        return chunks.join("");
      }
      chunks.push(block);
      total += block.length;
    }
  }
  return chunks.join("");
}

const EXTRACT_SYSTEM =
  "Tu es analyste de marchés publics (secteur propreté). À partir du DCE fourni " +
  "(texte ancré par fichier et par page), tu produis une Fiche AO structurée en JSON.\n" +
  "RÈGLES ABSOLUES:\n" +
  "1. N'invente jamais une valeur. Si une information est absente ou incertaine, " +
  "mets null (ou une liste vide). Un trou honnête vaut mieux qu'une valeur fausse.\n" +
  "2. Chaque champ doté d'un objet `source` doit référencer le fichier et la page " +
  "EXACTS d'où provient l'information, tels qu'écrits dans les marqueurs " +
  "`=== FICHIER: ... ===` et `--- page N ---`.\n" +
  "3. Les pondérations des critères sont des nombres (pourcentages).\n" +
  "4. `date_limite_offres` au format ISO-8601 si possible.\n" +
  "Réponds uniquement avec le JSON de la Fiche AO.";

const VERIFY_SYSTEM =
  "Tu vérifies une Fiche AO déjà extraite d'un DCE. Pour chaque champ:\n" +
  "- confirme qu'il est bien étayé par le texte fourni ; sinon mets-le à null " +
  "(ou liste vide) — ne complète JAMAIS par déduction.\n" +
  "- corrige toute `source` (fichier/page) qui ne correspond pas au passage réel.\n" +
  "- corrige les pondérations et dates manifestement erronées.\n" +
  "Renvoie la Fiche AO corrigée, même JSON, mêmes clés.";

/** Run the two-pass extraction. Returns a schema-shaped Fiche AO. */
export async function extractFiche(corpus: string, settings: DceSettings): Promise<Fiche> {
  const schema = FICHE_AO_SCHEMA as unknown as Record<string, unknown>;

  const pass1 = await completeJson(
    EXTRACT_SYSTEM,
    `DCE:\n${corpus}\n\nProduis la Fiche AO en JSON.`,
    schema,
    { settings },
  );
  let fiche = mergeOntoTemplate(pass1);

  try {
    const pass2 = await completeJson(
      VERIFY_SYSTEM,
      `DCE:\n${corpus}\n\nFiche AO à vérifier:\n${JSON.stringify(fiche)}`,
      schema,
      { settings },
    );
    fiche = mergeOntoTemplate(pass2);
  } catch {
    // Verification is a bonus — keep pass 1 if it fails.
  }

  return fiche;
}

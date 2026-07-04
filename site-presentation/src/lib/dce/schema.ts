// Fiche AO — the target extraction schema (CDC §4, M1).
//
// The JSON Schema is the contract for the two-pass LLM extraction and drives
// structured outputs (output_config.format). It stays within the
// structured-outputs subset: additionalProperties:false everywhere, explicit
// required, nullability via ["type","null"], no min/max/format keywords.
//
// Every non-trivial field carries a `source` object ({fichier, page}) so the UI
// can let a human click through to the exact page and verify — the traceability
// rule that turns "the AI read the DCE" into "I can trust it in 15 minutes".

import type { Fiche } from "@/lib/api";

const SOURCE = {
  type: "object",
  additionalProperties: false,
  properties: {
    fichier: { type: ["string", "null"] },
    page: { type: ["integer", "null"] },
  },
  required: ["fichier", "page"],
} as const;

const SOUS_CRITERE = {
  type: "object",
  additionalProperties: false,
  properties: {
    libelle: { type: ["string", "null"] },
    ponderation: { type: ["number", "null"] },
  },
  required: ["libelle", "ponderation"],
} as const;

export const FICHE_AO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reference: { type: ["string", "null"] },
    acheteur: {
      type: "object",
      additionalProperties: false,
      properties: {
        nom: { type: ["string", "null"] },
        type: {
          type: ["string", "null"],
          enum: ["commune", "departement", "bailleur", "hopital", "etat", "autre", null],
        },
        profil_acheteur_url: { type: ["string", "null"] },
      },
      required: ["nom", "type", "profil_acheteur_url"],
    },
    objet: { type: ["string", "null"] },
    procedure: {
      type: ["string", "null"],
      enum: ["MAPA", "appel_offres_ouvert", "autre", null],
    },
    allotissement: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          num: { type: ["integer", "null"] },
          intitule: { type: ["string", "null"] },
          estimation_eur: { type: ["number", "null"] },
          source: SOURCE,
        },
        required: ["num", "intitule", "estimation_eur", "source"],
      },
    },
    date_limite_offres: { type: ["string", "null"] },
    visite: {
      type: "object",
      additionalProperties: false,
      properties: {
        obligatoire: { type: ["boolean", "null"] },
        dates: { type: "array", items: { type: "string" } },
        contact: { type: ["string", "null"] },
        source: SOURCE,
      },
      required: ["obligatoire", "dates", "contact", "source"],
    },
    duree: {
      type: "object",
      additionalProperties: false,
      properties: {
        initiale_mois: { type: ["integer", "null"] },
        reconductions: { type: ["integer", "null"] },
        source: SOURCE,
      },
      required: ["initiale_mois", "reconductions", "source"],
    },
    criteres: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          libelle: { type: ["string", "null"] },
          ponderation: { type: ["number", "null"] },
          sous_criteres: { type: "array", items: SOUS_CRITERE },
          source: SOURCE,
        },
        required: ["libelle", "ponderation", "sous_criteres", "source"],
      },
    },
    cadre_reponse_impose: {
      type: "object",
      additionalProperties: false,
      properties: {
        present: { type: ["boolean", "null"] },
        fichier: { type: ["string", "null"] },
        source: SOURCE,
      },
      required: ["present", "fichier", "source"],
    },
    pieces_candidature: { type: "array", items: { type: "string" } },
    pieces_offre: { type: "array", items: { type: "string" } },
    exigences_bloquantes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: ["string", "null"],
            enum: ["certification", "ca_min", "references", "effectif", "autre", null],
          },
          detail: { type: ["string", "null"] },
          source: SOURCE,
        },
        required: ["type", "detail", "source"],
      },
    },
    clauses_notables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: ["string", "null"],
            enum: ["penalite", "revision_prix", "insertion", "reprise_personnel", "rse", "autre", null],
          },
          detail: { type: ["string", "null"] },
          source: SOURCE,
        },
        required: ["type", "detail", "source"],
      },
    },
    questions_a_poser: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "reference",
    "acheteur",
    "objet",
    "procedure",
    "allotissement",
    "date_limite_offres",
    "visite",
    "duree",
    "criteres",
    "cadre_reponse_impose",
    "pieces_candidature",
    "pieces_offre",
    "exigences_bloquantes",
    "clauses_notables",
    "questions_a_poser",
    "red_flags",
  ],
} as const;

const NO_SOURCE = { fichier: null, page: null };

/** A schema-shaped Fiche AO with every field null/empty (safe fallback). */
export function emptyFiche(): Fiche {
  return {
    reference: null,
    acheteur: { nom: null, type: null, profil_acheteur_url: null },
    objet: null,
    procedure: null,
    allotissement: [],
    date_limite_offres: null,
    visite: { obligatoire: null, dates: [], contact: null, source: { ...NO_SOURCE } },
    duree: { initiale_mois: null, reconductions: null, source: { ...NO_SOURCE } },
    criteres: [],
    cadre_reponse_impose: { present: null, fichier: null, source: { ...NO_SOURCE } },
    pieces_candidature: [],
    pieces_offre: [],
    exigences_bloquantes: [],
    clauses_notables: [],
    questions_a_poser: [],
    red_flags: [],
  };
}

/** Ensure a parsed object has every top-level Fiche AO key (defensive). */
export function mergeOntoTemplate(data: unknown): Fiche {
  const base = emptyFiche();
  if (!data || typeof data !== "object") return base;
  const rec = data as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof Fiche)[]) {
    if (key in rec && rec[key] != null) {
      // Trust the LLM's shape here; the schema constrained it. Cast through unknown.
      (base as Record<string, unknown>)[key] = rec[key];
    }
  }
  return base;
}

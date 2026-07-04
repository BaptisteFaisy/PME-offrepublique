// Go/No-Go scoring — readable rules, no ML (CDC §4).
//
// Crosses the Fiche AO's blocking requirements with simple heuristics (deadline,
// imposed response frame, red flags) and, when available, a client profile (M2).
// Output: GO / NO-GO / GO sous conditions, with the reasons listed.

import type { Exigence, Fiche, GoNoGo, GoNoGoReason, Severity } from "@/lib/api";

function parseDeadline(value: string | null): Date | null {
  if (!value) return null;
  const raw = value.trim();
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;
  // Fall back to a bare YYYY-MM-DD prefix.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d2 = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function reason(code: string, message: string, severity: Severity): GoNoGoReason {
  return { code, message, severity };
}

function requirementMet(exig: Exigence, profile: Record<string, unknown>): boolean | null {
  const kind = exig?.type;
  if (kind === "ca_min") {
    const clientCa = profile.ca_eur;
    const required = (exig as unknown as { montant_eur?: number }).montant_eur;
    if (typeof clientCa === "number" && typeof required === "number") return clientCa >= required;
  }
  if (kind === "certification") {
    const detail = (exig.detail ?? "").toLowerCase();
    const certs = Array.isArray(profile.certifications)
      ? (profile.certifications as unknown[]).map((c) => String(c).toLowerCase())
      : [];
    if (detail && certs.length) return certs.some((c) => detail.includes(c) || c.includes(detail));
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluate(
  fiche: Fiche,
  today: Date = new Date(),
  clientProfile: Record<string, unknown> | null = null,
): GoNoGo {
  const raisons: GoNoGoReason[] = [];

  // --- deadline ---
  const deadline = parseDeadline(fiche.date_limite_offres);
  let joursRestants: number | null = null;
  if (deadline === null) {
    raisons.push(reason("date_illisible", "Date limite non extraite ou illisible.", "attention"));
  } else {
    const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const t1 = Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    joursRestants = Math.round((t1 - t0) / DAY_MS);
    if (joursRestants < 0) {
      raisons.push(reason("delai_depasse", `Date limite dépassée (${fiche.date_limite_offres}).`, "bloquant"));
    } else if (joursRestants < 7) {
      raisons.push(reason("delai_court", `Délai très court: ${joursRestants} jour(s) restant(s).`, "attention"));
    }
  }

  // --- blocking requirements (checked against the client profile when present) ---
  for (const exig of fiche.exigences_bloquantes ?? []) {
    const detail = exig?.detail || "exigence non détaillée";
    const met = clientProfile ? requirementMet(exig, clientProfile) : null;
    if (met === false) {
      raisons.push(reason("exigence_non_remplie", `Exigence bloquante non remplie: ${detail}.`, "bloquant"));
    } else if (met === null) {
      raisons.push(reason("exigence_a_verifier", `Exigence bloquante à vérifier: ${detail}.`, "attention"));
    }
  }

  // --- imposed response frame ---
  if (fiche.cadre_reponse_impose?.present) {
    raisons.push(
      reason("cadre_impose", "Cadre de réponse imposé — à respecter à la lettre (éliminatoire sinon).", "attention"),
    );
  }

  // --- red flags surfaced during extraction ---
  for (const flag of fiche.red_flags ?? []) {
    if (flag) raisons.push(reason("red_flag", `Point de vigilance: ${flag}.`, "attention"));
  }

  // --- decision ---
  let decision: GoNoGo["decision"];
  if (raisons.some((r) => r.severity === "bloquant")) decision = "NO-GO";
  else if (raisons.some((r) => r.severity === "attention")) decision = "GO_CONDITIONS";
  else decision = "GO";

  return { decision, jours_restants: joursRestants, raisons };
}

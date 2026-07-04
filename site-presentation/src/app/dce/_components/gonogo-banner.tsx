"use client";

import type { GoNoGo, GoNoGoDecision, Severity } from "@/lib/api";

const DECISION_LABEL: Record<GoNoGoDecision, string> = {
  GO: "GO",
  "NO-GO": "NO-GO",
  GO_CONDITIONS: "GO sous conditions",
};

// Map decisions/severities to the CSS modifier classes defined in dce.css.
const DECISION_CLASS: Record<GoNoGoDecision, string> = {
  GO: "go",
  "NO-GO": "nogo",
  GO_CONDITIONS: "cond",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  bloquant: "sev-bloquant",
  attention: "sev-attention",
  info: "sev-info",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  bloquant: "Bloquant",
  attention: "Attention",
  info: "Info",
};

export function GoNoGoBanner({ gonogo }: { gonogo: GoNoGo }) {
  const decision = gonogo.decision;
  const cls = DECISION_CLASS[decision] ?? "cond";

  return (
    <div className={`card gonogo gonogo--${cls}`}>
      <div className="gonogo__head">
        <span className={`gonogo__badge gonogo__badge--${cls}`}>
          {DECISION_LABEL[decision] ?? decision}
        </span>
        {gonogo.jours_restants != null && (
          <span className="muted">
            {gonogo.jours_restants >= 0
              ? `${gonogo.jours_restants} jour(s) avant la date limite`
              : `Date limite dépassée de ${Math.abs(gonogo.jours_restants)} jour(s)`}
          </span>
        )}
      </div>

      {gonogo.raisons.length > 0 ? (
        <ul className="reasons">
          {gonogo.raisons.map((r, i) => (
            <li key={`${r.code}-${i}`} className="reasons__item">
              <span className={`reasons__sev ${SEVERITY_CLASS[r.severity] ?? ""}`}>
                {SEVERITY_LABEL[r.severity] ?? r.severity}
              </span>
              <span>{r.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Aucun point bloquant ni de vigilance détecté.
        </p>
      )}
    </div>
  );
}

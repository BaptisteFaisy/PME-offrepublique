"""Go/No-Go scoring — readable rules, no ML (CDC §4).

Crosses the Fiche AO's blocking requirements with simple heuristics (deadline,
imposed response frame, red flags) and, when available, a client profile from
M2. Output: GO / NO-GO / GO sous conditions, with the reasons listed so a human
can act on them in seconds.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

log = logging.getLogger(__name__)

GO = "GO"
NO_GO = "NO-GO"
GO_CONDITIONS = "GO_CONDITIONS"


def _parse_deadline(value: str | None) -> date | None:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        pass
    # Fall back to a bare date prefix (YYYY-MM-DD).
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _reason(code: str, message: str, severity: str) -> dict:
    return {"code": code, "message": message, "severity": severity}


def evaluate(
    fiche: dict,
    today: date | None = None,
    client_profile: dict | None = None,
) -> dict:
    """Return {decision, jours_restants, raisons[]}.

    ``severity`` is one of "bloquant" (drives NO-GO), "attention" (drives GO
    sous conditions), or "info".
    """
    today = today or date.today()
    raisons: list[dict] = []

    # --- deadline ---
    deadline = _parse_deadline(fiche.get("date_limite_offres"))
    jours_restants: int | None = None
    if deadline is None:
        raisons.append(_reason("date_illisible", "Date limite non extraite ou illisible.", "attention"))
    else:
        jours_restants = (deadline - today).days
        if jours_restants < 0:
            raisons.append(_reason("delai_depasse", f"Date limite dépassée ({deadline.isoformat()}).", "bloquant"))
        elif jours_restants < 7:
            raisons.append(_reason("delai_court", f"Délai très court: {jours_restants} jour(s) restant(s).", "attention"))

    # --- blocking requirements (checked against the client profile when present) ---
    for exig in fiche.get("exigences_bloquantes") or []:
        detail = (exig or {}).get("detail") or "exigence non détaillée"
        met = _requirement_met(exig, client_profile) if client_profile else None
        if met is False:
            raisons.append(_reason("exigence_non_remplie", f"Exigence bloquante non remplie: {detail}.", "bloquant"))
        elif met is None:
            raisons.append(_reason("exigence_a_verifier", f"Exigence bloquante à vérifier: {detail}.", "attention"))

    # --- imposed response frame ---
    cadre = fiche.get("cadre_reponse_impose") or {}
    if cadre.get("present"):
        raisons.append(
            _reason("cadre_impose", "Cadre de réponse imposé — à respecter à la lettre (éliminatoire sinon).", "attention")
        )

    # --- red flags surfaced during extraction ---
    for flag in fiche.get("red_flags") or []:
        if flag:
            raisons.append(_reason("red_flag", f"Point de vigilance: {flag}.", "attention"))

    # --- decision ---
    if any(r["severity"] == "bloquant" for r in raisons):
        decision = NO_GO
    elif any(r["severity"] == "attention" for r in raisons):
        decision = GO_CONDITIONS
    else:
        decision = GO

    return {"decision": decision, "jours_restants": jours_restants, "raisons": raisons}


def _requirement_met(exig: dict, profile: dict) -> bool | None:
    """Best-effort check of one blocking requirement against a client profile.

    Returns True/False when we can decide, None when we can't (M2 will make this
    richer; today the profile schema is intentionally thin).
    """
    kind = (exig or {}).get("type")
    if kind == "ca_min":
        client_ca = profile.get("ca_eur")
        required = exig.get("montant_eur")
        if isinstance(client_ca, (int, float)) and isinstance(required, (int, float)):
            return client_ca >= required
    if kind == "certification":
        detail = ((exig.get("detail") or "")).lower()
        certs = [str(c).lower() for c in profile.get("certifications", [])]
        if detail and certs:
            return any(c in detail or detail in c for c in certs)
    return None

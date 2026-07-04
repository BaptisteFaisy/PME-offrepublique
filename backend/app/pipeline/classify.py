"""Pipeline step 2 — classify each piece (RC / CCAP / CCTP / AE / prix / annexe).

Filename rules first (fast, free, deterministic); an LLM pass on the first page
only when the filename is ambiguous. Acronyms (rc, ae, ccap…) are matched as
whole tokens to avoid false hits inside longer words; multi-word labels are
matched against the whole normalized name.
"""

from __future__ import annotations

import logging
import re
import unicodedata

from app.config import Settings

log = logging.getLogger(__name__)

CATEGORIES = ("RC", "CCAP", "CCTP", "AE", "prix", "annexe")

# (phrases matched anywhere in the normalized name, acronyms matched as tokens).
_RULES: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "RC": (("reglement de consultation", "reglement consultation", "reglement de la consultation"), ("rc",)),
    "CCAP": (("clauses administratives", "cahier des clauses administratives"), ("ccap",)),
    "CCTP": (("clauses techniques", "cahier des clauses techniques"), ("cctp",)),
    "AE": (("acte d engagement", "acte engagement"), ("ae",)),
    "prix": (
        ("bordereau", "detail quantitatif", "decomposition", "grille tarifaire", "quantitatif estimatif"),
        ("bpu", "dqe", "dpgf"),
    ),
    "annexe": (
        ("annexe", "cadre de reponse", "cadre reponse", "attestation", "memoire technique", "planning", "plan de"),
        ("dume",),
    ),
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def classify_by_filename(filename: str) -> str | None:
    """Return a category, or None when the filename is not decisive."""
    stem = re.sub(r"\.(pdf|docx|xlsx|zip)$", "", _normalize(filename))
    spaced = re.sub(r"[^a-z0-9]+", " ", stem).strip()
    tokens = set(spaced.split())

    matched: list[str] = []
    for category in CATEGORIES:
        phrases, acronyms = _RULES[category]
        if any(p in spaced for p in phrases) or any(a in tokens for a in acronyms):
            matched.append(category)

    if len(matched) == 1:
        return matched[0]
    if len(matched) > 1:
        # Multiple hits — pick by our fixed priority (most decisive first).
        return matched[0]
    return None


_LLM_SYSTEM = (
    "Tu classes une pièce d'un dossier de consultation (marché public). "
    "Réponds par UN SEUL mot parmi: RC, CCAP, CCTP, AE, prix, annexe. "
    "RC=règlement de consultation, CCAP=clauses administratives, "
    "CCTP=clauses techniques, AE=acte d'engagement, prix=bordereau/BPU/DQE/DPGF, "
    "annexe=tout le reste. Ne donne aucune explication."
)


def classify_piece(
    filename: str,
    first_page_text: str | None,
    settings: Settings,
    *,
    use_llm: bool = True,
) -> tuple[str, bool]:
    """Return (piece_type, used_llm).

    Falls back to an LLM pass on the first page only when the filename is
    ambiguous and a first page is available.
    """
    by_name = classify_by_filename(filename)
    if by_name is not None:
        return by_name, False

    if not use_llm or not first_page_text or not first_page_text.strip():
        return "inconnu", False

    try:
        from app.pipeline.llm import complete_text

        excerpt = first_page_text.strip()[:2000]
        answer = complete_text(
            _LLM_SYSTEM,
            f"Nom du fichier: {filename}\n\nPremière page:\n{excerpt}",
            model=settings.llm_model_classification,
            settings=settings,
        )
        token = re.sub(r"[^A-Za-z]", "", answer).strip()
        for category in CATEGORIES:
            if token.lower() == category.lower():
                return category, True
        log.warning("LLM classification unrecognized: %r", answer)
    except Exception:  # noqa: BLE001 — classification must never sink ingestion
        log.exception("LLM classification failed for %s", filename)

    return "inconnu", False

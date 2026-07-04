"""Pipeline step 5 — structured Fiche AO extraction (two LLM passes).

Pass 1 extracts the Fiche AO from the page-anchored corpus. Pass 2 re-reads the
corpus and audits pass 1: it corrects wrong source pages, and nulls out any
value it cannot ground in the text (the anti-hallucination rule — an honest gap
beats a fluent invention, CDC §4/§10).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import Settings
from app.pipeline.schema import FICHE_AO_SCHEMA, empty_fiche

log = logging.getLogger(__name__)

# Feed the decisive pieces first so the char cap never starves them.
_PIECE_PRIORITY = {"RC": 0, "CCAP": 1, "CCTP": 2, "AE": 3, "prix": 4, "annexe": 5, "inconnu": 6}


@dataclass
class CorpusPiece:
    filename: str
    piece_type: str
    pages: list[tuple[int, str]]  # (page_number, text)


def build_corpus(pieces: list[CorpusPiece], max_chars: int) -> str:
    """Format pieces into a page-anchored corpus, capped at ``max_chars``."""
    ordered = sorted(pieces, key=lambda p: _PIECE_PRIORITY.get(p.piece_type, 9))
    chunks: list[str] = []
    total = 0
    for piece in ordered:
        header = f"\n=== FICHIER: {piece.filename} (type: {piece.piece_type}) ===\n"
        chunks.append(header)
        total += len(header)
        for page_number, text in piece.pages:
            marker = f"--- page {page_number} ---\n"
            body = (text or "").strip()
            block = marker + body + "\n"
            if total + len(block) > max_chars:
                chunks.append("--- [corpus tronqué pour limite de contexte] ---\n")
                return "".join(chunks)
            chunks.append(block)
            total += len(block)
    return "".join(chunks)


_EXTRACT_SYSTEM = (
    "Tu es analyste de marchés publics (secteur propreté). À partir du DCE fourni "
    "(texte ancré par fichier et par page), tu produis une Fiche AO structurée en JSON.\n"
    "RÈGLES ABSOLUES:\n"
    "1. N'invente jamais une valeur. Si une information est absente ou incertaine, "
    "mets null (ou une liste vide). Un trou honnête vaut mieux qu'une valeur fausse.\n"
    "2. Chaque champ doté d'un objet `source` doit référencer le fichier et la page "
    "EXACTS d'où provient l'information, tels qu'écrits dans les marqueurs "
    "`=== FICHIER: ... ===` et `--- page N ---`.\n"
    "3. Les pondérations des critères sont des nombres (pourcentages).\n"
    "4. `date_limite_offres` au format ISO-8601 si possible.\n"
    "Réponds uniquement avec le JSON de la Fiche AO."
)

_VERIFY_SYSTEM = (
    "Tu vérifies une Fiche AO déjà extraite d'un DCE. Pour chaque champ:\n"
    "- confirme qu'il est bien étayé par le texte fourni ; sinon mets-le à null "
    "(ou liste vide) — ne complète JAMAIS par déduction.\n"
    "- corrige toute `source` (fichier/page) qui ne correspond pas au passage réel.\n"
    "- corrige les pondérations et dates manifestement erronées.\n"
    "Renvoie la Fiche AO corrigée, même JSON, mêmes clés."
)


def _merge_onto_template(data: dict | None) -> dict:
    """Ensure the result has every top-level Fiche AO key (defensive)."""
    base = empty_fiche()
    if not isinstance(data, dict):
        return base
    base.update({k: v for k, v in data.items() if k in base})
    return base


def extract_fiche(corpus: str, settings: Settings) -> dict:
    """Run the two-pass extraction. Returns a schema-shaped Fiche AO dict."""
    import json

    from app.pipeline.llm import complete_json

    model = settings.llm_model_extraction

    pass1 = complete_json(
        _EXTRACT_SYSTEM,
        f"DCE:\n{corpus}\n\nProduis la Fiche AO en JSON.",
        model=model,
        schema=FICHE_AO_SCHEMA,
        settings=settings,
    )
    fiche = _merge_onto_template(pass1)

    try:
        pass2 = complete_json(
            _VERIFY_SYSTEM,
            f"DCE:\n{corpus}\n\nFiche AO à vérifier:\n{json.dumps(fiche, ensure_ascii=False)}",
            model=model,
            schema=FICHE_AO_SCHEMA,
            settings=settings,
        )
        fiche = _merge_onto_template(pass2)
    except Exception:  # noqa: BLE001 — verification is a bonus, keep pass 1 if it fails
        log.exception("Fiche AO verification pass failed; keeping pass 1")

    return fiche

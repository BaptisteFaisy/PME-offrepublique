"""Fiche AO — the target extraction schema (CDC §4, M1).

The schema is the contract for the two-pass LLM extraction. Every non-trivial
field carries a ``source`` object ({fichier, page}) so the interface can let a
human click through to the exact page and verify — the traceability rule that
turns "the AI read the DCE" into "I can trust it in 15 minutes" (CDC §6).

It is expressed as JSON Schema so it can drive Claude structured outputs
(``output_config.format``). Constraints are kept within the structured-outputs
subset: ``additionalProperties: false`` everywhere, explicit ``required``,
nullability via ``["type", "null"]``, no min/max/format keywords.
"""

from __future__ import annotations

# A source pointer: which file and which 1-indexed page a value was read from.
_SOURCE = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "fichier": {"type": ["string", "null"]},
        "page": {"type": ["integer", "null"]},
    },
    "required": ["fichier", "page"],
}

_SOUS_CRITERE = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "libelle": {"type": ["string", "null"]},
        "ponderation": {"type": ["number", "null"]},
    },
    "required": ["libelle", "ponderation"],
}

FICHE_AO_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "reference": {"type": ["string", "null"]},
        "acheteur": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "nom": {"type": ["string", "null"]},
                "type": {
                    "type": ["string", "null"],
                    "enum": [
                        "commune",
                        "departement",
                        "bailleur",
                        "hopital",
                        "etat",
                        "autre",
                        None,
                    ],
                },
                "profil_acheteur_url": {"type": ["string", "null"]},
            },
            "required": ["nom", "type", "profil_acheteur_url"],
        },
        "objet": {"type": ["string", "null"]},
        "procedure": {
            "type": ["string", "null"],
            "enum": ["MAPA", "appel_offres_ouvert", "autre", None],
        },
        "allotissement": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "num": {"type": ["integer", "null"]},
                    "intitule": {"type": ["string", "null"]},
                    "estimation_eur": {"type": ["number", "null"]},
                    "source": _SOURCE,
                },
                "required": ["num", "intitule", "estimation_eur", "source"],
            },
        },
        # ISO-8601 date/datetime kept as a plain string (no format constraint).
        "date_limite_offres": {"type": ["string", "null"]},
        "visite": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "obligatoire": {"type": ["boolean", "null"]},
                "dates": {"type": "array", "items": {"type": "string"}},
                "contact": {"type": ["string", "null"]},
                "source": _SOURCE,
            },
            "required": ["obligatoire", "dates", "contact", "source"],
        },
        "duree": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "initiale_mois": {"type": ["integer", "null"]},
                "reconductions": {"type": ["integer", "null"]},
                "source": _SOURCE,
            },
            "required": ["initiale_mois", "reconductions", "source"],
        },
        "criteres": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "libelle": {"type": ["string", "null"]},
                    "ponderation": {"type": ["number", "null"]},
                    "sous_criteres": {"type": "array", "items": _SOUS_CRITERE},
                    "source": _SOURCE,
                },
                "required": ["libelle", "ponderation", "sous_criteres", "source"],
            },
        },
        "cadre_reponse_impose": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "present": {"type": ["boolean", "null"]},
                "fichier": {"type": ["string", "null"]},
                "source": _SOURCE,
            },
            "required": ["present", "fichier", "source"],
        },
        "pieces_candidature": {"type": "array", "items": {"type": "string"}},
        "pieces_offre": {"type": "array", "items": {"type": "string"}},
        "exigences_bloquantes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "type": {
                        "type": ["string", "null"],
                        "enum": [
                            "certification",
                            "ca_min",
                            "references",
                            "effectif",
                            "autre",
                            None,
                        ],
                    },
                    "detail": {"type": ["string", "null"]},
                    "source": _SOURCE,
                },
                "required": ["type", "detail", "source"],
            },
        },
        "clauses_notables": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "type": {
                        "type": ["string", "null"],
                        "enum": [
                            "penalite",
                            "revision_prix",
                            "insertion",
                            "reprise_personnel",
                            "rse",
                            "autre",
                            None,
                        ],
                    },
                    "detail": {"type": ["string", "null"]},
                    "source": _SOURCE,
                },
                "required": ["type", "detail", "source"],
            },
        },
        "questions_a_poser": {"type": "array", "items": {"type": "string"}},
        "red_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
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
}


def empty_fiche() -> dict:
    """A schema-shaped Fiche AO with every field null/empty.

    Used as the base the LLM fills in, and as a safe fallback if extraction
    yields nothing.
    """
    return {
        "reference": None,
        "acheteur": {"nom": None, "type": None, "profil_acheteur_url": None},
        "objet": None,
        "procedure": None,
        "allotissement": [],
        "date_limite_offres": None,
        "visite": {"obligatoire": None, "dates": [], "contact": None, "source": {"fichier": None, "page": None}},
        "duree": {"initiale_mois": None, "reconductions": None, "source": {"fichier": None, "page": None}},
        "criteres": [],
        "cadre_reponse_impose": {"present": None, "fichier": None, "source": {"fichier": None, "page": None}},
        "pieces_candidature": [],
        "pieces_offre": [],
        "exigences_bloquantes": [],
        "clauses_notables": [],
        "questions_a_poser": [],
        "red_flags": [],
    }

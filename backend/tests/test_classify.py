"""Filename-rule classification (no LLM needed)."""

from __future__ import annotations

import pytest

from app.pipeline.classify import classify_by_filename


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Règlement de consultation.pdf", "RC"),
        ("RC_2024.pdf", "RC"),
        ("CCAP.pdf", "CCAP"),
        ("Cahier des clauses administratives.pdf", "CCAP"),
        ("CCTP - lot 1.pdf", "CCTP"),
        ("Acte d'engagement.pdf", "AE"),
        ("BPU.xlsx", "prix"),
        ("DPGF_2024.xlsx", "prix"),
        ("Bordereau des prix unitaires.pdf", "prix"),
        ("Annexe 3 - plan de nettoyage.pdf", "annexe"),
        ("Cadre de réponse.docx", "annexe"),
    ],
)
def test_classify_by_filename(filename: str, expected: str) -> None:
    assert classify_by_filename(filename) == expected


@pytest.mark.parametrize("filename", ["12345.pdf", "document final.pdf", "scan001.pdf"])
def test_ambiguous_filenames_return_none(filename: str) -> None:
    assert classify_by_filename(filename) is None

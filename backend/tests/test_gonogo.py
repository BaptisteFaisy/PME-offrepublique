"""Go/No-Go rules (pure functions, no LLM/DB)."""

from __future__ import annotations

from datetime import date, timedelta

from app.pipeline.gonogo import GO, GO_CONDITIONS, NO_GO, evaluate
from app.pipeline.schema import empty_fiche


def _fiche(**overrides) -> dict:
    fiche = empty_fiche()
    fiche.update(overrides)
    return fiche


def test_past_deadline_is_no_go() -> None:
    today = date(2026, 7, 4)
    fiche = _fiche(date_limite_offres=(today - timedelta(days=1)).isoformat())
    result = evaluate(fiche, today=today)
    assert result["decision"] == NO_GO
    assert result["jours_restants"] == -1


def test_clean_future_deadline_is_go() -> None:
    today = date(2026, 7, 4)
    fiche = _fiche(date_limite_offres=(today + timedelta(days=30)).isoformat())
    result = evaluate(fiche, today=today)
    assert result["decision"] == GO


def test_short_deadline_is_conditional() -> None:
    today = date(2026, 7, 4)
    fiche = _fiche(date_limite_offres=(today + timedelta(days=3)).isoformat())
    result = evaluate(fiche, today=today)
    assert result["decision"] == GO_CONDITIONS
    assert any(r["code"] == "delai_court" for r in result["raisons"])


def test_blocking_requirement_without_profile_is_conditional() -> None:
    today = date(2026, 7, 4)
    fiche = _fiche(
        date_limite_offres=(today + timedelta(days=30)).isoformat(),
        exigences_bloquantes=[
            {"type": "certification", "detail": "ISO 9001", "source": {"fichier": "RC.pdf", "page": 4}}
        ],
    )
    result = evaluate(fiche, today=today)
    assert result["decision"] == GO_CONDITIONS
    assert any(r["code"] == "exigence_a_verifier" for r in result["raisons"])


def test_unmet_ca_requirement_with_profile_is_no_go() -> None:
    today = date(2026, 7, 4)
    fiche = _fiche(
        date_limite_offres=(today + timedelta(days=30)).isoformat(),
        exigences_bloquantes=[
            {"type": "ca_min", "detail": "CA min 1M€", "montant_eur": 1_000_000,
             "source": {"fichier": "RC.pdf", "page": 2}}
        ],
    )
    result = evaluate(fiche, today=today, client_profile={"ca_eur": 500_000})
    assert result["decision"] == NO_GO

"""Claude API access for the M1 pipeline.

Thin wrapper around the Anthropic Python SDK. Two entry points:
- ``complete_text`` — short free-text answer (piece classification).
- ``complete_json`` — schema-constrained JSON (Fiche AO extraction), using
  structured outputs (``output_config.format``) with a prompt-only fallback if
  the model/schema pairing rejects the constraint.

Model choice comes from settings; the CDC picks Sonnet for cost/quality.
Thinking is disabled by default to keep the per-DCE cost under the CDC budget
(< 3 € LLM+OCR); raise via ``effort`` if accuracy needs it.
"""

from __future__ import annotations

import json
import logging
import re
from functools import lru_cache

from app.config import Settings, get_settings

log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the LLM is unusable (missing key, unrecoverable API error)."""


@lru_cache
def get_client():
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise LLMError(
            "ANTHROPIC_API_KEY manquant — l'extraction Fiche AO nécessite la clé Claude."
        )
    import anthropic

    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _response_text(message) -> str:
    return "".join(
        block.text for block in message.content if getattr(block, "type", None) == "text"
    )


def _parse_json(text: str) -> dict:
    """Parse a JSON object out of a model response (tolerates code fences)."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def complete_text(
    system: str,
    user: str,
    *,
    model: str,
    settings: Settings | None = None,
    max_tokens: int = 64,
) -> str:
    settings = settings or get_settings()
    message = get_client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        thinking={"type": "disabled"},
        messages=[{"role": "user", "content": user}],
    )
    return _response_text(message).strip()


def complete_json(
    system: str,
    user: str,
    *,
    model: str,
    schema: dict | None = None,
    settings: Settings | None = None,
) -> dict:
    settings = settings or get_settings()
    client = get_client()

    base_kwargs = {
        "model": model,
        "max_tokens": settings.llm_max_tokens,
        "system": system,
        "thinking": {"type": "disabled"},
        "messages": [{"role": "user", "content": user}],
    }

    if schema is not None:
        try:
            message = client.messages.create(
                **base_kwargs,
                output_config={
                    "effort": settings.llm_effort,
                    "format": {"type": "json_schema", "schema": schema},
                },
            )
            return _parse_json(_response_text(message))
        except Exception as exc:  # noqa: BLE001 — fall back to prompt-only JSON
            import anthropic

            if not isinstance(exc, anthropic.BadRequestError):
                raise
            log.warning("structured outputs rejected (%s); retrying prompt-only", exc)

    message = client.messages.create(
        **base_kwargs,
        output_config={"effort": settings.llm_effort},
    )
    return _parse_json(_response_text(message))

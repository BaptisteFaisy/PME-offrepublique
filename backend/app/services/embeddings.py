"""Embedding providers for the M2 RAG corpus."""

from __future__ import annotations

import hashlib
import json
import math
import urllib.error
import urllib.request
from collections.abc import Sequence

from app.config import Settings, get_settings


class EmbeddingError(RuntimeError):
    """Raised when embeddings cannot be generated or validated."""


def embed_texts(texts: Sequence[str], settings: Settings | None = None) -> list[list[float]]:
    """Return one embedding per text using the configured provider."""
    settings = settings or get_settings()
    cleaned = [text.strip() for text in texts]
    if any(not text for text in cleaned):
        raise EmbeddingError("Impossible de vectoriser un texte vide")

    provider = settings.embedding_provider.lower().strip()
    if provider == "openai":
        return _openai_embeddings(cleaned, settings)
    if provider == "deterministic":
        return [_deterministic_embedding(text, settings.embedding_dimensions) for text in cleaned]
    raise EmbeddingError(f"Provider embeddings non supporte: {settings.embedding_provider}")


def _openai_embeddings(texts: Sequence[str], settings: Settings) -> list[list[float]]:
    if not settings.openai_api_key:
        raise EmbeddingError("OPENAI_API_KEY manquant pour generer les embeddings")

    results: list[list[float]] = []
    for start in range(0, len(texts), settings.embedding_batch_size):
        batch = list(texts[start : start + settings.embedding_batch_size])
        payload = {
            "model": settings.embedding_model,
            "input": batch,
            "encoding_format": "float",
            "dimensions": settings.embedding_dimensions,
        }
        response = _post_json(
            f"{settings.openai_base_url.rstrip('/')}/embeddings",
            payload,
            bearer_token=settings.openai_api_key,
        )
        data = sorted(response.get("data", []), key=lambda item: item.get("index", 0))
        if len(data) != len(batch):
            raise EmbeddingError("Reponse embeddings incomplete")
        for item in data:
            vector = item.get("embedding")
            if not isinstance(vector, list):
                raise EmbeddingError("Reponse embeddings invalide")
            _validate_dimensions(vector, settings.embedding_dimensions)
            results.append([float(value) for value in vector])
    return results


def _post_json(url: str, payload: dict, *, bearer_token: str) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise EmbeddingError(f"Erreur embeddings HTTP {exc.code}: {detail}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise EmbeddingError(f"Erreur embeddings: {exc}") from exc


def _deterministic_embedding(text: str, dimensions: int) -> list[float]:
    """Stable non-semantic embedding for tests and local smoke paths only."""
    values: list[float] = []
    seed = hashlib.sha256(text.encode("utf-8")).digest()
    counter = 0
    while len(values) < dimensions:
        digest = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        values.extend((byte / 127.5) - 1.0 for byte in digest)
        counter += 1
    vector = values[:dimensions]
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _validate_dimensions(vector: Sequence[float], expected: int) -> None:
    if len(vector) != expected:
        raise EmbeddingError(
            f"Dimension embedding invalide: {len(vector)} recue, {expected} attendue"
        )

"""Health / readiness endpoints — no auth, used by compose healthchecks & the front."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import engine
from app.workers.queue import get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Liveness — the process is up."""
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict:
    """Readiness — dependencies (Postgres, Redis) reachable."""
    checks: dict[str, str] = {}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["postgres"] = f"error: {exc}"

    try:
        get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = f"error: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}

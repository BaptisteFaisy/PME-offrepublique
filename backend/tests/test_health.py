"""Socle smoke tests — no external services required.

The liveness endpoint is pure, so importing the app and hitting /health proves
the FastAPI wiring (settings, routers, app factory) is coherent.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_openapi_exposes_dce_upload() -> None:
    """The M1 ingestion route is registered."""
    schema = client.get("/openapi.json").json()
    assert "/dce" in schema["paths"]
    assert "post" in schema["paths"]["/dce"]

"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import dce, health
from app.config import get_settings
from app.logging_config import setup_logging


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="Usine à dossiers AO — API interne",
        version=__version__,
        summary="Backend interne de production de réponses aux appels d'offres.",
    )

    # Internal tool: the Next.js front runs on localhost in dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(dce.router)

    return app


app = create_app()

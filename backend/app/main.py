"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import auth, dce, health
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

    # The Next.js console calls the API cross-origin (localhost in dev, the
    # presentation site's domain in prod via the /dce zone). Origins are
    # env-driven — see CORS_ALLOW_ORIGINS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(dce.router)

    return app


app = create_app()

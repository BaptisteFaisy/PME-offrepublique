"""Basic-auth dependency.

The CDC is explicit: two internal users, no self-serve onboarding. HTTP Basic
against a small env-configured credential map is plenty for the MVP. Swap for
sessions/OAuth only if the user base ever grows beyond "nous deux".
"""

from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.config import Settings, get_settings

_basic = HTTPBasic()


def require_user(
    credentials: HTTPBasicCredentials = Depends(_basic),
    settings: Settings = Depends(get_settings),
) -> str:
    """Return the authenticated username or raise 401."""
    expected = settings.auth_credentials().get(credentials.username)
    # constant-time compare; guard against unknown user (expected is None)
    ok = expected is not None and secrets.compare_digest(credentials.password, expected)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

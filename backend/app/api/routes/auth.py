"""Auth endpoint for the internal console.

The MVP is gated: the console is reachable only at its own URL and, on load,
verifies credentials against this endpoint before showing anything. Credentials
are the same HTTP Basic users as the rest of the API (CDC: "nous deux").
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import require_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
def me(user: str = Depends(require_user)) -> dict:
    """Return the authenticated username, or 401. Used by the login gate."""
    return {"user": user}

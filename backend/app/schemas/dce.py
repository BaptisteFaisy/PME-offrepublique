"""API schemas for the M1 ingestion endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DceUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    status: str
    error: str | None = None
    created_at: datetime


class DceUploadAccepted(BaseModel):
    """Returned by POST /dce — the job is queued, not done."""

    upload_id: str
    status: str
    job_id: str


class PieceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    piece_type: str
    page_count: int


class PageOut(BaseModel):
    """Page-anchored text — the click-through target for source verification."""

    model_config = ConfigDict(from_attributes=True)

    piece_id: str
    page_number: int
    text: str
    ocr_used: bool


class FicheOut(BaseModel):
    """The structured Fiche AO + go/no-go for an upload."""

    upload_id: str
    status: str
    fiche: dict[str, Any]
    gonogo: dict[str, Any]
    warnings: list[str]
    model: str | None = None

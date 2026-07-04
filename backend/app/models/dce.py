"""M1 ingestion models.

Upload -> pieces -> page-anchored text -> Fiche AO. The traceability rule from
the CDC (§6): every extracted field points back to its source (file + page).
``DcePage`` is that anchor; ``DceFiche`` stores the structured extraction whose
values reference those pages.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

# Coarse piece classification from the CDC pipeline (RC / CCAP / CCTP / AE / prix / annexe).
PIECE_TYPES = ("RC", "CCAP", "CCTP", "AE", "prix", "annexe", "inconnu")

# Upload lifecycle.
UPLOAD_STATUSES = ("received", "processing", "ready", "failed")


class DceUpload(Base, TimestampMixin):
    """One uploaded DCE (a ZIP or a set of loose files)."""

    __tablename__ = "dce_upload"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="received", nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    pieces: Mapped[list["DcePiece"]] = relationship(
        back_populates="upload", cascade="all, delete-orphan"
    )
    fiche: Mapped["DceFiche | None"] = relationship(
        back_populates="upload", cascade="all, delete-orphan", uselist=False
    )


class DcePiece(Base, TimestampMixin):
    """A single document extracted from the upload, after classification."""

    __tablename__ = "dce_piece"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    upload_id: Mapped[str] = mapped_column(
        ForeignKey("dce_upload.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    piece_type: Mapped[str] = mapped_column(String(16), default="inconnu", nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    upload: Mapped["DceUpload"] = relationship(back_populates="pieces")
    pages: Mapped[list["DcePage"]] = relationship(
        back_populates="piece", cascade="all, delete-orphan"
    )


class DcePage(Base):
    """Page-anchored normalized text — the traceability backbone."""

    __tablename__ = "dce_page"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    piece_id: Mapped[str] = mapped_column(
        ForeignKey("dce_piece.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Was this page read via OCR (vs native text extraction)?
    ocr_used: Mapped[bool] = mapped_column(default=False, nullable=False)

    piece: Mapped["DcePiece"] = relationship(back_populates="pages")


class DceFiche(Base, TimestampMixin):
    """Structured Fiche AO + go/no-go for one upload (CDC §4, M1).

    ``fiche`` and ``gonogo`` are stored as JSONB: the shape is the Fiche AO
    schema (see ``app.pipeline.schema``), including inline per-field sources.
    """

    __tablename__ = "dce_fiche"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    upload_id: Mapped[str] = mapped_column(
        ForeignKey("dce_upload.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    fiche: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    gonogo: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Free-form warnings surfaced during ingestion (unreadable pages, etc.).
    warnings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    upload: Mapped["DceUpload"] = relationship(back_populates="fiche")

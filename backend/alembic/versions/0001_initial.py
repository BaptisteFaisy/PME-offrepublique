"""initial schema: pgvector extension + M1 ingestion tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-04
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pgvector is used later for the client KB (M2 RAG); enable it up front.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "dce_upload",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("original_filename", sa.String(length=512), nullable=False),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="received"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "dce_piece",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("upload_id", sa.String(length=36), sa.ForeignKey("dce_upload.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("piece_type", sa.String(length=16), nullable=False, server_default="inconnu"),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dce_piece_upload_id", "dce_piece", ["upload_id"])

    op.create_table(
        "dce_page",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("piece_id", sa.String(length=36), sa.ForeignKey("dce_piece.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("ocr_used", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_dce_page_piece_id", "dce_page", ["piece_id"])


def downgrade() -> None:
    op.drop_index("ix_dce_page_piece_id", table_name="dce_page")
    op.drop_table("dce_page")
    op.drop_index("ix_dce_piece_upload_id", table_name="dce_piece")
    op.drop_table("dce_piece")
    op.drop_table("dce_upload")

"""M1 Fiche AO: dce_fiche table (structured extraction + go/no-go)

Revision ID: 0002_fiche
Revises: 0001_initial
Create Date: 2026-07-04
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_fiche"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dce_fiche",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "upload_id",
            sa.String(length=36),
            sa.ForeignKey("dce_upload.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fiche", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("gonogo", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("warnings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dce_fiche_upload_id", "dce_fiche", ["upload_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_dce_fiche_upload_id", table_name="dce_fiche")
    op.drop_table("dce_fiche")

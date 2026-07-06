"""M2 client knowledge base

Revision ID: 0003_kb
Revises: 0002_fiche
Create Date: 2026-07-05
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_kb"
down_revision: str | None = "0002_fiche"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "kb_client",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("siren", sa.String(length=9), nullable=True),
        sa.Column("kbis_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("kbis_issued_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_timestamps(),
    )
    op.create_unique_constraint("uq_kb_client_siren", "kb_client", ["siren"])

    op.create_table(
        "kb_financial_exercise",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.Column("revenue_eur", sa.Numeric(14, 2), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("revenue_eur >= 0", name="ck_kb_financial_revenue_positive"),
        sa.UniqueConstraint("client_id", "fiscal_year", name="uq_kb_financial_client_year"),
    )
    op.create_index("ix_kb_financial_exercise_client_id", "kb_financial_exercise", ["client_id"])

    op.create_table(
        "kb_headcount_snapshot",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("total_headcount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("supervisors_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("operations_staff_count", sa.Integer(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("total_headcount >= 0", name="ck_kb_headcount_total_positive"),
        sa.CheckConstraint(
            "supervisors_count >= 0",
            name="ck_kb_headcount_supervisors_positive",
        ),
        sa.UniqueConstraint("client_id", "label", name="uq_kb_headcount_client_label"),
    )
    op.create_index("ix_kb_headcount_snapshot_client_id", "kb_headcount_snapshot", ["client_id"])

    op.create_table(
        "kb_product_material",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("brand", sa.String(length=255), nullable=True),
        sa.Column("quantity", sa.String(length=64), nullable=True),
        sa.Column("use_case", sa.Text(), nullable=True),
        sa.Column("ecolabels", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("technical_sheet_s3_key", sa.String(length=1024), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "category in ('produit', 'materiel')",
            name="ck_kb_product_material_category",
        ),
    )
    op.create_index("ix_kb_product_material_client_id", "kb_product_material", ["client_id"])

    op.create_table(
        "kb_certification",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("issuer", sa.String(length=255), nullable=True),
        sa.Column("document_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("obtained_on", sa.Date(), nullable=True),
        sa.Column("expires_on", sa.Date(), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_kb_certification_client_id", "kb_certification", ["client_id"])
    op.create_index("ix_kb_certification_expires_on", "kb_certification", ["expires_on"])

    op.create_table(
        "kb_insurance",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("insurance_type", sa.String(length=128), nullable=False),
        sa.Column("provider", sa.String(length=255), nullable=True),
        sa.Column("policy_number", sa.String(length=128), nullable=True),
        sa.Column("coverage_summary", sa.Text(), nullable=True),
        sa.Column("document_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("expires_on", sa.Date(), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_kb_insurance_client_id", "kb_insurance", ["client_id"])
    op.create_index("ix_kb_insurance_expires_on", "kb_insurance", ["expires_on"])

    op.create_table(
        "kb_market_reference",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reference_client", sa.String(length=255), nullable=False),
        sa.Column("object", sa.Text(), nullable=False),
        sa.Column("amount_eur", sa.Numeric(14, 2), nullable=True),
        sa.Column("duration_months", sa.Integer(), nullable=True),
        sa.Column("assigned_headcount", sa.Integer(), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("contact_phone", sa.String(length=64), nullable=True),
        sa.Column("service_type", sa.String(length=128), nullable=True),
        sa.Column("measurable_results", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_kb_market_reference_client_id", "kb_market_reference", ["client_id"])
    op.create_index(
        "ix_kb_market_reference_service_type",
        "kb_market_reference",
        ["service_type"],
    )

    op.create_table(
        "kb_supervisor",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=128), nullable=True),
        sa.Column("years_experience", sa.Integer(), nullable=True),
        sa.Column("cv_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("habilitations", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_kb_supervisor_client_id", "kb_supervisor", ["client_id"])

    op.create_table(
        "kb_qse_rse_policy",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("policy_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("document_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("updated_on", sa.Date(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "policy_type in ('QSE', 'RSE', 'QSE_RSE', 'autre')",
            name="ck_kb_qse_rse_policy_type",
        ),
    )
    op.create_index("ix_kb_qse_rse_policy_client_id", "kb_qse_rse_policy", ["client_id"])

    op.create_table(
        "kb_staff_transfer_note",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("convention_article", sa.String(length=64), nullable=False),
        sa.Column("staff_count", sa.Integer(), nullable=True),
        sa.Column("obligations_summary", sa.Text(), nullable=True),
        sa.Column("commercial_argument", sa.Text(), nullable=False),
        sa.Column("risk_notes", sa.Text(), nullable=True),
        sa.Column("assumptions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
    )
    op.create_index(
        "ix_kb_staff_transfer_note_client_id",
        "kb_staff_transfer_note",
        ["client_id"],
    )

    op.create_table(
        "kb_cleaning_plan",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("site_type", sa.String(length=128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_kb_cleaning_plan_client_id", "kb_cleaning_plan", ["client_id"])
    op.create_index("ix_kb_cleaning_plan_site_type", "kb_cleaning_plan", ["site_type"])

    op.create_table(
        "kb_cleaning_plan_zone",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "cleaning_plan_id",
            sa.String(length=36),
            sa.ForeignKey("kb_cleaning_plan.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("zone", sa.String(length=255), nullable=False),
        sa.Column("frequency", sa.String(length=128), nullable=False),
        sa.Column("operating_mode", sa.Text(), nullable=False),
        sa.Column("products", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("materials", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
    )
    op.create_index(
        "ix_kb_cleaning_plan_zone_cleaning_plan_id",
        "kb_cleaning_plan_zone",
        ["cleaning_plan_id"],
    )

    op.create_table(
        "kb_corpus_document",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("service_type", sa.String(length=128), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False, server_default="inconnu"),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column("s3_key", sa.String(length=1024), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "source_type in ('memoire_technique', 'plaquette', 'procedure_interne', 'autre')",
            name="ck_kb_corpus_document_source_type",
        ),
        sa.CheckConstraint(
            "outcome in ('gagne', 'perdu', 'inconnu')",
            name="ck_kb_corpus_document_outcome",
        ),
        sa.UniqueConstraint("id", "client_id", name="uq_kb_corpus_document_id_client"),
    )
    op.create_index("ix_kb_corpus_document_client_id", "kb_corpus_document", ["client_id"])
    op.create_index("ix_kb_corpus_document_service_type", "kb_corpus_document", ["service_type"])

    op.create_table(
        "kb_corpus_chunk",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("kb_client.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column("service_type", sa.String(length=128), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["document_id", "client_id"],
            ["kb_corpus_document.id", "kb_corpus_document.client_id"],
            ondelete="CASCADE",
            name="fk_kb_corpus_chunk_document_client",
        ),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_kb_corpus_chunk_doc_index"),
    )
    op.create_index("ix_kb_corpus_chunk_client_id", "kb_corpus_chunk", ["client_id"])
    op.create_index("ix_kb_corpus_chunk_document_id", "kb_corpus_chunk", ["document_id"])
    op.create_index(
        "ix_kb_corpus_chunk_client_service",
        "kb_corpus_chunk",
        ["client_id", "service_type"],
    )
    op.execute(
        "CREATE INDEX ix_kb_corpus_chunk_embedding "
        "ON kb_corpus_chunk USING hnsw (embedding vector_cosine_ops) "
        "WHERE embedding IS NOT NULL"
    )

    op.create_table(
        "kb_internal_library_document",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("service_type", sa.String(length=128), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column("s3_key", sa.String(length=1024), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.CheckConstraint(
            "source_type in ('trame_generique', 'clause_type', 'modele_section', 'autre')",
            name="ck_kb_internal_library_document_source_type",
        ),
    )
    op.create_index(
        "ix_kb_internal_library_document_is_active",
        "kb_internal_library_document",
        ["is_active"],
    )
    op.create_index(
        "ix_kb_internal_library_document_service_type",
        "kb_internal_library_document",
        ["service_type"],
    )

    op.create_table(
        "kb_internal_library_chunk",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(length=36),
            sa.ForeignKey("kb_internal_library_document.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column("service_type", sa.String(length=128), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_kb_internal_chunk_doc_index"),
    )
    op.create_index(
        "ix_kb_internal_library_chunk_document_id",
        "kb_internal_library_chunk",
        ["document_id"],
    )
    op.create_index(
        "ix_kb_internal_chunk_service",
        "kb_internal_library_chunk",
        ["service_type"],
    )
    op.execute(
        "CREATE INDEX ix_kb_internal_library_chunk_embedding "
        "ON kb_internal_library_chunk USING hnsw (embedding vector_cosine_ops) "
        "WHERE embedding IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_kb_internal_library_chunk_embedding")
    op.drop_index("ix_kb_internal_chunk_service", table_name="kb_internal_library_chunk")
    op.drop_index(
        "ix_kb_internal_library_chunk_document_id",
        table_name="kb_internal_library_chunk",
    )
    op.drop_table("kb_internal_library_chunk")
    op.drop_index(
        "ix_kb_internal_library_document_service_type",
        table_name="kb_internal_library_document",
    )
    op.drop_index(
        "ix_kb_internal_library_document_is_active",
        table_name="kb_internal_library_document",
    )
    op.drop_table("kb_internal_library_document")
    op.execute("DROP INDEX IF EXISTS ix_kb_corpus_chunk_embedding")
    op.drop_index("ix_kb_corpus_chunk_client_service", table_name="kb_corpus_chunk")
    op.drop_index("ix_kb_corpus_chunk_document_id", table_name="kb_corpus_chunk")
    op.drop_index("ix_kb_corpus_chunk_client_id", table_name="kb_corpus_chunk")
    op.drop_table("kb_corpus_chunk")
    op.drop_index("ix_kb_corpus_document_service_type", table_name="kb_corpus_document")
    op.drop_index("ix_kb_corpus_document_client_id", table_name="kb_corpus_document")
    op.drop_table("kb_corpus_document")
    op.drop_index(
        "ix_kb_cleaning_plan_zone_cleaning_plan_id",
        table_name="kb_cleaning_plan_zone",
    )
    op.drop_table("kb_cleaning_plan_zone")
    op.drop_index("ix_kb_cleaning_plan_site_type", table_name="kb_cleaning_plan")
    op.drop_index("ix_kb_cleaning_plan_client_id", table_name="kb_cleaning_plan")
    op.drop_table("kb_cleaning_plan")
    op.drop_index("ix_kb_staff_transfer_note_client_id", table_name="kb_staff_transfer_note")
    op.drop_table("kb_staff_transfer_note")
    op.drop_index("ix_kb_qse_rse_policy_client_id", table_name="kb_qse_rse_policy")
    op.drop_table("kb_qse_rse_policy")
    op.drop_index("ix_kb_supervisor_client_id", table_name="kb_supervisor")
    op.drop_table("kb_supervisor")
    op.drop_index("ix_kb_market_reference_service_type", table_name="kb_market_reference")
    op.drop_index("ix_kb_market_reference_client_id", table_name="kb_market_reference")
    op.drop_table("kb_market_reference")
    op.drop_index("ix_kb_insurance_expires_on", table_name="kb_insurance")
    op.drop_index("ix_kb_insurance_client_id", table_name="kb_insurance")
    op.drop_table("kb_insurance")
    op.drop_index("ix_kb_certification_expires_on", table_name="kb_certification")
    op.drop_index("ix_kb_certification_client_id", table_name="kb_certification")
    op.drop_table("kb_certification")
    op.drop_index("ix_kb_product_material_client_id", table_name="kb_product_material")
    op.drop_table("kb_product_material")
    op.drop_index("ix_kb_headcount_snapshot_client_id", table_name="kb_headcount_snapshot")
    op.drop_table("kb_headcount_snapshot")
    op.drop_index("ix_kb_financial_exercise_client_id", table_name="kb_financial_exercise")
    op.drop_table("kb_financial_exercise")
    op.drop_constraint("uq_kb_client_siren", "kb_client", type_="unique")
    op.drop_table("kb_client")

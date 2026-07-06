"""M2 client knowledge base models.

The client KB is intentionally split into two storage layers:

* structured profile tables, edited through forms or imports;
* RAG corpus tables with pgvector embeddings.

Client documents/chunks and internal library documents/chunks live in separate
tables. That schema split is deliberate: pilots in the same market are
competitors, so client retrieval can only join client-scoped corpus rows plus
our own generic library.
"""

from __future__ import annotations

from datetime import date

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

EMBEDDING_DIMENSIONS = 1536

CORPUS_SOURCE_TYPES = ("memoire_technique", "plaquette", "procedure_interne", "autre")
CORPUS_OUTCOMES = ("gagne", "perdu", "inconnu")
LIBRARY_SOURCE_TYPES = ("trame_generique", "clause_type", "modele_section", "autre")
QSE_RSE_POLICY_TYPES = ("QSE", "RSE", "QSE_RSE", "autre")
PRODUCT_MATERIAL_CATEGORIES = ("produit", "materiel")


class KbClient(Base, TimestampMixin):
    """One strictly isolated pilot client knowledge base."""

    __tablename__ = "kb_client"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    siren: Mapped[str | None] = mapped_column(String(9), nullable=True, unique=True)
    kbis_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    kbis_issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    financials: Mapped[list[KbFinancialExercise]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    headcounts: Mapped[list[KbHeadcountSnapshot]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    product_materials: Mapped[list[KbProductMaterial]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    certifications: Mapped[list[KbCertification]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    insurances: Mapped[list[KbInsurance]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    market_references: Mapped[list[KbMarketReference]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    supervisors: Mapped[list[KbSupervisor]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    qse_rse_policies: Mapped[list[KbQseRsePolicy]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    staff_transfer_notes: Mapped[list[KbStaffTransferNote]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    cleaning_plans: Mapped[list[KbCleaningPlan]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )
    corpus_documents: Mapped[list[KbCorpusDocument]] = relationship(
        back_populates="client", cascade="all, delete-orphan"
    )


class KbFinancialExercise(Base, TimestampMixin):
    """Revenue for one fiscal year; expected to keep the last three exercises."""

    __tablename__ = "kb_financial_exercise"
    __table_args__ = (
        UniqueConstraint("client_id", "fiscal_year", name="uq_kb_financial_client_year"),
        CheckConstraint("revenue_eur >= 0", name="ck_kb_financial_revenue_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue_eur: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    client: Mapped[KbClient] = relationship(back_populates="financials")


class KbHeadcountSnapshot(Base, TimestampMixin):
    """Staffing and management snapshot for a fiscal year or import date."""

    __tablename__ = "kb_headcount_snapshot"
    __table_args__ = (
        UniqueConstraint("client_id", "label", name="uq_kb_headcount_client_label"),
        CheckConstraint("total_headcount >= 0", name="ck_kb_headcount_total_positive"),
        CheckConstraint("supervisors_count >= 0", name="ck_kb_headcount_supervisors_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    total_headcount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    supervisors_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    operations_staff_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    client: Mapped[KbClient] = relationship(back_populates="headcounts")


class KbProductMaterial(Base, TimestampMixin):
    """Cleaning products and material grid, including ecolabels when relevant."""

    __tablename__ = "kb_product_material"
    __table_args__ = (
        CheckConstraint(
            "category in ('produit', 'materiel')", name="ck_kb_product_material_category"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    use_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    ecolabels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    technical_sheet_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    client: Mapped[KbClient] = relationship(back_populates="product_materials")


class KbCertification(Base, TimestampMixin):
    """Certifications and labels, with file proof and expiration date."""

    __tablename__ = "kb_certification"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    issuer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    document_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    obtained_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    client: Mapped[KbClient] = relationship(back_populates="certifications")


class KbInsurance(Base, TimestampMixin):
    """Insurance policies and certificates."""

    __tablename__ = "kb_insurance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    insurance_type: Mapped[str] = mapped_column(String(128), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    policy_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    coverage_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    client: Mapped[KbClient] = relationship(back_populates="insurances")


class KbMarketReference(Base, TimestampMixin):
    """Reusable market reference card for proposals."""

    __tablename__ = "kb_market_reference"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reference_client: Mapped[str] = mapped_column(String(255), nullable=False)
    object: Mapped[str] = mapped_column(Text, nullable=False)
    amount_eur: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    duration_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    measurable_results: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    client: Mapped[KbClient] = relationship(back_populates="market_references")


class KbSupervisor(Base, TimestampMixin):
    """Supervisors, CV files and habilitations."""

    __tablename__ = "kb_supervisor"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str | None] = mapped_column(String(128), nullable=True)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cv_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    habilitations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    client: Mapped[KbClient] = relationship(back_populates="supervisors")


class KbQseRsePolicy(Base, TimestampMixin):
    """QSE/RSE policy snippets and source files."""

    __tablename__ = "kb_qse_rse_policy"
    __table_args__ = (
        CheckConstraint(
            "policy_type in ('QSE', 'RSE', 'QSE_RSE', 'autre')", name="ck_kb_qse_rse_policy_type"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    updated_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    client: Mapped[KbClient] = relationship(back_populates="qse_rse_policies")


class KbStaffTransferNote(Base, TimestampMixin):
    """Article 7 reprise du personnel arguments and assumptions."""

    __tablename__ = "kb_staff_transfer_note"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    convention_article: Mapped[str] = mapped_column(
        String(64), default="Article 7", nullable=False
    )
    staff_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    obligations_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    commercial_argument: Mapped[str] = mapped_column(Text, nullable=False)
    risk_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assumptions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    client: Mapped[KbClient] = relationship(back_populates="staff_transfer_notes")


class KbCleaningPlan(Base, TimestampMixin):
    """Typical cleaning plan containing zone x frequency x method rows."""

    __tablename__ = "kb_cleaning_plan"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    site_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped[KbClient] = relationship(back_populates="cleaning_plans")
    zones: Mapped[list[KbCleaningPlanZone]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class KbCleaningPlanZone(Base, TimestampMixin):
    """One zone/frequency/method row within a typical cleaning plan."""

    __tablename__ = "kb_cleaning_plan_zone"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    cleaning_plan_id: Mapped[str] = mapped_column(
        ForeignKey("kb_cleaning_plan.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zone: Mapped[str] = mapped_column(String(255), nullable=False)
    frequency: Mapped[str] = mapped_column(String(128), nullable=False)
    operating_mode: Mapped[str] = mapped_column(Text, nullable=False)
    products: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    materials: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    plan: Mapped[KbCleaningPlan] = relationship(back_populates="zones")


class KbCorpusDocument(Base, TimestampMixin):
    """Client-owned source document used for client-specific RAG."""

    __tablename__ = "kb_corpus_document"
    __table_args__ = (
        UniqueConstraint("id", "client_id", name="uq_kb_corpus_document_id_client"),
        CheckConstraint(
            "source_type in ('memoire_technique', 'plaquette', 'procedure_interne', 'autre')",
            name="ck_kb_corpus_document_source_type",
        ),
        CheckConstraint(
            "outcome in ('gagne', 'perdu', 'inconnu')", name="ck_kb_corpus_document_outcome"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), default="inconnu", nullable=False)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    client: Mapped[KbClient] = relationship(back_populates="corpus_documents")
    chunks: Mapped[list[KbCorpusChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KbCorpusChunk(Base, TimestampMixin):
    """Semantic chunk for a client document.

    ``client_id`` is duplicated from the parent document so every retrieval
    query can filter at the chunk table before joining any other table. The
    composite FK guarantees a chunk cannot point to a document owned by another
    client.
    """

    __tablename__ = "kb_corpus_chunk"
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "client_id"],
            ["kb_corpus_document.id", "kb_corpus_document.client_id"],
            ondelete="CASCADE",
            name="fk_kb_corpus_chunk_document_client",
        ),
        UniqueConstraint("document_id", "chunk_index", name="uq_kb_corpus_chunk_doc_index"),
        Index("ix_kb_corpus_chunk_client_service", "client_id", "service_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    client_id: Mapped[str] = mapped_column(
        ForeignKey("kb_client.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    document: Mapped[KbCorpusDocument] = relationship(back_populates="chunks")


class KbInternalLibraryDocument(Base, TimestampMixin):
    """Generic internal material shared across clients.

    This table must never contain pilot-client data. It is the only corpus
    surface allowed to be retrieved alongside a client KB.
    """

    __tablename__ = "kb_internal_library_document"
    __table_args__ = (
        CheckConstraint(
            "source_type in ('trame_generique', 'clause_type', 'modele_section', 'autre')",
            name="ck_kb_internal_library_document_source_type",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    s3_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    chunks: Mapped[list[KbInternalLibraryChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KbInternalLibraryChunk(Base, TimestampMixin):
    """Semantic chunk for generic internal library content."""

    __tablename__ = "kb_internal_library_chunk"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_kb_internal_chunk_doc_index"),
        Index("ix_kb_internal_chunk_service", "service_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("kb_internal_library_document.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    document: Mapped[KbInternalLibraryDocument] = relationship(back_populates="chunks")

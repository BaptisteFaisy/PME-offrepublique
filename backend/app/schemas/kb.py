"""API schemas for the M2 client knowledge base."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.kb import (
    CORPUS_OUTCOMES,
    CORPUS_SOURCE_TYPES,
    EMBEDDING_DIMENSIONS,
    LIBRARY_SOURCE_TYPES,
    PRODUCT_MATERIAL_CATEGORIES,
    QSE_RSE_POLICY_TYPES,
)

CorpusSourceType = Literal["memoire_technique", "plaquette", "procedure_interne", "autre"]
CorpusOutcome = Literal["gagne", "perdu", "inconnu"]
LibrarySourceType = Literal["trame_generique", "clause_type", "modele_section", "autre"]
QseRsePolicyType = Literal["QSE", "RSE", "QSE_RSE", "autre"]
ProductMaterialCategory = Literal["produit", "materiel"]


class KbClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    siren: str | None = Field(default=None, min_length=9, max_length=9)
    kbis_s3_key: str | None = None
    kbis_issued_on: date | None = None
    notes: str | None = None

    @field_validator("siren", mode="before")
    @classmethod
    def validate_siren(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().replace(" ", "")
        if not normalized.isdigit() or len(normalized) != 9:
            raise ValueError("Le SIREN doit contenir exactement 9 chiffres")
        return normalized


class KbClientCreate(KbClientBase):
    pass


class KbClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    siren: str | None = Field(default=None, min_length=9, max_length=9)
    kbis_s3_key: str | None = None
    kbis_issued_on: date | None = None
    notes: str | None = None

    @field_validator("siren", mode="before")
    @classmethod
    def validate_siren(cls, value: str | None) -> str | None:
        return KbClientBase.validate_siren(value)


class KbClientOut(KbClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class FinancialExerciseIn(BaseModel):
    fiscal_year: int = Field(ge=1900, le=2200)
    revenue_eur: float = Field(ge=0)


class FinancialExerciseOut(FinancialExerciseIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class HeadcountSnapshotIn(BaseModel):
    label: str = Field(min_length=1, max_length=64)
    total_headcount: int = Field(default=0, ge=0)
    supervisors_count: int = Field(default=0, ge=0)
    operations_staff_count: int | None = Field(default=None, ge=0)
    details: dict[str, Any] = Field(default_factory=dict)


class HeadcountSnapshotOut(HeadcountSnapshotIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class ProductMaterialIn(BaseModel):
    category: ProductMaterialCategory
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = None
    quantity: str | None = None
    use_case: str | None = None
    ecolabels: list[str] = Field(default_factory=list)
    technical_sheet_s3_key: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: ProductMaterialCategory) -> ProductMaterialCategory:
        if value not in PRODUCT_MATERIAL_CATEGORIES:
            raise ValueError("Categorie produit/materiel invalide")
        return value


class ProductMaterialOut(ProductMaterialIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class CertificationIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    issuer: str | None = None
    document_s3_key: str | None = None
    obtained_on: date | None = None
    expires_on: date | None = None


class CertificationOut(CertificationIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class InsuranceIn(BaseModel):
    insurance_type: str = Field(min_length=1, max_length=128)
    provider: str | None = None
    policy_number: str | None = None
    coverage_summary: str | None = None
    document_s3_key: str | None = None
    expires_on: date | None = None


class InsuranceOut(InsuranceIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class MarketReferenceIn(BaseModel):
    reference_client: str = Field(min_length=1, max_length=255)
    object: str = Field(min_length=1)
    amount_eur: float | None = Field(default=None, ge=0)
    duration_months: int | None = Field(default=None, ge=0)
    assigned_headcount: int | None = Field(default=None, ge=0)
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    service_type: str | None = None
    measurable_results: list[dict[str, Any]] = Field(default_factory=list)


class MarketReferenceOut(MarketReferenceIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class SupervisorIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    role: str | None = None
    years_experience: int | None = Field(default=None, ge=0)
    cv_s3_key: str | None = None
    habilitations: list[dict[str, Any]] = Field(default_factory=list)


class SupervisorOut(SupervisorIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class QseRsePolicyIn(BaseModel):
    policy_type: QseRsePolicyType
    title: str = Field(min_length=1, max_length=255)
    summary: str | None = None
    document_s3_key: str | None = None
    updated_on: date | None = None

    @field_validator("policy_type")
    @classmethod
    def validate_policy_type(cls, value: QseRsePolicyType) -> QseRsePolicyType:
        if value not in QSE_RSE_POLICY_TYPES:
            raise ValueError("Type de politique QSE/RSE invalide")
        return value


class QseRsePolicyOut(QseRsePolicyIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class StaffTransferNoteIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    convention_article: str = Field(default="Article 7", max_length=64)
    staff_count: int | None = Field(default=None, ge=0)
    obligations_summary: str | None = None
    commercial_argument: str = Field(min_length=1)
    risk_notes: str | None = None
    assumptions: list[str] = Field(default_factory=list)


class StaffTransferNoteOut(StaffTransferNoteIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class CleaningPlanZoneIn(BaseModel):
    zone: str = Field(min_length=1, max_length=255)
    frequency: str = Field(min_length=1, max_length=128)
    operating_mode: str = Field(min_length=1)
    products: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)


class CleaningPlanZoneOut(CleaningPlanZoneIn):
    model_config = ConfigDict(from_attributes=True)

    id: str


class CleaningPlanIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    site_type: str | None = None
    description: str | None = None
    zones: list[CleaningPlanZoneIn] = Field(default_factory=list)


class CleaningPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    site_type: str | None = None
    description: str | None = None
    zones: list[CleaningPlanZoneOut] = Field(default_factory=list)


class KbStructuredProfileIn(BaseModel):
    client: KbClientUpdate | None = None
    financials: list[FinancialExerciseIn] = Field(default_factory=list)
    headcounts: list[HeadcountSnapshotIn] = Field(default_factory=list)
    product_materials: list[ProductMaterialIn] = Field(default_factory=list)
    certifications: list[CertificationIn] = Field(default_factory=list)
    insurances: list[InsuranceIn] = Field(default_factory=list)
    market_references: list[MarketReferenceIn] = Field(default_factory=list)
    supervisors: list[SupervisorIn] = Field(default_factory=list)
    qse_rse_policies: list[QseRsePolicyIn] = Field(default_factory=list)
    staff_transfer_notes: list[StaffTransferNoteIn] = Field(default_factory=list)
    cleaning_plans: list[CleaningPlanIn] = Field(default_factory=list)

    @field_validator("financials")
    @classmethod
    def validate_last_three_financials(
        cls, value: list[FinancialExerciseIn]
    ) -> list[FinancialExerciseIn]:
        years = [item.fiscal_year for item in value]
        if len(set(years)) != len(years):
            raise ValueError("Un exercice financier ne peut etre present qu'une fois")
        if len(value) > 3:
            raise ValueError("La KB client conserve les 3 derniers exercices de CA")
        return value


class KbStructuredProfileOut(BaseModel):
    client: KbClientOut
    financials: list[FinancialExerciseOut] = Field(default_factory=list)
    headcounts: list[HeadcountSnapshotOut] = Field(default_factory=list)
    product_materials: list[ProductMaterialOut] = Field(default_factory=list)
    certifications: list[CertificationOut] = Field(default_factory=list)
    insurances: list[InsuranceOut] = Field(default_factory=list)
    market_references: list[MarketReferenceOut] = Field(default_factory=list)
    supervisors: list[SupervisorOut] = Field(default_factory=list)
    qse_rse_policies: list[QseRsePolicyOut] = Field(default_factory=list)
    staff_transfer_notes: list[StaffTransferNoteOut] = Field(default_factory=list)
    cleaning_plans: list[CleaningPlanOut] = Field(default_factory=list)


class CorpusDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    source_type: CorpusSourceType
    service_type: str | None = None
    document_date: date | None = None
    outcome: CorpusOutcome = "inconnu"
    language: str | None = None
    s3_key: str | None = None
    checksum_sha256: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, value: CorpusSourceType) -> CorpusSourceType:
        if value not in CORPUS_SOURCE_TYPES:
            raise ValueError("Type de document corpus invalide")
        return value

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, value: CorpusOutcome) -> CorpusOutcome:
        if value not in CORPUS_OUTCOMES:
            raise ValueError("Statut gagne/perdu invalide")
        return value


class CorpusDocumentOut(CorpusDocumentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime


class CorpusChunkCreate(BaseModel):
    chunk_index: int = Field(ge=0)
    content: str = Field(min_length=1)
    content_hash: str | None = Field(default=None, max_length=64)
    embedding: list[float] | None = None
    language: str | None = None
    service_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("embedding")
    @classmethod
    def validate_embedding_dimensions(cls, value: list[float] | None) -> list[float] | None:
        if value is not None and len(value) != EMBEDDING_DIMENSIONS:
            raise ValueError(f"Embedding attendu en {EMBEDDING_DIMENSIONS} dimensions")
        return value


class CorpusChunkOut(CorpusChunkCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    document_id: str
    created_at: datetime
    updated_at: datetime


class CorpusTextIn(BaseModel):
    document: CorpusDocumentCreate
    text: str = Field(min_length=1)
    max_chars: int = Field(default=1600, ge=400, le=6000)
    overlap_chars: int = Field(default=180, ge=0, le=1000)


class CorpusIngestOut(BaseModel):
    document: CorpusDocumentOut
    chunks: list[CorpusChunkOut] = Field(default_factory=list)


class InternalLibraryDocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    source_type: LibrarySourceType
    service_type: str | None = None
    language: str | None = None
    s3_key: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

    @field_validator("source_type")
    @classmethod
    def validate_library_source_type(cls, value: LibrarySourceType) -> LibrarySourceType:
        if value not in LIBRARY_SOURCE_TYPES:
            raise ValueError("Type de document bibliotheque invalide")
        return value


class InternalLibraryDocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    source_type: LibrarySourceType | None = None
    service_type: str | None = None
    language: str | None = None
    s3_key: str | None = None
    metadata: dict[str, Any] | None = None
    is_active: bool | None = None

    @field_validator("source_type")
    @classmethod
    def validate_library_source_type(
        cls, value: LibrarySourceType | None
    ) -> LibrarySourceType | None:
        if value is not None and value not in LIBRARY_SOURCE_TYPES:
            raise ValueError("Type de document bibliotheque invalide")
        return value


class InternalLibraryDocumentOut(InternalLibraryDocumentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class InternalLibraryChunkOut(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    content: str
    content_hash: str | None = None
    embedding: list[float] | None = None
    language: str | None = None
    service_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class InternalLibraryTextIn(BaseModel):
    document: InternalLibraryDocumentCreate
    text: str = Field(min_length=1)
    max_chars: int = Field(default=1600, ge=400, le=6000)
    overlap_chars: int = Field(default=180, ge=0, le=1000)


class InternalLibraryIngestOut(BaseModel):
    document: InternalLibraryDocumentOut
    chunks: list[InternalLibraryChunkOut] = Field(default_factory=list)


class SemanticChunkOut(BaseModel):
    chunk_index: int
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1)
    service_type: str | None = None
    include_internal_library: bool = True
    limit: int = Field(default=8, ge=1, le=30)


class RetrievalChunkOut(BaseModel):
    scope: Literal["client", "internal"]
    chunk_id: str
    client_id: str | None = None
    document_id: str
    document_title: str
    source_type: str
    service_type: str | None = None
    document_date: date | None = None
    outcome: str | None = None
    content: str
    distance: float
    document_metadata: dict[str, Any] = Field(default_factory=dict)
    chunk_metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalOut(BaseModel):
    query: str
    embedding_model: str
    results: list[RetrievalChunkOut] = Field(default_factory=list)

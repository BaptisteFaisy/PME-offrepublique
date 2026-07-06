"""Services for the M2 client knowledge base."""

from __future__ import annotations

import hashlib
import re
from collections.abc import Sequence

from sqlalchemy import Select, delete, literal, select, union_all
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.models.kb import (
    KbCertification,
    KbCleaningPlan,
    KbCleaningPlanZone,
    KbClient,
    KbCorpusChunk,
    KbCorpusDocument,
    KbFinancialExercise,
    KbHeadcountSnapshot,
    KbInsurance,
    KbInternalLibraryChunk,
    KbInternalLibraryDocument,
    KbMarketReference,
    KbProductMaterial,
    KbQseRsePolicy,
    KbStaffTransferNote,
    KbSupervisor,
)
from app.schemas.kb import (
    CertificationIn,
    CleaningPlanIn,
    CorpusChunkCreate,
    CorpusDocumentCreate,
    CorpusTextIn,
    FinancialExerciseIn,
    HeadcountSnapshotIn,
    InsuranceIn,
    InternalLibraryTextIn,
    KbStructuredProfileIn,
    MarketReferenceIn,
    ProductMaterialIn,
    QseRsePolicyIn,
    SemanticChunkOut,
    StaffTransferNoteIn,
    SupervisorIn,
)
from app.services.embeddings import embed_texts

_PARAGRAPH_SPLIT_RE = re.compile(r"\n{2,}")
_HEADING_RE = re.compile(r"^\s{0,3}(#{1,6}\s+|[A-Z][A-Z0-9 .,'/-]{8,}:?\s*$)")


def load_client_profile(db: Session, client_id: str) -> KbClient | None:
    """Load a client and every structured KB collection in one query graph."""
    return db.scalar(
        select(KbClient)
        .where(KbClient.id == client_id)
        .options(
            selectinload(KbClient.financials),
            selectinload(KbClient.headcounts),
            selectinload(KbClient.product_materials),
            selectinload(KbClient.certifications),
            selectinload(KbClient.insurances),
            selectinload(KbClient.market_references),
            selectinload(KbClient.supervisors),
            selectinload(KbClient.qse_rse_policies),
            selectinload(KbClient.staff_transfer_notes),
            selectinload(KbClient.cleaning_plans).selectinload(KbCleaningPlan.zones),
        )
    )


def replace_structured_profile(
    db: Session, client: KbClient, payload: KbStructuredProfileIn
) -> KbClient:
    """Replace every structured collection for a client.

    Form/import writes are easier to reason about as snapshots: each save
    produces the complete structured profile currently known for that client.
    """
    if payload.client is not None:
        for field, value in payload.client.model_dump(exclude_unset=True).items():
            setattr(client, field, value)

    _replace_simple_collection(
        db,
        client.id,
        KbFinancialExercise,
        payload.financials,
        ("fiscal_year", "revenue_eur"),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbHeadcountSnapshot,
        payload.headcounts,
        ("label", "total_headcount", "supervisors_count", "operations_staff_count", "details"),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbProductMaterial,
        payload.product_materials,
        (
            "category",
            "name",
            "brand",
            "quantity",
            "use_case",
            "ecolabels",
            "technical_sheet_s3_key",
        ),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbCertification,
        payload.certifications,
        ("name", "issuer", "document_s3_key", "obtained_on", "expires_on"),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbInsurance,
        payload.insurances,
        (
            "insurance_type",
            "provider",
            "policy_number",
            "coverage_summary",
            "document_s3_key",
            "expires_on",
        ),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbMarketReference,
        payload.market_references,
        (
            "reference_client",
            "object",
            "amount_eur",
            "duration_months",
            "assigned_headcount",
            "contact_name",
            "contact_email",
            "contact_phone",
            "service_type",
            "measurable_results",
        ),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbSupervisor,
        payload.supervisors,
        ("full_name", "role", "years_experience", "cv_s3_key", "habilitations"),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbQseRsePolicy,
        payload.qse_rse_policies,
        ("policy_type", "title", "summary", "document_s3_key", "updated_on"),
    )
    _replace_simple_collection(
        db,
        client.id,
        KbStaffTransferNote,
        payload.staff_transfer_notes,
        (
            "title",
            "convention_article",
            "staff_count",
            "obligations_summary",
            "commercial_argument",
            "risk_notes",
            "assumptions",
        ),
    )
    _replace_cleaning_plans(db, client.id, payload.cleaning_plans)
    db.flush()
    return load_client_profile(db, client.id) or client


def semantic_chunk_text(
    text: str,
    *,
    max_chars: int = 1600,
    overlap_chars: int = 180,
) -> list[SemanticChunkOut]:
    """Chunk prose into paragraph-aware chunks suitable for multilingual embeddings."""
    normalized = re.sub(r"\r\n?", "\n", text).strip()
    if not normalized:
        return []

    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT_RE.split(normalized) if p.strip()]
    chunks: list[SemanticChunkOut] = []
    current: list[str] = []
    section = "document"

    for paragraph in paragraphs:
        if _HEADING_RE.match(paragraph.splitlines()[0]):
            if current:
                _append_semantic_chunk(chunks, "\n\n".join(current), section, overlap_chars)
                current = []
            section = paragraph.strip("#: ").strip()[:120] or section
        candidate = "\n\n".join([*current, paragraph]) if current else paragraph
        if len(candidate) <= max_chars:
            current.append(paragraph)
            continue
        if current:
            _append_semantic_chunk(chunks, "\n\n".join(current), section, overlap_chars)
        current = [paragraph]

        while len(current[0]) > max_chars:
            oversized = current.pop(0)
            chunk_text = oversized[:max_chars]
            _append_semantic_chunk(chunks, chunk_text, section, overlap_chars)
            current.insert(0, oversized[max(0, max_chars - overlap_chars) :])

    if current:
        _append_semantic_chunk(chunks, "\n\n".join(current), section, overlap_chars)
    return chunks


def make_corpus_chunk_models(
    client_id: str,
    document_id: str,
    chunks: Sequence[CorpusChunkCreate],
) -> list[KbCorpusChunk]:
    """Create chunk models while enforcing the document's client id on every row."""
    return [
        KbCorpusChunk(
            client_id=client_id,
            document_id=document_id,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            content_hash=chunk.content_hash or _sha256(chunk.content),
            embedding=chunk.embedding,
            language=chunk.language,
            service_type=chunk.service_type,
            metadata_json=chunk.metadata,
        )
        for chunk in chunks
    ]


def make_internal_library_chunk_models(
    document_id: str,
    chunks: Sequence[CorpusChunkCreate],
) -> list[KbInternalLibraryChunk]:
    """Create generic internal library chunks."""
    return [
        KbInternalLibraryChunk(
            document_id=document_id,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            content_hash=chunk.content_hash or _sha256(chunk.content),
            embedding=chunk.embedding,
            language=chunk.language,
            service_type=chunk.service_type,
            metadata_json=chunk.metadata,
        )
        for chunk in chunks
    ]


def ingest_client_corpus_text(
    db: Session,
    *,
    client_id: str,
    payload: CorpusTextIn,
    settings: Settings,
) -> tuple[KbCorpusDocument, list[KbCorpusChunk]]:
    """Create a client corpus document from raw text with semantic chunks."""
    chunks = semantic_chunk_text(
        payload.text,
        max_chars=payload.max_chars,
        overlap_chars=payload.overlap_chars,
    )
    if not chunks:
        raise ValueError("Document corpus vide apres decoupage")

    embeddings = embed_texts([chunk.content for chunk in chunks], settings)
    document = _corpus_document_from_payload(client_id, payload.document)
    db.add(document)
    db.flush()

    chunk_payloads = [
        CorpusChunkCreate(
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            content_hash=chunk.metadata.get("content_hash"),
            embedding=embedding,
            language=payload.document.language,
            service_type=payload.document.service_type,
            metadata=chunk.metadata,
        )
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]
    chunk_models = make_corpus_chunk_models(client_id, document.id, chunk_payloads)
    db.add_all(chunk_models)
    db.flush()
    return document, chunk_models


def ingest_internal_library_text(
    db: Session,
    *,
    payload: InternalLibraryTextIn,
    settings: Settings,
) -> tuple[KbInternalLibraryDocument, list[KbInternalLibraryChunk]]:
    """Create a shared internal library document from raw generic text."""
    chunks = semantic_chunk_text(
        payload.text,
        max_chars=payload.max_chars,
        overlap_chars=payload.overlap_chars,
    )
    if not chunks:
        raise ValueError("Document bibliotheque vide apres decoupage")

    embeddings = embed_texts([chunk.content for chunk in chunks], settings)
    document = KbInternalLibraryDocument(
        title=payload.document.title,
        source_type=payload.document.source_type,
        service_type=payload.document.service_type,
        language=payload.document.language,
        s3_key=payload.document.s3_key,
        metadata_json=payload.document.metadata,
        is_active=payload.document.is_active,
    )
    db.add(document)
    db.flush()

    chunk_payloads = [
        CorpusChunkCreate(
            chunk_index=chunk.chunk_index,
            content=chunk.content,
            content_hash=chunk.metadata.get("content_hash"),
            embedding=embedding,
            language=payload.document.language,
            service_type=payload.document.service_type,
            metadata=chunk.metadata,
        )
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]
    chunk_models = make_internal_library_chunk_models(document.id, chunk_payloads)
    db.add_all(chunk_models)
    db.flush()
    return document, chunk_models


def retrieve_client_context(
    db: Session,
    *,
    client_id: str,
    query: str,
    settings: Settings,
    service_type: str | None = None,
    include_internal_library: bool = True,
    limit: int = 8,
) -> list[dict]:
    """Run client-scoped vector retrieval plus optional generic library retrieval."""
    query_embedding = embed_texts([query], settings)[0]
    rows = db.execute(
        client_retrieval_statement(
            client_id=client_id,
            query_embedding=query_embedding,
            service_type=service_type,
            include_internal_library=include_internal_library,
            limit=limit,
        )
    ).mappings()
    return [dict(row) for row in rows]


def client_retrieval_statement(
    *,
    client_id: str,
    query_embedding: Sequence[float],
    service_type: str | None = None,
    include_internal_library: bool = True,
    limit: int = 8,
) -> Select:
    """Build the only allowed RAG retrieval statement for a client request.

    The client side is filtered by ``client_id`` both on chunks and documents.
    The optional shared branch reads only from the internal library tables,
    which have no client-owned content by design.
    """
    client_distance = KbCorpusChunk.embedding.cosine_distance(query_embedding).label("distance")
    client_stmt = (
        select(
            literal("client").label("scope"),
            KbCorpusChunk.id.label("chunk_id"),
            KbCorpusChunk.client_id.label("client_id"),
            KbCorpusChunk.document_id.label("document_id"),
            KbCorpusDocument.title.label("document_title"),
            KbCorpusDocument.source_type.label("source_type"),
            KbCorpusDocument.service_type.label("service_type"),
            KbCorpusDocument.document_date.label("document_date"),
            KbCorpusDocument.outcome.label("outcome"),
            KbCorpusChunk.content.label("content"),
            client_distance,
            KbCorpusDocument.metadata_json.label("document_metadata"),
            KbCorpusChunk.metadata_json.label("chunk_metadata"),
        )
        .join(
            KbCorpusDocument,
            (KbCorpusDocument.id == KbCorpusChunk.document_id)
            & (KbCorpusDocument.client_id == KbCorpusChunk.client_id),
        )
        .where(
            KbCorpusChunk.client_id == client_id,
            KbCorpusDocument.client_id == client_id,
            KbCorpusChunk.embedding.is_not(None),
        )
    )
    if service_type is not None:
        client_stmt = client_stmt.where(KbCorpusChunk.service_type == service_type)

    branches = [client_stmt]
    if include_internal_library:
        internal_distance = KbInternalLibraryChunk.embedding.cosine_distance(query_embedding).label(
            "distance"
        )
        internal_stmt = (
            select(
                literal("internal").label("scope"),
                KbInternalLibraryChunk.id.label("chunk_id"),
                literal(None).label("client_id"),
                KbInternalLibraryChunk.document_id.label("document_id"),
                KbInternalLibraryDocument.title.label("document_title"),
                KbInternalLibraryDocument.source_type.label("source_type"),
                KbInternalLibraryDocument.service_type.label("service_type"),
                literal(None).label("document_date"),
                literal(None).label("outcome"),
                KbInternalLibraryChunk.content.label("content"),
                internal_distance,
                KbInternalLibraryDocument.metadata_json.label("document_metadata"),
                KbInternalLibraryChunk.metadata_json.label("chunk_metadata"),
            )
            .join(KbInternalLibraryDocument)
            .where(
                KbInternalLibraryDocument.is_active.is_(True),
                KbInternalLibraryChunk.embedding.is_not(None),
            )
        )
        if service_type is not None:
            internal_stmt = internal_stmt.where(
                KbInternalLibraryChunk.service_type == service_type
            )
        branches.append(internal_stmt)

    retrieval = union_all(*branches).subquery()
    return select(retrieval).order_by(retrieval.c.distance).limit(limit)


def _corpus_document_from_payload(
    client_id: str,
    payload: CorpusDocumentCreate,
) -> KbCorpusDocument:
    return KbCorpusDocument(
        client_id=client_id,
        title=payload.title,
        source_type=payload.source_type,
        service_type=payload.service_type,
        document_date=payload.document_date,
        outcome=payload.outcome,
        language=payload.language,
        s3_key=payload.s3_key,
        checksum_sha256=payload.checksum_sha256,
        metadata_json=payload.metadata,
    )


def _replace_simple_collection(
    db: Session,
    client_id: str,
    model: type,
    items: Sequence[BaseModelLike],
    fields: Sequence[str],
) -> None:
    db.execute(delete(model).where(model.client_id == client_id))
    db.add_all(
        model(client_id=client_id, **{field: getattr(item, field) for field in fields})
        for item in items
    )


def _replace_cleaning_plans(
    db: Session,
    client_id: str,
    plans: Sequence[CleaningPlanIn],
) -> None:
    db.execute(delete(KbCleaningPlan).where(KbCleaningPlan.client_id == client_id))
    for plan_payload in plans:
        plan = KbCleaningPlan(
            client_id=client_id,
            name=plan_payload.name,
            site_type=plan_payload.site_type,
            description=plan_payload.description,
        )
        plan.zones = [
            KbCleaningPlanZone(
                zone=zone.zone,
                frequency=zone.frequency,
                operating_mode=zone.operating_mode,
                products=zone.products,
                materials=zone.materials,
            )
            for zone in plan_payload.zones
        ]
        db.add(plan)


def _append_semantic_chunk(
    chunks: list[SemanticChunkOut],
    content: str,
    section: str,
    overlap_chars: int,
) -> None:
    chunk = content.strip()
    if not chunk:
        return
    chunks.append(
        SemanticChunkOut(
            chunk_index=len(chunks),
            content=chunk,
            metadata={
                "section": section,
                "content_hash": _sha256(chunk),
                "overlap_chars": overlap_chars,
            },
        )
    )


def _sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


BaseModelLike = (
    FinancialExerciseIn
    | HeadcountSnapshotIn
    | ProductMaterialIn
    | CertificationIn
    | InsuranceIn
    | MarketReferenceIn
    | SupervisorIn
    | QseRsePolicyIn
    | StaffTransferNoteIn
)

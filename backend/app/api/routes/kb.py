"""M2 client knowledge base endpoints."""

from __future__ import annotations

import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.security import require_user
from app.db import get_db
from app.models.base import new_uuid
from app.models.kb import (
    KbClient,
    KbCorpusChunk,
    KbCorpusDocument,
    KbInternalLibraryDocument,
)
from app.pipeline.extract import extract_text
from app.schemas.kb import (
    CorpusChunkCreate,
    CorpusChunkOut,
    CorpusDocumentCreate,
    CorpusDocumentOut,
    CorpusIngestOut,
    CorpusTextIn,
    InternalLibraryDocumentCreate,
    InternalLibraryDocumentOut,
    InternalLibraryDocumentUpdate,
    InternalLibraryIngestOut,
    InternalLibraryTextIn,
    KbClientCreate,
    KbClientOut,
    KbClientUpdate,
    KbStructuredProfileIn,
    KbStructuredProfileOut,
    RetrievalChunkOut,
    RetrievalOut,
    RetrievalRequest,
    SemanticChunkOut,
)
from app.services.embeddings import EmbeddingError
from app.services.kb import (
    ingest_client_corpus_text,
    ingest_internal_library_text,
    load_client_profile,
    make_corpus_chunk_models,
    replace_structured_profile,
    retrieve_client_context,
    semantic_chunk_text,
)
from app.services.kb_import import (
    StructuredImportError,
    build_structured_profile_template,
    parse_structured_profile_import,
)
from app.storage.s3 import put_bytes

router = APIRouter(prefix="/kb", tags=["kb"])
DbSession = Annotated[Session, Depends(get_db)]
AuthUser = Annotated[str, Depends(require_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]

_ALLOWED_CORPUS_SUFFIXES = (".pdf", ".docx", ".xlsx", ".txt")


@router.get("/structured/import-template")
def structured_profile_template(user: AuthUser) -> Response:
    content = build_structured_profile_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="kb-structured-template.xlsx"',
        },
    )


@router.post("/clients", response_model=KbClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: KbClientCreate,
    db: DbSession,
    user: AuthUser,
) -> KbClient:
    client = KbClient(**payload.model_dump())
    db.add(client)
    _commit_or_conflict(db, "Client KB deja existant")
    db.refresh(client)
    return client


@router.get("/clients", response_model=list[KbClientOut])
def list_clients(
    db: DbSession,
    user: AuthUser,
) -> list[KbClient]:
    return list(db.scalars(select(KbClient).order_by(KbClient.name)))


@router.get("/clients/{client_id}", response_model=KbClientOut)
def get_client(
    client_id: str,
    db: DbSession,
    user: AuthUser,
) -> KbClient:
    return _get_client_or_404(db, client_id)


@router.patch("/clients/{client_id}", response_model=KbClientOut)
def update_client(
    client_id: str,
    payload: KbClientUpdate,
    db: DbSession,
    user: AuthUser,
) -> KbClient:
    client = _get_client_or_404(db, client_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    _commit_or_conflict(db, "Client KB deja existant")
    db.refresh(client)
    return client


@router.get("/clients/{client_id}/structured", response_model=KbStructuredProfileOut)
def get_structured_profile(
    client_id: str,
    db: DbSession,
    user: AuthUser,
) -> KbStructuredProfileOut:
    client = load_client_profile(db, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client KB introuvable")
    return KbStructuredProfileOut.model_validate(_structured_payload(client))


@router.put("/clients/{client_id}/structured", response_model=KbStructuredProfileOut)
def replace_profile(
    client_id: str,
    payload: KbStructuredProfileIn,
    db: DbSession,
    user: AuthUser,
) -> KbStructuredProfileOut:
    client = _get_client_or_404(db, client_id)
    client = replace_structured_profile(db, client, payload)
    _commit_or_conflict(db, "Profil KB invalide ou doublon")
    client = load_client_profile(db, client_id) or client
    return KbStructuredProfileOut.model_validate(_structured_payload(client))


@router.post("/clients/{client_id}/structured/import", response_model=KbStructuredProfileOut)
def import_structured_profile(
    client_id: str,
    file: Annotated[UploadFile, File(...)],
    db: DbSession,
    user: AuthUser,
) -> KbStructuredProfileOut:
    client = _get_client_or_404(db, client_id)
    filename = file.filename or "structured-import.bin"
    data = file.file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier vide")
    try:
        payload = parse_structured_profile_import(filename, data)
        client = replace_structured_profile(db, client, payload)
    except StructuredImportError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    _commit_or_conflict(db, "Profil KB invalide ou doublon")
    client = load_client_profile(db, client_id) or client
    return KbStructuredProfileOut.model_validate(_structured_payload(client))


@router.post(
    "/clients/{client_id}/corpus/documents",
    response_model=CorpusDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_corpus_document(
    client_id: str,
    payload: CorpusDocumentCreate,
    db: DbSession,
    user: AuthUser,
) -> CorpusDocumentOut:
    _get_client_or_404(db, client_id)
    document = KbCorpusDocument(
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
    db.add(document)
    db.commit()
    db.refresh(document)
    return _corpus_document_out(document)


@router.post(
    "/clients/{client_id}/corpus/text",
    response_model=CorpusIngestOut,
    status_code=status.HTTP_201_CREATED,
)
def ingest_corpus_text(
    client_id: str,
    payload: CorpusTextIn,
    db: DbSession,
    user: AuthUser,
    settings: AppSettings,
) -> CorpusIngestOut:
    _get_client_or_404(db, client_id)
    try:
        document, chunks = ingest_client_corpus_text(
            db,
            client_id=client_id,
            payload=payload,
            settings=settings,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except EmbeddingError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    _commit_or_conflict(db, "Document corpus invalide ou doublon")
    db.refresh(document)
    for chunk in chunks:
        db.refresh(chunk)
    return CorpusIngestOut(
        document=_corpus_document_out(document),
        chunks=[_corpus_chunk_out(chunk) for chunk in chunks],
    )


@router.post(
    "/clients/{client_id}/corpus/files",
    response_model=CorpusIngestOut,
    status_code=status.HTTP_201_CREATED,
)
def ingest_corpus_file(
    client_id: str,
    file: Annotated[UploadFile, File(...)],
    source_type: Annotated[str, Form(...)],
    db: DbSession,
    user: AuthUser,
    settings: AppSettings,
    title: Annotated[str | None, Form()] = None,
    service_type: Annotated[str | None, Form()] = None,
    document_date: Annotated[str | None, Form()] = None,
    outcome: Annotated[str, Form()] = "inconnu",
    language: Annotated[str | None, Form()] = None,
    metadata_json: Annotated[str | None, Form()] = None,
    max_chars: Annotated[int, Form()] = 1600,
    overlap_chars: Annotated[int, Form()] = 180,
) -> CorpusIngestOut:
    _get_client_or_404(db, client_id)
    filename = file.filename or "corpus.bin"
    if not filename.lower().endswith(_ALLOWED_CORPUS_SUFFIXES):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Format corpus non supporte. Attendu: {', '.join(_ALLOWED_CORPUS_SUFFIXES)}",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier vide")

    user_metadata = _parse_metadata_json(metadata_json)
    extracted_text, extraction_metadata = _extract_corpus_file_text(filename, data, settings)
    checksum = hashlib.sha256(data).hexdigest()
    object_id = new_uuid()
    s3_key = f"kb/{client_id}/corpus/{object_id}/{filename}"
    put_bytes(s3_key, data, content_type=file.content_type or "application/octet-stream")

    document_payload = CorpusDocumentCreate(
        title=title or filename,
        source_type=source_type,
        service_type=service_type,
        document_date=document_date,
        outcome=outcome,
        language=language,
        s3_key=s3_key,
        checksum_sha256=checksum,
        metadata={
            **user_metadata,
            "source_filename": filename,
            "content_type": file.content_type,
            **extraction_metadata,
        },
    )
    text_payload = CorpusTextIn(
        document=document_payload,
        text=extracted_text,
        max_chars=max_chars,
        overlap_chars=overlap_chars,
    )
    try:
        document, chunks = ingest_client_corpus_text(
            db,
            client_id=client_id,
            payload=text_payload,
            settings=settings,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except EmbeddingError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    _commit_or_conflict(db, "Document corpus invalide ou doublon")
    db.refresh(document)
    for chunk in chunks:
        db.refresh(chunk)
    return CorpusIngestOut(
        document=_corpus_document_out(document),
        chunks=[_corpus_chunk_out(chunk) for chunk in chunks],
    )


@router.get("/clients/{client_id}/corpus/documents", response_model=list[CorpusDocumentOut])
def list_corpus_documents(
    client_id: str,
    db: DbSession,
    user: AuthUser,
) -> list[CorpusDocumentOut]:
    _get_client_or_404(db, client_id)
    documents = db.scalars(
        select(KbCorpusDocument)
        .where(KbCorpusDocument.client_id == client_id)
        .order_by(KbCorpusDocument.created_at.desc())
    )
    return [_corpus_document_out(document) for document in documents]


@router.post(
    "/clients/{client_id}/corpus/documents/{document_id}/chunks",
    response_model=list[CorpusChunkOut],
    status_code=status.HTTP_201_CREATED,
)
def create_corpus_chunks(
    client_id: str,
    document_id: str,
    payload: list[CorpusChunkCreate],
    db: DbSession,
    user: AuthUser,
) -> list[CorpusChunkOut]:
    document = _get_client_document_or_404(db, client_id, document_id)
    chunks = make_corpus_chunk_models(document.client_id, document.id, payload)
    db.add_all(chunks)
    _commit_or_conflict(db, "Chunks corpus invalides ou indexes en doublon")
    for chunk in chunks:
        db.refresh(chunk)
    return [_corpus_chunk_out(chunk) for chunk in chunks]


@router.post("/clients/{client_id}/retrieve", response_model=RetrievalOut)
def retrieve_context(
    client_id: str,
    payload: RetrievalRequest,
    db: DbSession,
    user: AuthUser,
    settings: AppSettings,
) -> RetrievalOut:
    _get_client_or_404(db, client_id)
    try:
        rows = retrieve_client_context(
            db,
            client_id=client_id,
            query=payload.query,
            settings=settings,
            service_type=payload.service_type,
            include_internal_library=payload.include_internal_library,
            limit=payload.limit,
        )
    except EmbeddingError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    return RetrievalOut(
        query=payload.query,
        embedding_model=settings.embedding_model,
        results=[_retrieval_chunk_out(row) for row in rows],
    )


@router.post("/semantic-chunks", response_model=list[SemanticChunkOut])
def preview_semantic_chunks(
    text: str,
    user: AuthUser,
    max_chars: int = 1600,
    overlap_chars: int = 180,
) -> list[SemanticChunkOut]:
    return semantic_chunk_text(text, max_chars=max_chars, overlap_chars=overlap_chars)


@router.post(
    "/internal-library/documents",
    response_model=InternalLibraryDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_internal_library_document(
    payload: InternalLibraryDocumentCreate,
    db: DbSession,
    user: AuthUser,
) -> InternalLibraryDocumentOut:
    document = KbInternalLibraryDocument(
        title=payload.title,
        source_type=payload.source_type,
        service_type=payload.service_type,
        language=payload.language,
        s3_key=payload.s3_key,
        metadata_json=payload.metadata,
        is_active=payload.is_active,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return InternalLibraryDocumentOut(
        id=document.id,
        title=document.title,
        source_type=document.source_type,
        service_type=document.service_type,
        language=document.language,
        s3_key=document.s3_key,
        metadata=document.metadata_json,
        is_active=document.is_active,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.get(
    "/internal-library/documents",
    response_model=list[InternalLibraryDocumentOut],
)
def list_internal_library_documents(
    db: DbSession,
    user: AuthUser,
    include_inactive: bool = True,
) -> list[InternalLibraryDocumentOut]:
    statement = select(KbInternalLibraryDocument).order_by(
        KbInternalLibraryDocument.updated_at.desc()
    )
    if not include_inactive:
        statement = statement.where(KbInternalLibraryDocument.is_active.is_(True))
    documents = db.scalars(statement)
    return [_internal_document_out(document) for document in documents]


@router.patch(
    "/internal-library/documents/{document_id}",
    response_model=InternalLibraryDocumentOut,
)
def update_internal_library_document(
    document_id: str,
    payload: InternalLibraryDocumentUpdate,
    db: DbSession,
    user: AuthUser,
) -> InternalLibraryDocumentOut:
    document = db.get(KbInternalLibraryDocument, document_id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document bibliotheque introuvable")

    updates = payload.model_dump(exclude_unset=True)
    metadata = updates.pop("metadata", None)
    for field, value in updates.items():
        setattr(document, field, value)
    if metadata is not None:
        document.metadata_json = metadata

    _commit_or_conflict(db, "Document bibliotheque invalide")
    db.refresh(document)
    return _internal_document_out(document)


@router.post(
    "/internal-library/text",
    response_model=InternalLibraryIngestOut,
    status_code=status.HTTP_201_CREATED,
)
def ingest_internal_library_document(
    payload: InternalLibraryTextIn,
    db: DbSession,
    user: AuthUser,
    settings: AppSettings,
) -> InternalLibraryIngestOut:
    try:
        document, chunks = ingest_internal_library_text(db, payload=payload, settings=settings)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except EmbeddingError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    _commit_or_conflict(db, "Document bibliotheque invalide ou doublon")
    db.refresh(document)
    for chunk in chunks:
        db.refresh(chunk)
    return InternalLibraryIngestOut(
        document=_internal_document_out(document),
        chunks=[_internal_chunk_out(chunk) for chunk in chunks],
    )


@router.post(
    "/internal-library/files",
    response_model=InternalLibraryIngestOut,
    status_code=status.HTTP_201_CREATED,
)
def ingest_internal_library_file(
    file: Annotated[UploadFile, File(...)],
    source_type: Annotated[str, Form(...)],
    db: DbSession,
    user: AuthUser,
    settings: AppSettings,
    title: Annotated[str | None, Form()] = None,
    service_type: Annotated[str | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    metadata_json: Annotated[str | None, Form()] = None,
    is_active: Annotated[bool, Form()] = True,
    max_chars: Annotated[int, Form()] = 1600,
    overlap_chars: Annotated[int, Form()] = 180,
) -> InternalLibraryIngestOut:
    filename = file.filename or "bibliotheque.bin"
    if not filename.lower().endswith(_ALLOWED_CORPUS_SUFFIXES):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Format bibliotheque non supporte. Attendu: {', '.join(_ALLOWED_CORPUS_SUFFIXES)}",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier vide")

    user_metadata = _parse_metadata_json(metadata_json)
    extracted_text, extraction_metadata = _extract_corpus_file_text(filename, data, settings)
    checksum = hashlib.sha256(data).hexdigest()
    object_id = new_uuid()
    s3_key = f"kb/internal-library/{object_id}/{filename}"
    put_bytes(s3_key, data, content_type=file.content_type or "application/octet-stream")

    document_payload = InternalLibraryDocumentCreate(
        title=title or filename,
        source_type=source_type,
        service_type=service_type,
        language=language,
        s3_key=s3_key,
        is_active=is_active,
        metadata={
            **user_metadata,
            "source_filename": filename,
            "content_type": file.content_type,
            "checksum_sha256": checksum,
            **extraction_metadata,
        },
    )
    text_payload = InternalLibraryTextIn(
        document=document_payload,
        text=extracted_text,
        max_chars=max_chars,
        overlap_chars=overlap_chars,
    )
    try:
        document, chunks = ingest_internal_library_text(db, payload=text_payload, settings=settings)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except EmbeddingError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    _commit_or_conflict(db, "Document bibliotheque invalide ou doublon")
    db.refresh(document)
    for chunk in chunks:
        db.refresh(chunk)
    return InternalLibraryIngestOut(
        document=_internal_document_out(document),
        chunks=[_internal_chunk_out(chunk) for chunk in chunks],
    )


def _get_client_or_404(db: Session, client_id: str) -> KbClient:
    client = db.get(KbClient, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client KB introuvable")
    return client


def _get_client_document_or_404(
    db: Session, client_id: str, document_id: str
) -> KbCorpusDocument:
    document = db.scalar(
        select(KbCorpusDocument).where(
            KbCorpusDocument.id == document_id,
            KbCorpusDocument.client_id == client_id,
        )
    )
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document corpus introuvable")
    return document


def _commit_or_conflict(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, message) from exc


def _parse_metadata_json(raw: str | None) -> dict:
    if raw is None or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "metadata_json invalide") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "metadata_json doit etre un objet JSON")
    return parsed


def _extract_corpus_file_text(
    filename: str,
    data: bytes,
    settings: Settings,
) -> tuple[str, dict]:
    if filename.lower().endswith(".txt"):
        text = data.decode("utf-8", errors="replace").strip()
        if not text:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier texte vide")
        return text, {"page_count": 1, "extraction_warnings": []}

    result = extract_text(filename, data, settings)
    pages = [page for page in result.pages if page.text.strip()]
    if not pages:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucun texte exploitable extrait")
    text = "\n\n".join(f"[Page {page.page_number}]\n{page.text.strip()}" for page in pages)
    return text, {
        "page_count": len(result.pages),
        "text_page_count": len(pages),
        "ocr_pages": [page.page_number for page in result.pages if page.ocr_used],
        "extraction_warnings": result.warnings,
    }


def _structured_payload(client: KbClient) -> dict:
    return {
        "client": client,
        "financials": client.financials,
        "headcounts": client.headcounts,
        "product_materials": client.product_materials,
        "certifications": client.certifications,
        "insurances": client.insurances,
        "market_references": client.market_references,
        "supervisors": client.supervisors,
        "qse_rse_policies": client.qse_rse_policies,
        "staff_transfer_notes": client.staff_transfer_notes,
        "cleaning_plans": client.cleaning_plans,
    }


def _corpus_document_out(document: KbCorpusDocument) -> CorpusDocumentOut:
    return CorpusDocumentOut(
        id=document.id,
        client_id=document.client_id,
        title=document.title,
        source_type=document.source_type,
        service_type=document.service_type,
        document_date=document.document_date,
        outcome=document.outcome,
        language=document.language,
        s3_key=document.s3_key,
        checksum_sha256=document.checksum_sha256,
        metadata=document.metadata_json,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _corpus_chunk_out(chunk: KbCorpusChunk) -> CorpusChunkOut:
    return CorpusChunkOut(
        id=chunk.id,
        client_id=chunk.client_id,
        document_id=chunk.document_id,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        content_hash=chunk.content_hash,
        embedding=chunk.embedding,
        language=chunk.language,
        service_type=chunk.service_type,
        metadata=chunk.metadata_json,
        created_at=chunk.created_at,
        updated_at=chunk.updated_at,
    )


def _internal_document_out(document: KbInternalLibraryDocument) -> InternalLibraryDocumentOut:
    return InternalLibraryDocumentOut(
        id=document.id,
        title=document.title,
        source_type=document.source_type,
        service_type=document.service_type,
        language=document.language,
        s3_key=document.s3_key,
        metadata=document.metadata_json,
        is_active=document.is_active,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _internal_chunk_out(chunk) -> dict:
    return {
        "id": chunk.id,
        "document_id": chunk.document_id,
        "chunk_index": chunk.chunk_index,
        "content": chunk.content,
        "content_hash": chunk.content_hash,
        "embedding": chunk.embedding,
        "language": chunk.language,
        "service_type": chunk.service_type,
        "metadata": chunk.metadata_json,
        "created_at": chunk.created_at,
        "updated_at": chunk.updated_at,
    }


def _retrieval_chunk_out(row: dict) -> RetrievalChunkOut:
    return RetrievalChunkOut(
        scope=row["scope"],
        chunk_id=row["chunk_id"],
        client_id=row["client_id"],
        document_id=row["document_id"],
        document_title=row["document_title"],
        source_type=row["source_type"],
        service_type=row["service_type"],
        document_date=row["document_date"],
        outcome=row["outcome"],
        content=row["content"],
        distance=float(row["distance"]),
        document_metadata=row["document_metadata"] or {},
        chunk_metadata=row["chunk_metadata"] or {},
    )

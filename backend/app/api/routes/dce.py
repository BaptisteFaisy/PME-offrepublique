"""M1 ingestion endpoints.

POST /dce accepts an upload, stores it in S3, records it, and enqueues the
parse job. The read endpoints expose the pipeline output: the Fiche AO + go/no-go,
the classified pieces, and the page-anchored text used to verify each field.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.db import get_db
from app.models.base import new_uuid
from app.models.dce import DceFiche, DcePage, DcePiece, DceUpload
from app.schemas.dce import (
    DceUploadAccepted,
    DceUploadOut,
    FicheOut,
    PageOut,
    PieceOut,
)
from app.storage.s3 import put_bytes
from app.workers.queue import get_queue
from app.workers.tasks import parse_dce

router = APIRouter(prefix="/dce", tags=["dce"])

_ALLOWED_SUFFIXES = (".zip", ".pdf", ".docx", ".xlsx")


def _get_upload_or_404(db: Session, upload_id: str) -> DceUpload:
    upload = db.get(DceUpload, upload_id)
    if upload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload introuvable")
    return upload


@router.post("", response_model=DceUploadAccepted, status_code=status.HTTP_202_ACCEPTED)
def upload_dce(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: str = Depends(require_user),
) -> DceUploadAccepted:
    filename = file.filename or "upload.bin"
    if not filename.lower().endswith(_ALLOWED_SUFFIXES):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Format non supporté. Attendu: {', '.join(_ALLOWED_SUFFIXES)}",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fichier vide")

    upload_id = new_uuid()
    s3_key = f"uploads/{upload_id}/{filename}"
    put_bytes(s3_key, data, content_type=file.content_type or "application/octet-stream")

    upload = DceUpload(
        id=upload_id,
        original_filename=filename,
        s3_key=s3_key,
        status="received",
    )
    db.add(upload)
    db.commit()

    job = get_queue().enqueue(parse_dce, upload_id)

    return DceUploadAccepted(upload_id=upload_id, status=upload.status, job_id=job.id)


@router.get("/{upload_id}", response_model=DceUploadOut)
def get_dce(
    upload_id: str,
    db: Session = Depends(get_db),
    user: str = Depends(require_user),
) -> DceUpload:
    return _get_upload_or_404(db, upload_id)


@router.get("/{upload_id}/fiche", response_model=FicheOut)
def get_fiche(
    upload_id: str,
    db: Session = Depends(get_db),
    user: str = Depends(require_user),
) -> FicheOut:
    upload = _get_upload_or_404(db, upload_id)
    fiche = db.scalar(select(DceFiche).where(DceFiche.upload_id == upload_id))
    if fiche is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Fiche AO pas encore disponible (statut: {upload.status}).",
        )
    return FicheOut(
        upload_id=upload_id,
        status=upload.status,
        fiche=fiche.fiche,
        gonogo=fiche.gonogo,
        warnings=fiche.warnings or [],
        model=fiche.model,
    )


@router.get("/{upload_id}/pieces", response_model=list[PieceOut])
def list_pieces(
    upload_id: str,
    db: Session = Depends(get_db),
    user: str = Depends(require_user),
) -> list[DcePiece]:
    _get_upload_or_404(db, upload_id)
    return list(
        db.scalars(
            select(DcePiece).where(DcePiece.upload_id == upload_id).order_by(DcePiece.filename)
        )
    )


@router.get(
    "/{upload_id}/pieces/{piece_id}/pages/{page_number}",
    response_model=PageOut,
)
def get_page(
    upload_id: str,
    piece_id: str,
    page_number: int,
    db: Session = Depends(get_db),
    user: str = Depends(require_user),
) -> DcePage:
    """Source verification: the exact page text a Fiche AO field points to."""
    piece = db.get(DcePiece, piece_id)
    if piece is None or piece.upload_id != upload_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pièce introuvable")
    page = db.scalar(
        select(DcePage).where(
            DcePage.piece_id == piece_id, DcePage.page_number == page_number
        )
    )
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page introuvable")
    return page

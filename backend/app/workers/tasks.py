"""Background jobs.

``parse_dce`` runs the M1 pipeline end to end: download -> unzip+dedup ->
extract text (+ OCR) with page anchoring -> classify -> Fiche AO (2 LLM passes)
-> go/no-go. Every step persists as it goes, so a late failure (e.g. missing
LLM key) still leaves the page-anchored text in place, and the job can be
replayed idempotently (CDC §6 robustness).
"""

from __future__ import annotations

import logging
from datetime import date

from app.config import get_settings
from app.db import SessionLocal
from app.models.dce import DceFiche, DcePage, DcePiece, DceUpload
from app.pipeline.classify import classify_piece
from app.pipeline.extract import extract_text
from app.pipeline.fiche import CorpusPiece, build_corpus, extract_fiche
from app.pipeline.gonogo import evaluate
from app.pipeline.unzip import extract_upload
from app.storage.s3 import get_bytes

log = logging.getLogger(__name__)


def ping(message: str = "pong") -> str:
    """Trivial health job used to smoke-test the queue."""
    log.info("ping job received: %s", message)
    return message


def parse_dce(upload_id: str) -> dict:
    """Run the M1 ingestion pipeline for one upload."""
    log.info("parse_dce started for upload_id=%s", upload_id)
    settings = get_settings()
    db = SessionLocal()
    try:
        upload = db.get(DceUpload, upload_id)
        if upload is None:
            log.warning("parse_dce: upload_id=%s not found", upload_id)
            return {"upload_id": upload_id, "status": "not_found"}

        upload.status = "processing"
        upload.error = None
        db.commit()

        # Idempotency: clear any prior run's pieces/fiche (FK cascade drops pages).
        db.query(DcePiece).filter(DcePiece.upload_id == upload_id).delete()
        db.query(DceFiche).filter(DceFiche.upload_id == upload_id).delete()
        db.commit()

        # 1) unzip + dedup
        raw = get_bytes(upload.s3_key)
        files = extract_upload(raw, upload.original_filename)
        if not files:
            raise ValueError("Aucun document exploitable (pdf/docx/xlsx) dans l'upload.")

        warnings: list[str] = []
        corpus_pieces: list[CorpusPiece] = []

        # 2-4) extract text (+OCR), classify, persist page-anchored text
        for ef in files:
            result = extract_text(ef.filename, ef.content, settings)
            warnings.extend(result.warnings)

            first_page = result.pages[0].text if result.pages else None
            piece_type, _ = classify_piece(ef.filename, first_page, settings)

            piece = DcePiece(
                upload_id=upload_id,
                filename=ef.filename,
                piece_type=piece_type,
                page_count=len(result.pages),
            )
            db.add(piece)
            db.flush()  # assign piece.id

            for page in result.pages:
                db.add(
                    DcePage(
                        piece_id=piece.id,
                        page_number=page.page_number,
                        text=page.text,
                        ocr_used=page.ocr_used,
                    )
                )
            corpus_pieces.append(
                CorpusPiece(
                    filename=ef.filename,
                    piece_type=piece_type,
                    pages=[(p.page_number, p.text) for p in result.pages],
                )
            )
        db.commit()  # page-anchored text is safe from here on

        # 5) structured Fiche AO extraction (two LLM passes)
        corpus = build_corpus(corpus_pieces, settings.pipeline_max_context_chars)
        try:
            fiche = extract_fiche(corpus, settings)
        except Exception as exc:  # noqa: BLE001 — record but keep the pages
            log.exception("Fiche AO extraction failed for upload_id=%s", upload_id)
            upload.status = "failed"
            upload.error = f"Extraction Fiche AO échouée: {exc}"
            db.commit()
            return {"upload_id": upload_id, "status": "failed", "error": str(exc)}

        # go/no-go (no client profile yet — that arrives with M2)
        gonogo = evaluate(fiche, today=date.today(), client_profile=None)

        db.add(
            DceFiche(
                upload_id=upload_id,
                fiche=fiche,
                gonogo=gonogo,
                warnings=warnings,
                model=settings.llm_model_extraction,
            )
        )
        upload.status = "ready"
        db.commit()

        log.info(
            "parse_dce finished upload_id=%s pieces=%d decision=%s",
            upload_id,
            len(corpus_pieces),
            gonogo.get("decision"),
        )
        return {
            "upload_id": upload_id,
            "status": "ready",
            "pieces": len(corpus_pieces),
            "decision": gonogo.get("decision"),
            "warnings": len(warnings),
        }
    except Exception as exc:  # noqa: BLE001 — record failure, re-raise for RQ retry
        db.rollback()
        upload = db.get(DceUpload, upload_id)
        if upload is not None:
            upload.status = "failed"
            upload.error = str(exc)
            db.commit()
        log.exception("parse_dce failed for upload_id=%s", upload_id)
        raise
    finally:
        db.close()

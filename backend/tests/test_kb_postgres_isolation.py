"""PostgreSQL isolation checks for the M2 client KB.

These tests are skipped by default because they require a migrated PostgreSQL
database with pgvector enabled. Run them with:

    $env:KB_TEST_DATABASE_URL="postgresql+psycopg://..."
    uv run --extra dev pytest tests/test_kb_postgres_isolation.py

All writes happen inside a transaction that is rolled back at the end.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.base import new_uuid
from app.models.kb import (
    KbClient,
    KbCorpusChunk,
    KbCorpusDocument,
    KbInternalLibraryChunk,
    KbInternalLibraryDocument,
)
from app.services.kb import client_retrieval_statement

pytestmark = pytest.mark.skipif(
    not os.getenv("KB_TEST_DATABASE_URL"),
    reason="KB_TEST_DATABASE_URL is required for PostgreSQL isolation checks",
)


def _vector(value: float) -> list[float]:
    return [value] * 1536


def test_postgres_enforces_client_isolation_and_retrieval_scope() -> None:
    engine = create_engine(os.environ["KB_TEST_DATABASE_URL"], future=True)
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, expire_on_commit=False)
    try:
        client_a = KbClient(id=new_uuid(), name="Pilote A")
        client_b = KbClient(id=new_uuid(), name="Pilote B")
        db.add_all([client_a, client_b])
        db.flush()

        document_a = KbCorpusDocument(
            id=new_uuid(),
            client_id=client_a.id,
            title="Memoire A",
            source_type="memoire_technique",
            service_type="proprete",
            outcome="gagne",
            metadata_json={},
        )
        document_b = KbCorpusDocument(
            id=new_uuid(),
            client_id=client_b.id,
            title="Memoire B",
            source_type="memoire_technique",
            service_type="proprete",
            outcome="perdu",
            metadata_json={},
        )
        internal = KbInternalLibraryDocument(
            id=new_uuid(),
            title="Trame interne",
            source_type="trame_generique",
            service_type="proprete",
            metadata_json={},
        )
        db.add_all([document_a, document_b, internal])
        db.flush()

        db.add_all(
            [
                KbCorpusChunk(
                    id=new_uuid(),
                    client_id=client_a.id,
                    document_id=document_a.id,
                    chunk_index=0,
                    content="Argument client A Article 7",
                    embedding=_vector(0.1),
                    service_type="proprete",
                    metadata_json={},
                ),
                KbCorpusChunk(
                    id=new_uuid(),
                    client_id=client_b.id,
                    document_id=document_b.id,
                    chunk_index=0,
                    content="Argument client B confidentiel",
                    embedding=_vector(0.9),
                    service_type="proprete",
                    metadata_json={},
                ),
                KbInternalLibraryChunk(
                    id=new_uuid(),
                    document_id=internal.id,
                    chunk_index=0,
                    content="Trame generique sans donnees client",
                    embedding=_vector(0.2),
                    service_type="proprete",
                    metadata_json={},
                ),
            ]
        )
        db.flush()

        savepoint = connection.begin_nested()
        with pytest.raises(IntegrityError):
            connection.execute(
                KbCorpusChunk.__table__.insert().values(
                    id=new_uuid(),
                    client_id=client_a.id,
                    document_id=document_b.id,
                    chunk_index=1,
                    content="Rattachement inter-client interdit",
                    embedding=_vector(0.3),
                    service_type="proprete",
                    metadata={},
                )
            )
        savepoint.rollback()

        rows = db.execute(
            client_retrieval_statement(
                client_id=client_a.id,
                query_embedding=_vector(0.1),
                service_type="proprete",
                include_internal_library=True,
                limit=10,
            )
        ).mappings()
        results = list(rows)

        assert {row["scope"] for row in results} == {"client", "internal"}
        assert all(row["client_id"] in {client_a.id, None} for row in results)
        assert "Memoire B" not in {row["document_title"] for row in results}
    finally:
        db.close()
        transaction.rollback()
        connection.close()
        engine.dispose()

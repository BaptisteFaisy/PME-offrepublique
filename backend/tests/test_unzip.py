"""Recursive unzip + dedup (no external services needed)."""

from __future__ import annotations

import io
import zipfile

from app.pipeline.unzip import extract_upload


def _zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_recursive_unzip_dedup_and_filtering() -> None:
    inner = _zip({"AE.pdf": b"c"})
    top = _zip(
        {
            "RC.pdf": b"a",
            "sub/CCTP.pdf": b"b",
            "dup.pdf": b"a",  # byte-identical to RC.pdf -> deduped
            "notes.txt": b"ignored",  # unsupported -> dropped
            "__MACOSX/._RC.pdf": b"junk",  # resource fork -> dropped
            "inner.zip": inner,  # nested zip -> expanded
        }
    )

    files = extract_upload(top, "dce.zip")

    contents = sorted(f.content for f in files)
    assert contents == [b"a", b"b", b"c"]  # dedup + nested expansion, txt dropped
    assert all(f.filename.lower().endswith(".pdf") for f in files)


def test_loose_pdf_upload() -> None:
    files = extract_upload(b"%PDF-1.4 ...", "CCAP.pdf")
    assert len(files) == 1
    assert files[0].filename == "CCAP.pdf"

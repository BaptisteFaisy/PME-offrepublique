"""Pipeline step 1 — recursive unzip + dedup.

A DCE arrives as a ZIP (often with nested ZIPs) or as loose files. We walk it
recursively, keep only the document formats we can parse (PDF/DOCX/XLSX), and
drop byte-identical duplicates (the same annexe shipped in several sub-folders
is common).
"""

from __future__ import annotations

import hashlib
import io
import logging
import posixpath
import zipfile
from dataclasses import dataclass

log = logging.getLogger(__name__)

SUPPORTED_SUFFIXES = (".pdf", ".docx", ".xlsx")
_MAX_ZIP_DEPTH = 8


@dataclass
class ExtractedFile:
    """A single parseable document pulled out of the upload."""

    filename: str  # display name (archive-relative path, or the upload name)
    content: bytes
    sha256: str


def _is_supported(name: str) -> bool:
    return name.lower().endswith(SUPPORTED_SUFFIXES)


def _is_ignored(name: str) -> bool:
    base = posixpath.basename(name)
    # macOS resource forks / hidden files.
    return "__MACOSX" in name or base.startswith("._") or base.startswith(".")


def extract_upload(data: bytes, original_filename: str) -> list[ExtractedFile]:
    """Return the deduplicated list of parseable documents in ``data``.

    ``data`` is either a ZIP or a single loose document. Nested ZIPs are
    expanded recursively.
    """
    seen: set[str] = set()
    out: list[ExtractedFile] = []

    def add(name: str, content: bytes) -> None:
        digest = hashlib.sha256(content).hexdigest()
        if digest in seen:
            log.info("skip duplicate: %s", name)
            return
        seen.add(digest)
        out.append(ExtractedFile(filename=name, content=content, sha256=digest))

    def walk_zip(blob: bytes, prefix: str, depth: int) -> None:
        if depth > _MAX_ZIP_DEPTH:
            log.warning("max zip depth reached under %s", prefix)
            return
        try:
            zf = zipfile.ZipFile(io.BytesIO(blob))
        except zipfile.BadZipFile:
            log.warning("not a valid zip: %s", prefix)
            return
        for info in zf.infolist():
            if info.is_dir() or _is_ignored(info.filename):
                continue
            name = posixpath.join(prefix, info.filename) if prefix else info.filename
            try:
                content = zf.read(info)
            except Exception:  # noqa: BLE001 — a bad entry shouldn't sink the rest
                log.exception("failed to read zip entry %s", name)
                continue
            lower = info.filename.lower()
            if lower.endswith(".zip"):
                walk_zip(content, name, depth + 1)
            elif _is_supported(lower):
                add(name, content)

    if original_filename.lower().endswith(".zip") or zipfile.is_zipfile(io.BytesIO(data)):
        walk_zip(data, prefix="", depth=0)
    elif _is_supported(original_filename):
        add(original_filename, data)
    else:
        log.warning("unsupported top-level upload: %s", original_filename)

    return out

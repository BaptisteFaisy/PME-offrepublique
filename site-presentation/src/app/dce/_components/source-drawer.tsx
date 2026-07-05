"use client";

import { useEffect, useId, useRef, useState } from "react";

import { getPage, type PageText, type Piece, type Source } from "@/lib/api";

/** Slide-over panel showing the exact page text a Fiche AO field points to. */
export function SourceDrawer({
  uploadId,
  pieces,
  source,
  onClose,
}: {
  uploadId: string;
  pieces: Piece[];
  source: Source;
  onClose: () => void;
}) {
  // Fiche sources reference a filename; the page endpoint is keyed by piece id.
  // This component is remounted per source (via `key` in the parent), so the
  // initial state below is computed once at mount from the current source.
  const piece = pieces.find((p) => p.filename === source.fichier);
  const initialError = !piece
    ? `Fichier introuvable parmi les pièces analysées : « ${source.fichier} ». ` +
      `La source indiquée par l'extraction ne correspond à aucune pièce.`
    : source.page == null
      ? "Page non précisée par l'extraction."
      : null;

  const [page, setPage] = useState<PageText | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(initialError === null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!piece || source.page == null) return; // nothing fetchable (see initialError)
    let cancelled = false;
    getPage(uploadId, piece.id, source.page)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Page introuvable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uploadId, piece, source.page]);

  // Close on Escape.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <div>
            <div className="drawer__file mono" id={titleId}>{source.fichier}</div>
            <div className="muted">
              Page {source.page}
              {piece ? ` · ${piece.piece_type} · ${piece.page_count} page(s)` : ""}
            </div>
          </div>
          <button ref={closeRef} className="btn ghost" type="button" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="drawer__body">
          {loading && <p className="muted">Chargement de la page source…</p>}
          {error && <p className="error">{error}</p>}
          {page && (
            <>
              {page.ocr_used && (
                <p className="ocr-note">
                  Page lue par OCR — le texte peut contenir des imperfections de reconnaissance.
                </p>
              )}
              <pre className="page-text">{page.text || "(page vide)"}</pre>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

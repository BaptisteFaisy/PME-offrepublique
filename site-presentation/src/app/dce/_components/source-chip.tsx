"use client";

import type { Source } from "@/lib/api";

/** True when a source actually points somewhere we can open. */
export function hasSource(s: Source | null | undefined): s is Source {
  return !!s && !!s.fichier && s.page != null;
}

/** A small clickable badge "fichier p.N" that opens the source page (CDC §6). */
export function SourceChip({
  source,
  onOpen,
}: {
  source: Source | null | undefined;
  onOpen: (s: Source) => void;
}) {
  if (!hasSource(source)) {
    return <span className="src-chip src-chip--empty">source ?</span>;
  }
  return (
    <button
      type="button"
      className="src-chip"
      onClick={() => onOpen(source)}
      title={`Voir ${source.fichier} — page ${source.page}`}
    >
      <span className="src-chip__file">{source.fichier}</span>
      <span className="src-chip__page">p.{source.page}</span>
    </button>
  );
}

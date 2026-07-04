"use client";

import { useRef, useState } from "react";

import { uploadDce } from "@/lib/api";

const ACCEPT = ".zip,.pdf,.docx,.xlsx";

export function Uploader({
  onUploaded,
}: {
  onUploaded: (uploadId: string, filename: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function send(file: File) {
    setError(null);
    setBusy(true);
    try {
      const res = await uploadDce(file);
      onUploaded(res.upload_id, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void send(file);
  }

  return (
    <div className="card">
      <strong>Nouveau DCE</strong>
      <p className="muted" style={{ margin: "4px 0 14px" }}>
        Déposez le ZIP téléchargé depuis le profil d&apos;acheteur (ou un PDF/DOCX/XLSX).
        L&apos;analyse produit la Fiche AO et le go/no-go.
      </p>

      <div
        className={`dropzone${dragOver ? " dropzone--over" : ""}${busy ? " dropzone--busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void send(file);
          }}
        />
        {busy ? (
          <span>Envoi et mise en file d&apos;analyse…</span>
        ) : (
          <span>
            <strong>Cliquez</strong> ou glissez un fichier ici
            <br />
            <span className="muted mono">.zip · .pdf · .docx · .xlsx</span>
          </span>
        )}
      </div>

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}

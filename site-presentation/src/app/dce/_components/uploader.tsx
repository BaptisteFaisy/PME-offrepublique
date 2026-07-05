"use client";

import { useRef, useState } from "react";

import { uploadDce } from "@/lib/api";
import {
  AGENTS,
  DEFAULT_AGENT_ID,
  DEFAULT_INTENSITY,
  INTENSITIES,
  resolveAgent,
  resolveIntensity,
} from "@/lib/dce/options";

const ACCEPT = ".zip,.pdf,.docx,.xlsx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp";
const AGENT_KEY = "dce.agent";
const INTENSITY_KEY = "dce.intensity";

// Lazy initial values from localStorage (client-only; the Uploader is rendered
// only after the auth check, so the server always renders the "checking" branch
// and there is no SSR/hydration mismatch — mirrors page.tsx's recent-list init).
function initialAgent(): string {
  if (typeof window === "undefined") return DEFAULT_AGENT_ID;
  try {
    return resolveAgent(localStorage.getItem(AGENT_KEY)).id;
  } catch {
    return DEFAULT_AGENT_ID;
  }
}

function initialIntensity(): string {
  if (typeof window === "undefined") return DEFAULT_INTENSITY;
  try {
    return resolveIntensity(localStorage.getItem(INTENSITY_KEY));
  } catch {
    return DEFAULT_INTENSITY;
  }
}

export function Uploader({
  onUploaded,
}: {
  onUploaded: (uploadId: string, filename: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Agent (model) + intensity (reasoning effort), remembered across sessions.
  const [agent, setAgent] = useState<string>(initialAgent);
  const [intensity, setIntensity] = useState<string>(initialIntensity);

  function chooseAgent(id: string) {
    setAgent(id);
    try {
      localStorage.setItem(AGENT_KEY, id);
    } catch {
      /* non-fatal */
    }
  }

  function chooseIntensity(id: string) {
    setIntensity(id);
    try {
      localStorage.setItem(INTENSITY_KEY, id);
    } catch {
      /* non-fatal */
    }
  }

  async function send(file: File) {
    setError(null);
    setBusy(true);
    try {
      const res = await uploadDce(file, { agent, intensity });
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
        Déposez le ZIP téléchargé depuis le profil d&apos;acheteur (ou un PDF/DOCX/XLSX, ou une
        image scannée). L&apos;analyse produit la Fiche AO et le go/no-go.
      </p>

      <div className="uploader-opts">
        <div className="field">
          <label htmlFor="dce-agent">Agent</label>
          <select
            id="dce-agent"
            value={agent}
            disabled={busy}
            onChange={(e) => chooseAgent(e.target.value)}
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.hint ? ` — ${a.hint}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="dce-intensity">Intensité</label>
          <select
            id="dce-intensity"
            value={intensity}
            disabled={busy}
            onChange={(e) => chooseIntensity(e.target.value)}
          >
            {INTENSITIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} ({i.hint})
              </option>
            ))}
          </select>
        </div>
      </div>

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
            <span className="muted mono">.zip · .pdf · .docx · .xlsx · images (OCR)</span>
          </span>
        )}
      </div>

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}

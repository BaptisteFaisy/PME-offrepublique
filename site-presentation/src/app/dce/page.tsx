"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getFiche,
  getMe,
  getPieces,
  getUploadStatus,
  logout,
  type FicheResponse,
  type Piece,
  type Source,
} from "@/lib/api";
import { FicheView } from "./_components/fiche-view";
import { GoNoGoBanner } from "./_components/gonogo-banner";
import { SourceDrawer } from "./_components/source-drawer";
import { Uploader } from "./_components/uploader";

const RECENT_KEY = "dce.recentUploads";
const POLL_MS = 2500;

type RecentUpload = { id: string; filename: string; at: number };
type LoadState = "idle" | "processing" | "ready" | "failed" | "error";

function loadRecent(): RecentUpload[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as RecentUpload[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 15) : [];
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, string> = {
  received: "Reçu",
  processing: "Analyse en cours…",
  ready: "Prêt",
  failed: "Échec",
};

export default function Home() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authed">("checking");
  const [user, setUser] = useState<string | null>(null);

  // Lazy init from localStorage (client-only; the list is only ever rendered
  // after auth, so there is no SSR/hydration mismatch).
  const [recent, setRecent] = useState<RecentUpload[]>(() =>
    typeof window === "undefined" ? [] : loadRecent(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [fiche, setFiche] = useState<FicheResponse | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- auth gate -----------------------------------------------------------
  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setAuthState("authed");
      })
      .catch(() => router.replace("/dce/login"));
  }, [router]);

  function rememberUpload(id: string, filename: string) {
    setRecent((prev) => {
      const next = [{ id, filename, at: Date.now() }, ...prev.filter((r) => r.id !== id)].slice(
        0,
        15,
      );
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable; non-fatal */
      }
      return next;
    });
  }

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadResult = useCallback(async (uploadId: string) => {
    try {
      const [f, p] = await Promise.all([getFiche(uploadId), getPieces(uploadId)]);
      setFiche(f);
      setPieces(p);
      setLoadState("ready");
    } catch (err) {
      setLoadState("error");
      setStatusMsg(err instanceof Error ? err.message : "Erreur au chargement de la Fiche AO.");
    }
  }, []);

  // --- select an upload: poll its status, then load the result -------------
  const openUpload = useCallback(
    (uploadId: string, filename: string) => {
      stopPolling();
      setSelectedId(uploadId);
      setSelectedName(filename);
      setFiche(null);
      setPieces([]);
      setActiveSource(null);
      setLoadState("processing");
      setStatusMsg(STATUS_LABEL.processing);

      const tick = async () => {
        try {
          const s = await getUploadStatus(uploadId);
          setStatusMsg(STATUS_LABEL[s.status] ?? s.status);
          if (s.status === "ready") {
            stopPolling();
            await loadResult(uploadId);
          } else if (s.status === "failed") {
            stopPolling();
            setLoadState("failed");
            setStatusMsg(s.error || "L'analyse a échoué.");
          }
        } catch (err) {
          stopPolling();
          setLoadState("error");
          setStatusMsg(err instanceof Error ? err.message : "Erreur de suivi du job.");
        }
      };

      void tick();
      pollRef.current = setInterval(tick, POLL_MS);
    },
    [stopPolling, loadResult],
  );

  useEffect(() => stopPolling, [stopPolling]);

  function onUploaded(uploadId: string, filename: string) {
    rememberUpload(uploadId, filename);
    openUpload(uploadId, filename);
  }

  async function onLogout() {
    await logout();
    router.replace("/dce/login");
  }

  if (authState === "checking") {
    return (
      <main className="container">
        <div className="card">
          <span className="muted">Vérification de la session…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="container container--wide">
      <div className="card row">
        <div>
          <h1>Usine à dossiers AO</h1>
          <p className="muted">
            M1 — Ingestion &amp; analyse du DCE · connecté en tant que{" "}
            <span className="mono">{user}</span>
          </p>
        </div>
        <button className="btn ghost" onClick={onLogout}>
          Déconnexion
        </button>
      </div>

      <div className="workspace">
        <div className="workspace__side">
          <Uploader onUploaded={onUploaded} />

          <div className="card">
            <strong>DCE récents</strong>
            {recent.length === 0 ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Aucun pour l&apos;instant.
              </p>
            ) : (
              <ul className="recent">
                {recent.map((r) => (
                  <li key={r.id}>
                    <button
                      className={`recent__item${selectedId === r.id ? " recent__item--active" : ""}`}
                      onClick={() => openUpload(r.id, r.filename)}
                    >
                      <span className="recent__name">{r.filename}</span>
                      <span className="recent__date muted mono">
                        {new Date(r.at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="workspace__main">
          {!selectedId && (
            <div className="card empty">
              <p className="muted" style={{ margin: 0 }}>
                Déposez un DCE pour générer sa Fiche AO et son go/no-go, puis vérifiez chaque
                champ à sa page source.
              </p>
            </div>
          )}

          {selectedId && (
            <>
              <div className="card row">
                <div>
                  <strong className="mono">{selectedName}</strong>
                  <div className="muted">{statusMsg}</div>
                </div>
                {(loadState === "processing" || loadState === "error" || loadState === "failed") && (
                  <button
                    className="btn ghost"
                    onClick={() => openUpload(selectedId, selectedName)}
                  >
                    Rafraîchir
                  </button>
                )}
              </div>

              {loadState === "processing" && (
                <div className="card">
                  <div className="spinner-row">
                    <span className="spinner" />
                    <span className="muted">
                      Pipeline en cours : extraction texte (+OCR), classification, Fiche AO (2
                      passes) et go/no-go…
                    </span>
                  </div>
                </div>
              )}

              {(loadState === "failed" || loadState === "error") && (
                <div className="card">
                  <p className="error" style={{ margin: 0 }}>
                    {statusMsg}
                  </p>
                </div>
              )}

              {loadState === "ready" && fiche && (
                <>
                  <GoNoGoBanner gonogo={fiche.gonogo} />

                  {fiche.warnings.length > 0 && (
                    <div className="card warnings">
                      <strong>Avertissements d&apos;ingestion</strong>
                      <ul className="bullets bullets--warn" style={{ marginTop: 8 }}>
                        {fiche.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <FicheView fiche={fiche.fiche} onOpenSource={setActiveSource} />

                  <div className="card">
                    <strong>Pièces analysées ({pieces.length})</strong>
                    <ul className="pieces">
                      {pieces.map((p) => (
                        <li key={p.id}>
                          <span className="tag">{p.piece_type}</span>
                          <span className="mono pieces__name">{p.filename}</span>
                          <span className="muted">{p.page_count} p.</span>
                        </li>
                      ))}
                    </ul>
                    {fiche.model && (
                      <p className="muted mono" style={{ margin: "10px 0 0", fontSize: 12 }}>
                        Modèle d&apos;extraction : {fiche.model}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {activeSource && selectedId && (
        <SourceDrawer
          key={`${activeSource.fichier}#${activeSource.page}`}
          uploadId={selectedId}
          pieces={pieces}
          source={activeSource}
          onClose={() => setActiveSource(null)}
        />
      )}
    </main>
  );
}

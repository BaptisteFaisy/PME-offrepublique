"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getReady, logout, type ReadyStatus } from "@/lib/api";

const MODULES = [
  { id: "M1", label: "Ingestion & analyse du DCE → Fiche AO + go/no-go" },
  { id: "M2", label: "Base de connaissances client (KB + RAG isolé)" },
  { id: "M3", label: "Générateur de mémoire technique (docx)" },
  { id: "M4", label: "Dossier administratif & conformité" },
];

export default function Home() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authed">("checking");
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth gate: no valid token -> bounce to the login page.
  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setAuthState("authed");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (authState !== "authed") return;
    getReady()
      .then(setReady)
      .catch((e) => setError(e.message));
  }, [authState]);

  function onLogout() {
    logout();
    router.replace("/login");
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
    <main className="container">
      <div className="card row">
        <div>
          <h1>Usine à dossiers AO</h1>
          <p className="muted">
            Console interne — connecté en tant que{" "}
            <span className="mono">{user}</span>
          </p>
        </div>
        <button className="btn ghost" onClick={onLogout}>
          Déconnexion
        </button>
      </div>

      <div className="card">
        <strong>État du backend</strong>
        <div style={{ marginTop: 10 }}>
          {error && <span className="pill warn">injoignable</span>}
          {!error && !ready && <span className="muted">vérification…</span>}
          {ready && (
            <span className={`pill ${ready.status === "ok" ? "ok" : "warn"}`}>
              {ready.status}
            </span>
          )}
        </div>
        {ready && (
          <ul className="mono" style={{ marginTop: 12 }}>
            {Object.entries(ready.checks).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="muted mono" style={{ marginTop: 10 }}>
            {error} — lancez le backend (docker compose up).
          </p>
        )}
      </div>

      <div className="card">
        <strong>Modules du MVP</strong>
        <ul className="modules" style={{ marginTop: 8 }}>
          {MODULES.map((m) => (
            <li key={m.id}>
              <span className="mono">{m.id}</span> — {m.label}{" "}
              <span className="muted">(à faire)</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

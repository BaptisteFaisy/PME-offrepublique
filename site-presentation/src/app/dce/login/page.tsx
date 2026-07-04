"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(user.trim(), password);
      router.replace("/dce");
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Backend injoignable.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Usine à dossiers AO</h1>
        <p className="muted">Accès réservé — authentification requise.</p>

        <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="user">Identifiant</label>
            <input
              id="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn" type="submit" disabled={busy || !user || !password}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}

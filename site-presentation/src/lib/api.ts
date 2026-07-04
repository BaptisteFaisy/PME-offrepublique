// Client-side API for the internal console (/dce).
//
// Everything is same-origin: auth is handled by route handlers under /dce/api,
// and the M1 DCE endpoints are proxied by /dce/api/uploads/* to the FastAPI
// backend (see src/lib/backend.ts). The session lives in an httpOnly cookie the
// browser sends automatically, so there is nothing to store client-side.

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Verify credentials; on success the server sets the session cookie. */
export async function login(user: string, password: string): Promise<string> {
  const res = await fetch("/dce/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, password }),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Identifiants invalides.");
  if (!res.ok) throw new Error(`Erreur (${res.status}).`);
  const data = (await res.json()) as { user: string };
  return data.user;
}

/** Return the current user, or throw if there is no valid session. */
export async function getMe(): Promise<string> {
  const res = await fetch("/dce/api/me", { cache: "no-store" });
  if (!res.ok) throw new Error("unauthorized");
  const data = (await res.json()) as { user: string };
  return data.user;
}

/** Clear the session cookie. */
export async function logout(): Promise<void> {
  await fetch("/dce/api/logout", { method: "POST", cache: "no-store" });
}

// ---------------------------------------------------------------------------
// M1 — DCE ingestion & Fiche AO
// ---------------------------------------------------------------------------

/** A source pointer: which file and 1-indexed page a value was read from. */
export type Source = { fichier: string | null; page: number | null };

export type SousCritere = { libelle: string | null; ponderation: number | null };

export type Critere = {
  libelle: string | null;
  ponderation: number | null;
  sous_criteres: SousCritere[];
  source: Source;
};

export type Lot = {
  num: number | null;
  intitule: string | null;
  estimation_eur: number | null;
  source: Source;
};

export type Exigence = { type: string | null; detail: string | null; source: Source };
export type Clause = { type: string | null; detail: string | null; source: Source };

/** The structured Fiche AO (CDC §4, M1). Mirrors app/pipeline/schema.py. */
export type Fiche = {
  reference: string | null;
  acheteur: { nom: string | null; type: string | null; profil_acheteur_url: string | null };
  objet: string | null;
  procedure: string | null;
  allotissement: Lot[];
  date_limite_offres: string | null;
  visite: { obligatoire: boolean | null; dates: string[]; contact: string | null; source: Source };
  duree: { initiale_mois: number | null; reconductions: number | null; source: Source };
  criteres: Critere[];
  cadre_reponse_impose: { present: boolean | null; fichier: string | null; source: Source };
  pieces_candidature: string[];
  pieces_offre: string[];
  exigences_bloquantes: Exigence[];
  clauses_notables: Clause[];
  questions_a_poser: string[];
  red_flags: string[];
};

export type GoNoGoDecision = "GO" | "NO-GO" | "GO_CONDITIONS";
export type Severity = "bloquant" | "attention" | "info";
export type GoNoGoReason = { code: string; message: string; severity: Severity };
export type GoNoGo = {
  decision: GoNoGoDecision;
  jours_restants: number | null;
  raisons: GoNoGoReason[];
};

export type FicheResponse = {
  upload_id: string;
  status: string;
  fiche: Fiche;
  gonogo: GoNoGo;
  warnings: string[];
  model: string | null;
};

export type UploadAccepted = { upload_id: string; status: string; job_id: string };
export type UploadStatus = {
  id: string;
  original_filename: string;
  status: string;
  error: string | null;
  created_at: string;
};
export type Piece = { id: string; filename: string; piece_type: string; page_count: number };
export type PageText = { piece_id: string; page_number: number; text: string; ocr_used: boolean };

/** Error carrying the HTTP status so callers can special-case (e.g. 409). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body (e.g. an upstream HTML error) — fall through to status
  }
  if (!res.ok) {
    const rec = (data ?? {}) as Record<string, unknown>;
    const msg =
      (typeof rec.detail === "string" && rec.detail) ||
      (typeof rec.error === "string" && rec.error) ||
      `Erreur (${res.status}).`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** Upload a DCE (ZIP or a single PDF/DOCX/XLSX). Returns the queued job id. */
export async function uploadDce(file: File): Promise<UploadAccepted> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch("/dce/api/uploads", { method: "POST", body: form, cache: "no-store" });
  return jsonOrThrow<UploadAccepted>(res);
}

export async function getUploadStatus(uploadId: string): Promise<UploadStatus> {
  const res = await fetch(`/dce/api/uploads/${uploadId}`, { cache: "no-store" });
  return jsonOrThrow<UploadStatus>(res);
}

/** Fetch the Fiche AO. Throws ApiError(409) while the pipeline is still running. */
export async function getFiche(uploadId: string): Promise<FicheResponse> {
  const res = await fetch(`/dce/api/uploads/${uploadId}/fiche`, { cache: "no-store" });
  return jsonOrThrow<FicheResponse>(res);
}

export async function getPieces(uploadId: string): Promise<Piece[]> {
  const res = await fetch(`/dce/api/uploads/${uploadId}/pieces`, { cache: "no-store" });
  return jsonOrThrow<Piece[]>(res);
}

export async function getPage(
  uploadId: string,
  pieceId: string,
  page: number,
): Promise<PageText> {
  const res = await fetch(
    `/dce/api/uploads/${uploadId}/pieces/${pieceId}/pages/${page}`,
    { cache: "no-store" },
  );
  return jsonOrThrow<PageText>(res);
}

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

/** Current session: the console user plus the Codex account powering the backend. */
export type MeResponse = { user: string; codexAccount: string };

/** Return the current session, or throw if there is no valid session. */
export async function getMe(): Promise<MeResponse> {
  const res = await fetch("/dce/api/me", { cache: "no-store" });
  if (!res.ok) throw new Error("unauthorized");
  const data = (await res.json()) as { user: string; codexAccount?: string };
  return { user: data.user, codexAccount: data.codexAccount ?? "" };
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
  reasoning: string | null;
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

/** Options chosen for one analysis run: which agent (model) and how hard it reasons. */
export type UploadOptions = { agent?: string; intensity?: string };

/** Upload a DCE (ZIP or a single PDF/DOCX/XLSX). Returns the queued job id. */
export async function uploadDce(file: File, opts: UploadOptions = {}): Promise<UploadAccepted> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (opts.agent) form.append("agent", opts.agent);
  if (opts.intensity) form.append("intensity", opts.intensity);
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

// ---------------------------------------------------------------------------
// M2 — Client knowledge base
// ---------------------------------------------------------------------------

export type KbClient = {
  id: string;
  name: string;
  siren: string | null;
  kbis_s3_key: string | null;
  kbis_issued_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type KbFinancialExercise = {
  id: string;
  fiscal_year: number;
  revenue_eur: number;
};

export type KbHeadcountSnapshot = {
  id: string;
  label: string;
  total_headcount: number;
  supervisors_count: number;
  operations_staff_count: number | null;
  details: Record<string, unknown>;
};

export type KbProductMaterial = {
  id: string;
  category: "produit" | "materiel";
  name: string;
  brand: string | null;
  quantity: string | null;
  use_case: string | null;
  ecolabels: string[];
  technical_sheet_s3_key: string | null;
};

export type KbCertification = {
  id: string;
  name: string;
  issuer: string | null;
  document_s3_key: string | null;
  obtained_on: string | null;
  expires_on: string | null;
};

export type KbInsurance = {
  id: string;
  insurance_type: string;
  provider: string | null;
  policy_number: string | null;
  coverage_summary: string | null;
  document_s3_key: string | null;
  expires_on: string | null;
};

export type KbMarketReference = {
  id: string;
  reference_client: string;
  object: string;
  amount_eur: number | null;
  duration_months: number | null;
  assigned_headcount: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  service_type: string | null;
  measurable_results: Array<Record<string, unknown>>;
};

export type KbSupervisor = {
  id: string;
  full_name: string;
  role: string | null;
  years_experience: number | null;
  cv_s3_key: string | null;
  habilitations: Array<Record<string, unknown>>;
};

export type KbQseRsePolicy = {
  id: string;
  policy_type: "QSE" | "RSE" | "QSE_RSE" | "autre";
  title: string;
  summary: string | null;
  document_s3_key: string | null;
  updated_on: string | null;
};

export type KbStaffTransferNote = {
  id: string;
  title: string;
  convention_article: string;
  staff_count: number | null;
  obligations_summary: string | null;
  commercial_argument: string;
  risk_notes: string | null;
  assumptions: string[];
};

export type KbCleaningPlanZone = {
  id: string;
  zone: string;
  frequency: string;
  operating_mode: string;
  products: string[];
  materials: string[];
};

export type KbCleaningPlan = {
  id: string;
  name: string;
  site_type: string | null;
  description: string | null;
  zones: KbCleaningPlanZone[];
};

export type KbStructuredProfile = {
  client: KbClient;
  financials: KbFinancialExercise[];
  headcounts: KbHeadcountSnapshot[];
  product_materials: KbProductMaterial[];
  certifications: KbCertification[];
  insurances: KbInsurance[];
  market_references: KbMarketReference[];
  supervisors: KbSupervisor[];
  qse_rse_policies: KbQseRsePolicy[];
  staff_transfer_notes: KbStaffTransferNote[];
  cleaning_plans: KbCleaningPlan[];
};

export type KbStructuredProfileInput = {
  client?: {
    name?: string;
    siren?: string | null;
    kbis_s3_key?: string | null;
    kbis_issued_on?: string | null;
    notes?: string | null;
  } | null;
  financials?: Array<Omit<KbFinancialExercise, "id">>;
  headcounts?: Array<Omit<KbHeadcountSnapshot, "id">>;
  product_materials?: Array<Omit<KbProductMaterial, "id">>;
  certifications?: Array<Omit<KbCertification, "id">>;
  insurances?: Array<Omit<KbInsurance, "id">>;
  market_references?: Array<Omit<KbMarketReference, "id">>;
  supervisors?: Array<Omit<KbSupervisor, "id">>;
  qse_rse_policies?: Array<Omit<KbQseRsePolicy, "id">>;
  staff_transfer_notes?: Array<Omit<KbStaffTransferNote, "id">>;
  cleaning_plans?: Array<
    Omit<KbCleaningPlan, "id" | "zones"> & {
      zones: Array<Omit<KbCleaningPlanZone, "id">>;
    }
  >;
};

export type KbRetrievalResult = {
  scope: "client" | "internal";
  chunk_id: string;
  client_id: string | null;
  document_id: string;
  document_title: string;
  source_type: string;
  service_type: string | null;
  document_date: string | null;
  outcome: string | null;
  content: string;
  distance: number;
  document_metadata: Record<string, unknown>;
  chunk_metadata: Record<string, unknown>;
};

export type KbRetrievalResponse = {
  query: string;
  embedding_model: string;
  results: KbRetrievalResult[];
};

export type KbInternalLibraryDocument = {
  id: string;
  title: string;
  source_type: "trame_generique" | "clause_type" | "modele_section" | "autre";
  service_type: string | null;
  language: string | null;
  s3_key: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listKbClients(): Promise<KbClient[]> {
  const res = await fetch("/dce/api/kb/clients", { cache: "no-store" });
  return jsonOrThrow<KbClient[]>(res);
}

export async function createKbClient(input: {
  name: string;
  siren?: string;
  notes?: string;
}): Promise<KbClient> {
  const res = await fetch("/dce/api/kb/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow<KbClient>(res);
}

export async function getKbStructuredProfile(clientId: string): Promise<KbStructuredProfile> {
  const res = await fetch(`/dce/api/kb/clients/${clientId}/structured`, { cache: "no-store" });
  return jsonOrThrow<KbStructuredProfile>(res);
}

export async function updateKbStructuredProfile(
  clientId: string,
  input: KbStructuredProfileInput,
): Promise<KbStructuredProfile> {
  const res = await fetch(`/dce/api/kb/clients/${clientId}/structured`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow<KbStructuredProfile>(res);
}

export async function importKbStructuredProfile(
  clientId: string,
  file: File,
): Promise<KbStructuredProfile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`/dce/api/kb/clients/${clientId}/structured/import`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  return jsonOrThrow<KbStructuredProfile>(res);
}

export async function uploadKbCorpusFile(
  clientId: string,
  file: File,
  input: {
    sourceType: string;
    serviceType?: string;
    outcome?: string;
    language?: string;
  },
): Promise<{ document: { id: string; title: string }; chunks: Array<{ id: string }> }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("source_type", input.sourceType);
  if (input.serviceType) form.append("service_type", input.serviceType);
  if (input.outcome) form.append("outcome", input.outcome);
  if (input.language) form.append("language", input.language);
  const res = await fetch(`/dce/api/kb/clients/${clientId}/corpus/files`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function uploadKbInternalLibraryFile(
  file: File,
  input: {
    sourceType: string;
    serviceType?: string;
    language?: string;
    isActive?: boolean;
  },
): Promise<{ document: { id: string; title: string }; chunks: Array<{ id: string }> }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("source_type", input.sourceType);
  form.append("is_active", String(input.isActive ?? true));
  if (input.serviceType) form.append("service_type", input.serviceType);
  if (input.language) form.append("language", input.language);
  const res = await fetch("/dce/api/kb/internal-library/files", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function listKbInternalLibraryDocuments(): Promise<KbInternalLibraryDocument[]> {
  const res = await fetch("/dce/api/kb/internal-library/documents", { cache: "no-store" });
  return jsonOrThrow<KbInternalLibraryDocument[]>(res);
}

export async function updateKbInternalLibraryDocument(
  documentId: string,
  input: { is_active?: boolean },
): Promise<KbInternalLibraryDocument> {
  const res = await fetch(`/dce/api/kb/internal-library/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return jsonOrThrow<KbInternalLibraryDocument>(res);
}

export async function retrieveKb(
  clientId: string,
  input: { query: string; serviceType?: string; includeInternalLibrary?: boolean },
): Promise<KbRetrievalResponse> {
  const res = await fetch(`/dce/api/kb/clients/${clientId}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      service_type: input.serviceType || null,
      include_internal_library: input.includeInternalLibrary ?? true,
      limit: 8,
    }),
    cache: "no-store",
  });
  return jsonOrThrow<KbRetrievalResponse>(res);
}

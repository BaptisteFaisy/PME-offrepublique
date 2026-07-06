"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createKbClient,
  getKbStructuredProfile,
  getMe,
  importKbStructuredProfile,
  listKbClients,
  listKbInternalLibraryDocuments,
  logout,
  retrieveKb,
  updateKbInternalLibraryDocument,
  updateKbStructuredProfile,
  uploadKbCorpusFile,
  uploadKbInternalLibraryFile,
  type KbClient,
  type KbInternalLibraryDocument,
  type KbRetrievalResult,
  type KbStructuredProfile,
  type KbStructuredProfileInput,
} from "@/lib/api";

type BusyAction =
  | "client"
  | "profile"
  | "structured"
  | "corpus"
  | "internal"
  | "search"
  | null;

export default function KbPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "authed">("checking");
  const [user, setUser] = useState<string | null>(null);
  const [clients, setClients] = useState<KbClient[]>([]);
  const [internalDocuments, setInternalDocuments] = useState<KbInternalLibraryDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState<KbStructuredProfile | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<KbRetrievalResult[]>([]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedId) ?? null,
    [clients, selectedId],
  );

  useEffect(() => {
    getMe()
      .then((m) => {
        setUser(m.user);
        setAuthState("authed");
        void refreshInternalLibrary();
        return refreshClients();
      })
      .catch(() => router.replace("/dce/login"));
  }, [router]);

  useEffect(() => {
    if (selectedId) void loadProfile(selectedId);
  }, [selectedId]);

  async function refreshClients() {
    const list = await listKbClients();
    setClients(list);
    setSelectedId((current) => current || list[0]?.id || "");
  }

  async function refreshInternalLibrary() {
    setInternalDocuments(await listKbInternalLibraryDocuments());
  }

  async function loadProfile(clientId: string) {
    setError("");
    try {
      setProfile(await getKbStructuredProfile(clientId));
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : "Chargement KB impossible.");
    }
  }

  async function onCreateClient(form: FormData) {
    setBusy("client");
    setError("");
    setMessage("");
    try {
      const client = await createKbClient({
        name: String(form.get("name") || "").trim(),
        siren: String(form.get("siren") || "").trim() || undefined,
        notes: String(form.get("notes") || "").trim() || undefined,
      });
      await refreshClients();
      setSelectedId(client.id);
      setMessage("Client KB cree.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation client impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onImportProfile(form: FormData) {
    if (!selectedId) return;
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) return;
    setBusy("profile");
    setError("");
    setMessage("");
    try {
      const updated = await importKbStructuredProfile(selectedId, file);
      setProfile(updated);
      setMessage("Profil structure importe.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import structure impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function saveStructuredProfile(input: KbStructuredProfileInput, successMessage: string) {
    if (!selectedId) return;
    setBusy("structured");
    setError("");
    setMessage("");
    try {
      const updated = await updateKbStructuredProfile(selectedId, input);
      setProfile(updated);
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour structuree impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onAddRevenue(form: FormData) {
    if (!profile) return;
    const fiscalYear = integerValue(form, "fiscalYear");
    const revenue = numberValue(form, "revenue");
    if (fiscalYear === null || revenue === null) return;

    const input = profileToInput(profile);
    const financials = [
      ...(input.financials ?? []).filter((item) => item.fiscal_year !== fiscalYear),
      { fiscal_year: fiscalYear, revenue_eur: revenue },
    ]
      .sort((left, right) => right.fiscal_year - left.fiscal_year)
      .slice(0, 3);

    await saveStructuredProfile(
      { ...input, financials },
      "Chiffre d'affaires ajoute au profil structure.",
    );
  }

  async function onAddHeadcount(form: FormData) {
    if (!profile) return;
    const label = textValue(form, "label");
    if (!label) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        headcounts: [
          ...(input.headcounts ?? []),
          {
            label,
            total_headcount: integerValue(form, "totalHeadcount") ?? 0,
            supervisors_count: integerValue(form, "supervisorsCount") ?? 0,
            operations_staff_count: integerValue(form, "operationsStaffCount"),
            details: {},
          },
        ],
      },
      "Effectif ajoute au profil structure.",
    );
  }

  async function onAddStaffTransfer(form: FormData) {
    if (!profile) return;
    const commercialArgument = textValue(form, "commercialArgument");
    if (!commercialArgument) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        staff_transfer_notes: [
          ...(input.staff_transfer_notes ?? []),
          {
            title: textValue(form, "title") || "Reprise du personnel",
            convention_article: "Article 7",
            staff_count: integerValue(form, "staffCount"),
            obligations_summary: optionalText(form, "obligationsSummary"),
            commercial_argument: commercialArgument,
            risk_notes: optionalText(form, "riskNotes"),
            assumptions: stringListValue(form, "assumptions"),
          },
        ],
      },
      "Note Article 7 ajoutee au profil structure.",
    );
  }

  async function onAddProductMaterial(form: FormData) {
    if (!profile) return;
    const name = textValue(form, "name");
    if (!name) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        product_materials: [
          ...(input.product_materials ?? []),
          {
            category: form.get("category") === "materiel" ? "materiel" : "produit",
            name,
            brand: optionalText(form, "brand"),
            quantity: optionalText(form, "quantity"),
            use_case: optionalText(form, "useCase"),
            ecolabels: stringListValue(form, "ecolabels"),
            technical_sheet_s3_key: null,
          },
        ],
      },
      "Produit ou materiel ajoute au profil structure.",
    );
  }

  async function onAddCleaningPlanZone(form: FormData) {
    if (!profile) return;
    const planName = textValue(form, "planName");
    const zone = textValue(form, "zone");
    const frequency = textValue(form, "frequency");
    const operatingMode = textValue(form, "operatingMode");
    if (!planName || !zone || !frequency || !operatingMode) return;

    const input = profileToInput(profile);
    const siteType = optionalText(form, "siteType");
    const newZone = {
      zone,
      frequency,
      operating_mode: operatingMode,
      products: stringListValue(form, "products"),
      materials: stringListValue(form, "materials"),
    };
    const cleaningPlans = [...(input.cleaning_plans ?? [])];
    const existingPlanIndex = cleaningPlans.findIndex(
      (plan) => plan.name === planName && (plan.site_type ?? null) === siteType,
    );

    if (existingPlanIndex >= 0) {
      const existingPlan = cleaningPlans[existingPlanIndex];
      cleaningPlans[existingPlanIndex] = {
        ...existingPlan,
        zones: [...existingPlan.zones, newZone],
      };
    } else {
      cleaningPlans.push({
        name: planName,
        site_type: siteType,
        description: optionalText(form, "description"),
        zones: [newZone],
      });
    }

    await saveStructuredProfile(
      { ...input, cleaning_plans: cleaningPlans },
      "Plan de nettoyage ajoute au profil structure.",
    );
  }

  async function onUpdateIdentity(form: FormData) {
    if (!profile) return;
    const input = profileToInput(profile);
    const name = textValue(form, "name");
    if (!name) return;

    await saveStructuredProfile(
      {
        ...input,
        client: {
          name,
          siren: optionalText(form, "siren"),
          kbis_s3_key: optionalText(form, "kbisS3Key"),
          kbis_issued_on: optionalText(form, "kbisIssuedOn"),
          notes: optionalText(form, "notes"),
        },
      },
      "Identite client mise a jour.",
    );
    await refreshClients();
  }

  async function onAddCertification(form: FormData) {
    if (!profile) return;
    const name = textValue(form, "name");
    if (!name) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        certifications: [
          ...(input.certifications ?? []),
          {
            name,
            issuer: optionalText(form, "issuer"),
            document_s3_key: optionalText(form, "documentS3Key"),
            obtained_on: optionalText(form, "obtainedOn"),
            expires_on: optionalText(form, "expiresOn"),
          },
        ],
      },
      "Certification ajoutee au profil structure.",
    );
  }

  async function onAddInsurance(form: FormData) {
    if (!profile) return;
    const insuranceType = textValue(form, "insuranceType");
    if (!insuranceType) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        insurances: [
          ...(input.insurances ?? []),
          {
            insurance_type: insuranceType,
            provider: optionalText(form, "provider"),
            policy_number: optionalText(form, "policyNumber"),
            coverage_summary: optionalText(form, "coverageSummary"),
            document_s3_key: optionalText(form, "documentS3Key"),
            expires_on: optionalText(form, "expiresOn"),
          },
        ],
      },
      "Assurance ajoutee au profil structure.",
    );
  }

  async function onAddMarketReference(form: FormData) {
    if (!profile) return;
    const referenceClient = textValue(form, "referenceClient");
    const object = textValue(form, "object");
    if (!referenceClient || !object) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        market_references: [
          ...(input.market_references ?? []),
          {
            reference_client: referenceClient,
            object,
            amount_eur: numberValue(form, "amount"),
            duration_months: integerValue(form, "durationMonths"),
            assigned_headcount: integerValue(form, "assignedHeadcount"),
            contact_name: optionalText(form, "contactName"),
            contact_email: optionalText(form, "contactEmail"),
            contact_phone: optionalText(form, "contactPhone"),
            service_type: optionalText(form, "serviceType"),
            measurable_results: stringListValue(form, "measurableResults").map((result) => ({
              result,
            })),
          },
        ],
      },
      "Reference de marche ajoutee au profil structure.",
    );
  }

  async function onAddSupervisor(form: FormData) {
    if (!profile) return;
    const fullName = textValue(form, "fullName");
    if (!fullName) return;

    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        supervisors: [
          ...(input.supervisors ?? []),
          {
            full_name: fullName,
            role: optionalText(form, "role"),
            years_experience: integerValue(form, "yearsExperience"),
            cv_s3_key: optionalText(form, "cvS3Key"),
            habilitations: stringListValue(form, "habilitations").map((name) => ({ name })),
          },
        ],
      },
      "Encadrant ajoute au profil structure.",
    );
  }

  async function onAddQseRsePolicy(form: FormData) {
    if (!profile) return;
    const title = textValue(form, "title");
    if (!title) return;

    const policyType = String(form.get("policyType") || "QSE_RSE");
    const input = profileToInput(profile);
    await saveStructuredProfile(
      {
        ...input,
        qse_rse_policies: [
          ...(input.qse_rse_policies ?? []),
          {
            policy_type:
              policyType === "QSE" || policyType === "RSE" || policyType === "autre"
                ? policyType
                : "QSE_RSE",
            title,
            summary: optionalText(form, "summary"),
            document_s3_key: optionalText(form, "documentS3Key"),
            updated_on: optionalText(form, "updatedOn"),
          },
        ],
      },
      "Politique QSE/RSE ajoutee au profil structure.",
    );
  }

  async function onUploadCorpus(form: FormData) {
    if (!selectedId) return;
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) return;
    setBusy("corpus");
    setError("");
    setMessage("");
    try {
      const ingested = await uploadKbCorpusFile(selectedId, file, {
        sourceType: String(form.get("sourceType") || "memoire_technique"),
        serviceType: String(form.get("serviceType") || "").trim() || undefined,
        outcome: String(form.get("outcome") || "inconnu"),
        language: String(form.get("language") || "").trim() || undefined,
      });
      setMessage(`Corpus indexe: ${ingested.chunks.length} chunk(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexation corpus impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onUploadInternalLibrary(form: FormData) {
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) return;
    setBusy("internal");
    setError("");
    setMessage("");
    try {
      const ingested = await uploadKbInternalLibraryFile(file, {
        sourceType: String(form.get("sourceType") || "trame_generique"),
        serviceType: String(form.get("serviceType") || "").trim() || undefined,
        language: String(form.get("language") || "").trim() || undefined,
        isActive: form.get("isActive") === "on",
      });
      await refreshInternalLibrary();
      setMessage(`Bibliotheque interne indexee: ${ingested.chunks.length} chunk(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexation bibliotheque impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onToggleInternalDocument(document: KbInternalLibraryDocument) {
    setBusy("internal");
    setError("");
    setMessage("");
    try {
      const updated = await updateKbInternalLibraryDocument(document.id, {
        is_active: !document.is_active,
      });
      setInternalDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(updated.is_active ? "Trame interne activee." : "Trame interne desactivee.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise a jour bibliotheque impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onRetrieve(form: FormData) {
    if (!selectedId) return;
    const query = String(form.get("query") || "").trim();
    if (!query) return;
    setBusy("search");
    setError("");
    setMessage("");
    try {
      const response = await retrieveKb(selectedId, {
        query,
        serviceType: String(form.get("serviceType") || "").trim() || undefined,
        includeInternalLibrary: form.get("includeInternalLibrary") === "on",
      });
      setResults(response.results);
      setMessage(`${response.results.length} resultat(s) via ${response.embedding_model}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche KB impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/dce/login");
  }

  if (authState === "checking") {
    return (
      <main className="container">
        <div className="card">
          <span className="muted">Verification de la session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="container container--wide">
      <header className="card row app-header">
        <div className="app-header__copy">
          <h1>Base de connaissances client</h1>
          <p className="muted">
            M2 - KB pilote proprete - connecte en tant que <span className="mono">{user}</span>
          </p>
        </div>
        <div className="kb-actions">
          <Link className="btn ghost" href="/dce">
            DCE
          </Link>
          <button className="btn ghost" type="button" onClick={onLogout}>
            Deconnexion
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={`card kb-status${error ? " kb-status--error" : ""}`} role="status">
          {error || message}
        </div>
      )}

      <div className="workspace">
        <aside className="workspace__side">
          <form action={onCreateClient} className="card">
            <strong>Nouveau client pilote</strong>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="kb-client-name">Nom</label>
              <input id="kb-client-name" name="name" required placeholder="Societe proprete" />
            </div>
            <div className="field">
              <label htmlFor="kb-client-siren">SIREN</label>
              <input id="kb-client-siren" name="siren" inputMode="numeric" placeholder="123456789" />
            </div>
            <div className="field">
              <label htmlFor="kb-client-notes">Notes</label>
              <input id="kb-client-notes" name="notes" placeholder="Pilote bureaux, IDF..." />
            </div>
            <button className="btn" type="submit" disabled={busy === "client"}>
              Creer
            </button>
          </form>

          <div className="card">
            <strong>Clients KB</strong>
            {clients.length === 0 ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Aucun client KB.
              </p>
            ) : (
              <select
                aria-label="Client KB"
                value={selectedId}
                onChange={(event) => {
                  setProfile(null);
                  setSelectedId(event.target.value);
                }}
                style={{ marginTop: 12 }}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.siren ? ` - ${client.siren}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form action={onUploadInternalLibrary} className="card">
            <strong>Bibliotheque interne</strong>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="kb-internal-file">Document</label>
              <input
                id="kb-internal-file"
                name="file"
                type="file"
                accept=".pdf,.docx,.xlsx,.txt"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="kb-internal-source-type">Type</label>
              <select
                id="kb-internal-source-type"
                name="sourceType"
                defaultValue="trame_generique"
              >
                <option value="trame_generique">Trame generique</option>
                <option value="clause_type">Clause type</option>
                <option value="modele_section">Modele section</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="kb-internal-service-type">Prestation</label>
              <input
                id="kb-internal-service-type"
                name="serviceType"
                placeholder="proprete bureaux"
              />
            </div>
            <div className="field">
              <label htmlFor="kb-internal-language">Langue</label>
              <input id="kb-internal-language" name="language" placeholder="fr" />
            </div>
            <label className="kb-check">
              <input name="isActive" type="checkbox" defaultChecked />
              Active
            </label>
            <button className="btn" type="submit" disabled={busy === "internal"}>
              Indexer
            </button>
          </form>

          <div className="card">
            <strong>Trames mutualisees</strong>
            {internalDocuments.length === 0 ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Aucune trame interne.
              </p>
            ) : (
              <ul className="recent kb-internal-list">
                {internalDocuments.slice(0, 8).map((document) => (
                  <li key={document.id}>
                    <button
                      type="button"
                      className={`recent__item${document.is_active ? " recent__item--active" : ""}`}
                      onClick={() => void onToggleInternalDocument(document)}
                      disabled={busy === "internal"}
                      aria-pressed={document.is_active}
                    >
                      <span className="recent__name">{document.title}</span>
                      <span className="recent__date">
                        {document.source_type}
                        {document.service_type ? ` - ${document.service_type}` : ""}
                      </span>
                      <span className={document.is_active ? "pill ok" : "pill warn"}>
                        {document.is_active ? "Active" : "Inactive"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="workspace__main">
          {!selectedClient ? (
            <div className="card empty">
              <p className="muted" style={{ margin: 0 }}>
                Creez ou selectionnez un client pour alimenter sa KB.
              </p>
            </div>
          ) : (
            <>
              <div className="card kb-summary">
                <div>
                  <span className="muted">Client</span>
                  <strong>{selectedClient.name}</strong>
                </div>
                <div>
                  <span className="muted">SIREN</span>
                  <strong>{selectedClient.siren || "-"}</strong>
                </div>
                <div>
                  <span className="muted">CA</span>
                  <strong>{profile?.financials.length ?? 0}</strong>
                </div>
                <div>
                  <span className="muted">Plans</span>
                  <strong>{profile?.cleaning_plans.length ?? 0}</strong>
                </div>
              </div>

              <div className="kb-grid">
                <form action={onImportProfile} className="card">
                  <strong>Import structure</strong>
                  <p className="muted" style={{ margin: "4px 0 12px" }}>
                    JSON complet ou XLSX multi-feuilles: Article 7, plans de nettoyage, produits,
                    materiel, references.
                  </p>
                  <Link
                    className="btn ghost kb-template-link"
                    href="/dce/api/kb/structured/import-template"
                  >
                    Template XLSX
                  </Link>
                  <input name="file" type="file" accept=".json,.xlsx" required />
                  <button className="btn" type="submit" disabled={busy === "profile"}>
                    Importer
                  </button>
                </form>

                <form action={onUploadCorpus} className="card">
                  <strong>Corpus RAG</strong>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="kb-corpus-file">Document</label>
                    <input id="kb-corpus-file" name="file" type="file" accept=".pdf,.docx,.xlsx,.txt" required />
                  </div>
                  <div className="uploader-opts">
                    <div className="field">
                      <label htmlFor="kb-source-type">Type</label>
                      <select id="kb-source-type" name="sourceType" defaultValue="memoire_technique">
                        <option value="memoire_technique">Memoire technique</option>
                        <option value="plaquette">Plaquette</option>
                        <option value="procedure_interne">Procedure interne</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-outcome">Issue</label>
                      <select id="kb-outcome" name="outcome" defaultValue="inconnu">
                        <option value="inconnu">Inconnue</option>
                        <option value="gagne">Gagne</option>
                        <option value="perdu">Perdu</option>
                      </select>
                    </div>
                  </div>
                  <div className="uploader-opts">
                    <div className="field">
                      <label htmlFor="kb-service-type">Prestation</label>
                      <input id="kb-service-type" name="serviceType" placeholder="proprete bureaux" />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-language">Langue</label>
                      <input id="kb-language" name="language" placeholder="fr" />
                    </div>
                  </div>
                  <button className="btn" type="submit" disabled={busy === "corpus"}>
                    Indexer
                  </button>
                </form>
              </div>

              <div className="card kb-structured-entry">
                <strong>Saisie structuree</strong>
                <div className="kb-entry-grid">
                  <form
                    key={`identity-${selectedId}`}
                    action={onUpdateIdentity}
                    className="kb-entry-form"
                  >
                    <strong>Identite / Kbis</strong>
                    <div className="field">
                      <label htmlFor="kb-identity-name">Nom</label>
                      <input
                        id="kb-identity-name"
                        name="name"
                        defaultValue={profile?.client.name ?? ""}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-identity-siren">SIREN</label>
                      <input
                        id="kb-identity-siren"
                        name="siren"
                        inputMode="numeric"
                        defaultValue={profile?.client.siren ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-identity-kbis-key">Kbis</label>
                      <input
                        id="kb-identity-kbis-key"
                        name="kbisS3Key"
                        defaultValue={profile?.client.kbis_s3_key ?? ""}
                        placeholder="s3://..."
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-identity-kbis-date">Date Kbis</label>
                      <input
                        id="kb-identity-kbis-date"
                        name="kbisIssuedOn"
                        type="date"
                        defaultValue={profile?.client.kbis_issued_on ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-identity-notes">Notes</label>
                      <textarea
                        id="kb-identity-notes"
                        name="notes"
                        rows={3}
                        defaultValue={profile?.client.notes ?? ""}
                      />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Enregistrer
                    </button>
                  </form>

                  <form action={onAddRevenue} className="kb-entry-form">
                    <strong>CA</strong>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-revenue-year">Exercice</label>
                        <input
                          id="kb-revenue-year"
                          name="fiscalYear"
                          type="number"
                          min="1900"
                          max="2200"
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-revenue-value">CA EUR</label>
                        <input
                          id="kb-revenue-value"
                          name="revenue"
                          type="number"
                          min="0"
                          step="1000"
                          required
                        />
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddHeadcount} className="kb-entry-form">
                    <strong>Effectifs</strong>
                    <div className="field">
                      <label htmlFor="kb-headcount-label">Periode</label>
                      <input id="kb-headcount-label" name="label" placeholder="2025" required />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-headcount-total">Total</label>
                        <input
                          id="kb-headcount-total"
                          name="totalHeadcount"
                          type="number"
                          min="0"
                          defaultValue="0"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-headcount-supervisors">Encadrement</label>
                        <input
                          id="kb-headcount-supervisors"
                          name="supervisorsCount"
                          type="number"
                          min="0"
                          defaultValue="0"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-headcount-ops">Agents exploitation</label>
                      <input id="kb-headcount-ops" name="operationsStaffCount" type="number" min="0" />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddStaffTransfer} className="kb-entry-form">
                    <strong>Article 7</strong>
                    <div className="field">
                      <label htmlFor="kb-article7-title">Titre</label>
                      <input
                        id="kb-article7-title"
                        name="title"
                        placeholder="Reprise du personnel sortant"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-article7-staff">Effectif repris</label>
                      <input id="kb-article7-staff" name="staffCount" type="number" min="0" />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-article7-obligations">Obligations</label>
                      <textarea id="kb-article7-obligations" name="obligationsSummary" rows={3} />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-article7-argument">Argument commercial</label>
                      <textarea id="kb-article7-argument" name="commercialArgument" rows={4} required />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-article7-risks">Risques</label>
                      <textarea id="kb-article7-risks" name="riskNotes" rows={3} />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-article7-assumptions">Hypotheses</label>
                      <input id="kb-article7-assumptions" name="assumptions" placeholder="une par ligne ou virgule" />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddProductMaterial} className="kb-entry-form">
                    <strong>Produits / materiel</strong>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-product-category">Categorie</label>
                        <select id="kb-product-category" name="category" defaultValue="produit">
                          <option value="produit">Produit</option>
                          <option value="materiel">Materiel</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="kb-product-name">Nom</label>
                        <input id="kb-product-name" name="name" required />
                      </div>
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-product-brand">Marque</label>
                        <input id="kb-product-brand" name="brand" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-product-quantity">Quantite</label>
                        <input id="kb-product-quantity" name="quantity" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-product-use">Usage</label>
                      <input id="kb-product-use" name="useCase" placeholder="sols, sanitaires..." />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-product-labels">Ecolabels</label>
                      <input id="kb-product-labels" name="ecolabels" placeholder="EU Ecolabel, Ecocert" />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddCleaningPlanZone} className="kb-entry-form">
                    <strong>Plan de nettoyage</strong>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-plan-name">Plan</label>
                        <input id="kb-plan-name" name="planName" placeholder="Tertiaire" required />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-plan-site">Site</label>
                        <input id="kb-plan-site" name="siteType" placeholder="bureaux" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-plan-description">Description</label>
                      <input id="kb-plan-description" name="description" />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-plan-zone">Zone</label>
                        <input id="kb-plan-zone" name="zone" placeholder="Accueil" required />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-plan-frequency">Frequence</label>
                        <input id="kb-plan-frequency" name="frequency" placeholder="quotidien" required />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-plan-mode">Mode operatoire</label>
                      <textarea id="kb-plan-mode" name="operatingMode" rows={4} required />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-plan-products">Produits</label>
                        <input id="kb-plan-products" name="products" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-plan-materials">Materiel</label>
                        <input id="kb-plan-materials" name="materials" />
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddMarketReference} className="kb-entry-form">
                    <strong>Reference marche</strong>
                    <div className="field">
                      <label htmlFor="kb-ref-client">Client</label>
                      <input id="kb-ref-client" name="referenceClient" required />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-ref-object">Objet</label>
                      <textarea id="kb-ref-object" name="object" rows={3} required />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-ref-amount">Montant EUR</label>
                        <input id="kb-ref-amount" name="amount" type="number" min="0" step="1000" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-ref-duration">Duree mois</label>
                        <input id="kb-ref-duration" name="durationMonths" type="number" min="0" />
                      </div>
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-ref-headcount">Effectif affecte</label>
                        <input id="kb-ref-headcount" name="assignedHeadcount" type="number" min="0" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-ref-service">Prestation</label>
                        <input id="kb-ref-service" name="serviceType" placeholder="proprete bureaux" />
                      </div>
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-ref-contact">Contact</label>
                        <input id="kb-ref-contact" name="contactName" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-ref-email">Email</label>
                        <input id="kb-ref-email" name="contactEmail" type="email" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-ref-phone">Telephone</label>
                      <input id="kb-ref-phone" name="contactPhone" />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-ref-results">Resultats mesurables</label>
                      <textarea id="kb-ref-results" name="measurableResults" rows={3} />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddSupervisor} className="kb-entry-form">
                    <strong>Encadrant</strong>
                    <div className="field">
                      <label htmlFor="kb-supervisor-name">Nom</label>
                      <input id="kb-supervisor-name" name="fullName" required />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-supervisor-role">Role</label>
                        <input id="kb-supervisor-role" name="role" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-supervisor-years">Experience</label>
                        <input id="kb-supervisor-years" name="yearsExperience" type="number" min="0" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-supervisor-cv">CV</label>
                      <input id="kb-supervisor-cv" name="cvS3Key" placeholder="s3://..." />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-supervisor-habilitations">Habilitations</label>
                      <textarea id="kb-supervisor-habilitations" name="habilitations" rows={3} />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddCertification} className="kb-entry-form">
                    <strong>Certification / label</strong>
                    <div className="field">
                      <label htmlFor="kb-cert-name">Nom</label>
                      <input id="kb-cert-name" name="name" required />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-cert-issuer">Emetteur</label>
                      <input id="kb-cert-issuer" name="issuer" />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-cert-doc">Fichier</label>
                      <input id="kb-cert-doc" name="documentS3Key" placeholder="s3://..." />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-cert-obtained">Obtention</label>
                        <input id="kb-cert-obtained" name="obtainedOn" type="date" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-cert-expires">Expiration</label>
                        <input id="kb-cert-expires" name="expiresOn" type="date" />
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddInsurance} className="kb-entry-form">
                    <strong>Assurance</strong>
                    <div className="field">
                      <label htmlFor="kb-insurance-type">Type</label>
                      <input id="kb-insurance-type" name="insuranceType" required />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-insurance-provider">Assureur</label>
                        <input id="kb-insurance-provider" name="provider" />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-insurance-policy">Police</label>
                        <input id="kb-insurance-policy" name="policyNumber" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-insurance-coverage">Couverture</label>
                      <textarea id="kb-insurance-coverage" name="coverageSummary" rows={3} />
                    </div>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-insurance-doc">Fichier</label>
                        <input id="kb-insurance-doc" name="documentS3Key" placeholder="s3://..." />
                      </div>
                      <div className="field">
                        <label htmlFor="kb-insurance-expires">Expiration</label>
                        <input id="kb-insurance-expires" name="expiresOn" type="date" />
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>

                  <form action={onAddQseRsePolicy} className="kb-entry-form">
                    <strong>QSE / RSE</strong>
                    <div className="uploader-opts">
                      <div className="field">
                        <label htmlFor="kb-qse-type">Type</label>
                        <select id="kb-qse-type" name="policyType" defaultValue="QSE_RSE">
                          <option value="QSE">QSE</option>
                          <option value="RSE">RSE</option>
                          <option value="QSE_RSE">QSE/RSE</option>
                          <option value="autre">Autre</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="kb-qse-updated">Mise a jour</label>
                        <input id="kb-qse-updated" name="updatedOn" type="date" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="kb-qse-title">Titre</label>
                      <input id="kb-qse-title" name="title" required />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-qse-summary">Synthese</label>
                      <textarea id="kb-qse-summary" name="summary" rows={4} />
                    </div>
                    <div className="field">
                      <label htmlFor="kb-qse-doc">Fichier</label>
                      <input id="kb-qse-doc" name="documentS3Key" placeholder="s3://..." />
                    </div>
                    <button className="btn" type="submit" disabled={busy === "structured"}>
                      Ajouter
                    </button>
                  </form>
                </div>
              </div>

              <form action={onRetrieve} className="card">
                <strong>Recherche RAG isolee</strong>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="kb-query">Question</label>
                  <input
                    id="kb-query"
                    name="query"
                    required
                    placeholder="Argument Article 7 pour un marche tertiaire"
                  />
                </div>
                <div className="uploader-opts">
                  <div className="field">
                    <label htmlFor="kb-query-service">Prestation</label>
                    <input id="kb-query-service" name="serviceType" placeholder="proprete bureaux" />
                  </div>
                  <label className="kb-check">
                    <input name="includeInternalLibrary" type="checkbox" defaultChecked />
                    Bibliotheque interne
                  </label>
                </div>
                <button className="btn" type="submit" disabled={busy === "search"}>
                  Rechercher
                </button>
              </form>

              {profile && (
                <div className="card">
                  <strong>Profil structure</strong>
                  <div className="kb-profile">
                    <Metric label="CA" value={profile.financials.length} />
                    <Metric label="Effectifs" value={profile.headcounts.length} />
                    <Metric label="Produits / materiel" value={profile.product_materials.length} />
                    <Metric label="Article 7" value={profile.staff_transfer_notes.length} />
                    <Metric label="Plans de nettoyage" value={profile.cleaning_plans.length} />
                    <Metric label="References" value={profile.market_references.length} />
                    <Metric label="Encadrants" value={profile.supervisors.length} />
                    <Metric label="Certifications" value={profile.certifications.length} />
                    <Metric label="Assurances" value={profile.insurances.length} />
                    <Metric label="QSE/RSE" value={profile.qse_rse_policies.length} />
                  </div>
                  {profile.cleaning_plans[0]?.zones.length ? (
                    <ul className="pieces">
                      {profile.cleaning_plans[0].zones.slice(0, 5).map((zone) => (
                        <li key={zone.id}>
                          <span className="tag">{zone.frequency}</span>
                          <span className="pieces__name">{zone.zone}</span>
                          <span className="muted">{zone.operating_mode}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}

              {results.length > 0 && (
                <div className="card">
                  <strong>Resultats</strong>
                  <ul className="kb-results">
                    {results.map((result) => (
                      <li key={result.chunk_id}>
                        <div className="row">
                          <strong>{result.document_title}</strong>
                          <span className={`tag${result.scope === "internal" ? " tag--warn" : ""}`}>
                            {result.scope}
                          </span>
                        </div>
                        <p>{result.content}</p>
                        <p className="muted mono" style={{ margin: 0 }}>
                          {result.source_type}
                          {result.service_type ? ` - ${result.service_type}` : ""} - distance{" "}
                          {result.distance.toFixed(4)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function profileToInput(profile: KbStructuredProfile): KbStructuredProfileInput {
  return {
    client: null,
    financials: withoutIds(profile.financials),
    headcounts: withoutIds(profile.headcounts),
    product_materials: withoutIds(profile.product_materials),
    certifications: withoutIds(profile.certifications),
    insurances: withoutIds(profile.insurances),
    market_references: withoutIds(profile.market_references),
    supervisors: withoutIds(profile.supervisors),
    qse_rse_policies: withoutIds(profile.qse_rse_policies),
    staff_transfer_notes: withoutIds(profile.staff_transfer_notes),
    cleaning_plans: profile.cleaning_plans.map((plan) => ({
      name: plan.name,
      site_type: plan.site_type,
      description: plan.description,
      zones: withoutIds(plan.zones),
    })),
  };
}

function withoutIds<T extends { id: string }>(items: T[]): Array<Omit<T, "id">> {
  return items.map((item) => {
    const copy = { ...item };
    delete (copy as Partial<T>).id;
    return copy as Omit<T, "id">;
  });
}

function textValue(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

function optionalText(form: FormData, key: string): string | null {
  const value = textValue(form, key);
  return value || null;
}

function integerValue(form: FormData, key: string): number | null {
  const value = textValue(form, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(form: FormData, key: string): number | null {
  const value = textValue(form, key);
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringListValue(form: FormData, key: string): string[] {
  return textValue(form, key)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

"use client";

import type { Fiche, Source } from "@/lib/api";
import { hasSource, SourceChip } from "./source-chip";

const PROCEDURE_LABEL: Record<string, string> = {
  MAPA: "MAPA",
  appel_offres_ouvert: "Appel d'offres ouvert",
  autre: "Autre",
};

const ACHETEUR_TYPE_LABEL: Record<string, string> = {
  commune: "Commune",
  departement: "Département",
  bailleur: "Bailleur",
  hopital: "Hôpital",
  etat: "État",
  autre: "Autre",
};

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // keep raw if unparseable
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OpenSource = (s: Source) => void;

/** A labelled value with an optional source chip on the right. */
function Row({
  label,
  children,
  source,
  onOpenSource,
}: {
  label: string;
  children: React.ReactNode;
  source?: Source | null;
  onOpenSource?: OpenSource;
}) {
  return (
    <div className="frow">
      <div className="frow__label">{label}</div>
      <div className="frow__value">{children}</div>
      {source !== undefined && onOpenSource && hasSource(source) && (
        <div className="frow__src">
          <SourceChip source={source} onOpen={onOpenSource} />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="fsection">
      <h3 className="fsection__title">{title}</h3>
      {children}
    </section>
  );
}

export function FicheView({
  fiche,
  onOpenSource,
}: {
  fiche: Fiche;
  onOpenSource: OpenSource;
}) {
  return (
    <div className="card fiche">
      <Section title="Identification">
        <Row label="Référence">{dash(fiche.reference)}</Row>
        <Row label="Objet">{dash(fiche.objet)}</Row>
        <Row label="Acheteur">
          {dash(fiche.acheteur?.nom)}
          {fiche.acheteur?.type && (
            <span className="tag" style={{ marginLeft: 8 }}>
              {ACHETEUR_TYPE_LABEL[fiche.acheteur.type] ?? fiche.acheteur.type}
            </span>
          )}
          {fiche.acheteur?.profil_acheteur_url && (
            <div className="muted mono" style={{ marginTop: 4, wordBreak: "break-all" }}>
              {fiche.acheteur.profil_acheteur_url}
            </div>
          )}
        </Row>
        <Row label="Procédure">
          {fiche.procedure ? (PROCEDURE_LABEL[fiche.procedure] ?? fiche.procedure) : "—"}
        </Row>
      </Section>

      <Section title="Échéances & exécution">
        <Row label="Date limite des offres">
          <strong>{formatDate(fiche.date_limite_offres)}</strong>
        </Row>
        <Row
          label="Durée"
          source={fiche.duree?.source}
          onOpenSource={onOpenSource}
        >
          {fiche.duree?.initiale_mois != null ? `${fiche.duree.initiale_mois} mois` : "—"}
          {fiche.duree?.reconductions != null
            ? ` + ${fiche.duree.reconductions} reconduction(s)`
            : ""}
        </Row>
        <Row label="Visite" source={fiche.visite?.source} onOpenSource={onOpenSource}>
          {fiche.visite?.obligatoire == null
            ? "—"
            : fiche.visite.obligatoire
              ? "Obligatoire"
              : "Facultative"}
          {fiche.visite?.dates?.length ? ` · ${fiche.visite.dates.join(", ")}` : ""}
          {fiche.visite?.contact ? ` · ${fiche.visite.contact}` : ""}
        </Row>
      </Section>

      {fiche.allotissement?.length > 0 && (
        <Section title="Allotissement">
          <ul className="flist">
            {fiche.allotissement.map((lot, i) => (
              <li key={i} className="flist__item">
                <div className="frow__value">
                  <strong>Lot {dash(lot.num)}</strong> — {dash(lot.intitule)}
                  {lot.estimation_eur != null && (
                    <span className="muted">
                      {" "}
                      · est. {lot.estimation_eur.toLocaleString("fr-FR")} €
                    </span>
                  )}
                </div>
                {hasSource(lot.source) && (
                  <SourceChip source={lot.source} onOpen={onOpenSource} />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Critères de notation">
        {fiche.criteres?.length > 0 ? (
          <ul className="flist">
            {fiche.criteres.map((c, i) => (
              <li key={i} className="flist__item flist__item--col">
                <div className="crit__head">
                  <span className="crit__pond">
                    {c.ponderation != null ? `${c.ponderation}%` : "—"}
                  </span>
                  <span className="crit__label">{dash(c.libelle)}</span>
                  {hasSource(c.source) && (
                    <SourceChip source={c.source} onOpen={onOpenSource} />
                  )}
                </div>
                {c.sous_criteres?.length > 0 && (
                  <ul className="subcrit">
                    {c.sous_criteres.map((sc, j) => (
                      <li key={j}>
                        <span className="crit__pond crit__pond--sub">
                          {sc.ponderation != null ? `${sc.ponderation}%` : "—"}
                        </span>
                        {dash(sc.libelle)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Non extrait.</p>
        )}
      </Section>

      <Section title="Cadre de réponse imposé">
        <Row
          label="Cadre imposé"
          source={fiche.cadre_reponse_impose?.source}
          onOpenSource={onOpenSource}
        >
          {fiche.cadre_reponse_impose?.present == null ? (
            "—"
          ) : fiche.cadre_reponse_impose.present ? (
            <span className="tag tag--warn">
              Oui — à respecter à la lettre
              {fiche.cadre_reponse_impose.fichier ? ` (${fiche.cadre_reponse_impose.fichier})` : ""}
            </span>
          ) : (
            "Non"
          )}
        </Row>
      </Section>

      <div className="pieces-grid">
        <Section title="Pièces de candidature">
          <ChipList items={fiche.pieces_candidature} empty="Non extrait." />
        </Section>
        <Section title="Pièces de l'offre">
          <ChipList items={fiche.pieces_offre} empty="Non extrait." />
        </Section>
      </div>

      {fiche.exigences_bloquantes?.length > 0 && (
        <Section title="Exigences bloquantes">
          <ul className="flist">
            {fiche.exigences_bloquantes.map((e, i) => (
              <li key={i} className="flist__item">
                <div className="frow__value">
                  {e.type && <span className="tag tag--warn">{e.type}</span>}{" "}
                  {dash(e.detail)}
                </div>
                {hasSource(e.source) && <SourceChip source={e.source} onOpen={onOpenSource} />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fiche.clauses_notables?.length > 0 && (
        <Section title="Clauses notables">
          <ul className="flist">
            {fiche.clauses_notables.map((c, i) => (
              <li key={i} className="flist__item">
                <div className="frow__value">
                  {c.type && <span className="tag">{c.type}</span>} {dash(c.detail)}
                </div>
                {hasSource(c.source) && <SourceChip source={c.source} onOpen={onOpenSource} />}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fiche.questions_a_poser?.length > 0 && (
        <Section title="Questions à poser à l'acheteur">
          <ul className="bullets">
            {fiche.questions_a_poser.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}

      {fiche.red_flags?.length > 0 && (
        <Section title="Points de vigilance">
          <ul className="bullets bullets--warn">
            {fiche.red_flags.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (!items?.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div className="chiplist">
      {items.map((it, i) => (
        <span key={i} className="tag">
          {it}
        </span>
      ))}
    </div>
  );
}

import {
  DocumentSearchIcon,
  PenIcon,
  ClipboardCheckIcon,
  GaugeIcon,
  CheckIcon,
} from "./icons";

const ITEMS = [
  {
    icon: DocumentSearchIcon,
    title: "La Fiche AO, en 15 minutes",
    body: "Tout le DCE lu et structuré : objet, procédure, allotissement, dates, critères pondérés, pièces exigées, clauses et red flags.",
    points: [
      "Chaque champ tracé à sa page source",
      "Pages illisibles signalées, jamais ignorées",
    ],
  },
  {
    icon: PenIcon,
    title: "Le mémoire technique, sur-mesure",
    body: "12 à 40 pages rédigées à partir de vos vraies références, moyens et certifications, avec la profondeur dictée par le poids des critères.",
    points: [
      "Ancré sur votre base — zéro fait inventé",
      "Manques marqués [À COMPLÉTER], jamais comblés au hasard",
    ],
  },
  {
    icon: ClipboardCheckIcon,
    title: "Le dossier administratif, conforme",
    body: "DC1, DC2 et tableau de références générés sans ressaisie. Coffre-fort des pièces avec leur validité et alertes avant expiration.",
    points: [
      "Checklist de conformité exhaustive",
      "Alerte à J-30 avant qu'une attestation expire",
    ],
  },
  {
    icon: GaugeIcon,
    title: "Le score Go / No-Go",
    body: "On croise les exigences bloquantes avec votre profil : chiffre d'affaires, références, distance, délai. On vous dit si le dossier vaut le coup.",
    points: [
      "GO / NO-GO / GO sous conditions, motivé",
      "On refuse les dossiers perdus d'avance",
    ],
  },
];

export function Deliverables() {
  return (
    <section id="prestations" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Ce qu&apos;on livre
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un dossier complet, pas une boîte à outils de plus
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Nous ne vendons pas un logiciel à prendre en main. Nous livrons le
            résultat&nbsp;: le dossier de réponse, prêt à déposer.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {ITEMS.map((item) => (
            <article
              key={item.title}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 transition-shadow hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                {item.body}
              </p>
              <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                {item.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

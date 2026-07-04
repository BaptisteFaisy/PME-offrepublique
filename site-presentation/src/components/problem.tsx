import { ClockIcon, DocumentSearchIcon, PenIcon, ClipboardCheckIcon } from "./icons";

const PAINS = [
  {
    icon: DocumentSearchIcon,
    title: "Un DCE illisible",
    body: "100 à 300 pages de RC, CCAP, CCTP et annexes à décortiquer pour comprendre ce qui est vraiment demandé — et ce qui est éliminatoire.",
  },
  {
    icon: PenIcon,
    title: "Un mémoire technique chronophage",
    body: "12 à 40 pages à rédiger, adaptées à chaque acheteur, pesées selon des critères pondérés. À elles seules, 12 à 18 heures de travail.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Un dossier admin à zéro erreur",
    body: "DC1, DC2, attestations à jour, pièces exactes : une seule manquante ou périmée et la candidature est écartée sans même être lue.",
  },
  {
    icon: ClockIcon,
    title: "Le temps que vous n'avez pas",
    body: "Répondre, c'est bloquer plusieurs jours d'une personne clé — sans garantie de gagner. Alors on laisse passer.",
  },
];

export function Problem() {
  return (
    <section id="probleme" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Le constat
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            La commande publique est immense. La plupart des PME n&apos;y touchent
            jamais.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Ce n&apos;est ni le savoir-faire ni la compétitivité qui manquent —
            c&apos;est le temps et la technicité d&apos;une réponse. Un seul dossier
            mobilise environ 30 heures. Résultat&nbsp;: on renonce avant même
            d&apos;avoir lu le règlement de consultation.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAINS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/[0.04] text-slate-700">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

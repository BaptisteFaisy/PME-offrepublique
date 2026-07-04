import { ArrowRightIcon, CheckIcon } from "./icons";

const INCLUDED = [
  "Analyse complète du DCE + Fiche AO traçable",
  "Score Go / No-Go argumenté avant de s'engager",
  "Mémoire technique rédigé et personnalisé",
  "Dossier administratif monté et vérifié (DC1, DC2, pièces)",
  "Checklist de conformité et contrôle avant dépôt",
  "Relecture humaine, corrections et dépôt",
];

export function Pricing() {
  return (
    <section id="tarif" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Tarif
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un prix par dossier. Rien d&apos;autre.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Pas d&apos;abonnement, pas de licence, pas d&apos;engagement. Vous payez
            un livrable&nbsp;: un dossier de réponse déposé.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr]">
              {/* Price side */}
              <div className="border-b border-slate-100 bg-slate-50 p-8 sm:border-b-0 sm:border-r">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Garantie 72 h
                </span>
                <p className="mt-5 text-sm font-medium text-slate-500">
                  Le dossier déposé
                </p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-slate-900">
                    690 €
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  par dossier, tout compris
                </p>

                <a
                  href="#contact"
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700"
                >
                  Réserver un appel
                  <ArrowRightIcon className="h-5 w-5" />
                </a>

                <p className="mt-4 rounded-xl bg-white px-3 py-3 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
                  Le chiffrage (BPU / DQE / prix) reste votre décision métier —
                  nous ne le fabriquons pas à votre place.
                </p>
              </div>

              {/* Included side */}
              <div className="p-8">
                <p className="text-sm font-semibold text-slate-900">
                  Ce qui est inclus
                </p>
                <ul className="mt-4 space-y-3">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { ArrowRightIcon, CheckIcon } from "./icons";
import { FicheAoCard } from "./fiche-ao-card";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)] opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(36,68,230,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(36,68,230,0.07) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 -z-10 h-[420px] w-[420px] rounded-full bg-brand-300/30 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24 lg:pt-24">
        {/* Copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Réponses aux appels d&apos;offres publics · pilote propreté
          </span>

          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
            Décrochez des marchés publics&nbsp;
            <span className="text-brand-600">sans la paperasse.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Nous transformons un appel d&apos;offres de 300 pages en un dossier de
            réponse complet, relu et déposé. De{" "}
            <strong className="font-semibold text-slate-900">
              ~30 heures de travail à 2 heures de relecture
            </strong>
            . Vous validez, nous déposons.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700"
            >
              Réserver un appel de 20 min
              <ArrowRightIcon className="h-5 w-5" />
            </a>
            <a
              href="#fonctionnement"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              Voir comment ça marche
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {[
              "690 € par dossier déposé",
              "Garantie 72 h",
              "Sans abonnement",
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="relative">
          <FicheAoCard />
        </div>
      </div>
    </section>
  );
}

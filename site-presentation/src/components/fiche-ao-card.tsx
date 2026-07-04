import { CheckIcon } from "./icons";

const FIELDS: { label: string; value: string; source: string }[] = [
  { label: "Date limite de remise", value: "18 sept. 2026 · 12h00", source: "RC.pdf · p.3" },
  { label: "Procédure", value: "MAPA — lot unique", source: "RC.pdf · p.2" },
  { label: "Valeur technique", value: "60 %", source: "RC.pdf · p.7" },
  { label: "Prix", value: "40 %", source: "RC.pdf · p.7" },
  { label: "Visite obligatoire", value: "Oui — 09 sept.", source: "CCTP.pdf · p.11" },
];

export function FicheAoCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Floating go/no-go chip */}
      <div className="absolute -left-4 top-8 z-20 hidden rotate-[-4deg] rounded-xl border border-emerald-200 bg-white px-3.5 py-2 shadow-xl shadow-slate-900/10 sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-medium text-slate-500">Score</p>
            <p className="text-sm font-bold text-emerald-600">GO — 82 %</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        {/* Window bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-2 text-xs font-medium text-slate-500">
            Fiche AO — Nettoyage des locaux communaux
          </span>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                Réf. 2026-AO-0471
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Commune de Saint-Aubin
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              Analysé en 14 min
            </span>
          </div>

          <dl className="divide-y divide-slate-100">
            {FIELDS.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <dt className="text-sm text-slate-500">{f.label}</dt>
                <dd className="flex items-center gap-2 text-right">
                  <span className="text-sm font-semibold text-slate-900">
                    {f.value}
                  </span>
                  <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
                    {f.source}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-800">
              <span className="font-mono font-semibold">[À COMPLÉTER]</span> — 2
              points à confirmer avant dépôt
            </p>
          </div>
        </div>
      </div>

      {/* Subtle stacked card behind */}
      <div
        aria-hidden="true"
        className="absolute inset-x-4 -bottom-3 top-3 -z-0 rounded-2xl border border-slate-200 bg-slate-100/70"
      />
    </div>
  );
}

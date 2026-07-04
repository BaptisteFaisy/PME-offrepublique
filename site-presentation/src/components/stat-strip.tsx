const STATS = [
  { value: "~30 h → 2 h", label: "de temps humain par dossier" },
  { value: "690 €", label: "le dossier déposé, tout compris" },
  { value: "< 15 min", label: "pour une Fiche AO traçable" },
  { value: "100 %", label: "des infos reliées à leur source" },
];

export function StatStrip() {
  return (
    <section aria-label="Chiffres clés" className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-6 py-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="px-2 py-6 text-center">
            <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

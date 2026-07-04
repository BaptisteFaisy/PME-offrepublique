const METRICS = [
  { value: "30 h → 2 h", label: "Temps humain par dossier, hors chiffrage" },
  { value: "< 5 min", label: "Pour analyser un DCE de 300 pages" },
  { value: "0", label: "Fait inventé — les manques sont signalés" },
  { value: "72 h", label: "De garantie sur le dossier livré" },
];

export function Metrics() {
  return (
    <section className="relative overflow-hidden bg-brand-950 py-20 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #6088ff 0, transparent 40%), radial-gradient(circle at 85% 0%, #3b62f6 0, transparent 45%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            La preuve est dans les chiffres
          </h2>
          <p className="mt-4 text-lg text-brand-100/80">
            Objectif du service&nbsp;: rendre chaque dossier rentable à 690 €, sans
            jamais transiger sur la fiabilité.
          </p>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <dt className="sr-only">{m.label}</dt>
              <dd>
                <span className="block text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {m.value}
                </span>
                <span className="mt-2 block text-sm leading-snug text-brand-100/70">
                  {m.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

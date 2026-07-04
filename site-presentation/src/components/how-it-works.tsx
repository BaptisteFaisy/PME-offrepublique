const STEPS = [
  {
    n: "01",
    title: "Vous nous transmettez l'appel d'offres",
    body: "Le ZIP du DCE téléchargé sur le profil acheteur, ou les fichiers en vrac. C'est tout ce qu'on vous demande pour démarrer.",
    tag: "5 minutes de votre temps",
  },
  {
    n: "02",
    title: "On analyse et on vous dit si ça vaut le coup",
    body: "Fiche AO structurée en moins de 15 minutes : dates, critères et pondérations, pièces exigées, exigences bloquantes — chaque information reliée à sa page source. Puis un Go / No-Go argumenté.",
    tag: "Fiche AO + score Go/No-Go",
  },
  {
    n: "03",
    title: "On monte le dossier de réponse",
    body: "Mémoire technique rédigé et ancré sur vos références, vos moyens et vos certifications réelles. Dossier administratif (DC1, DC2, attestations) rempli et vérifié. Rien n'est inventé : les manques sont signalés.",
    tag: "Mémoire technique + dossier admin",
  },
  {
    n: "04",
    title: "Vous validez, nous déposons",
    body: "Vous relisez le dossier dans Word, vous corrigez, vous décidez du prix. On finalise, on contrôle la conformité et on dépose dans les délais. Garantie 72 h.",
    tag: "Relecture, dépôt, garantie",
  },
];

export function HowItWorks() {
  return (
    <section
      id="fonctionnement"
      className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Comment ça marche
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Quatre étapes, un dossier prêt à gagner
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Un humain relit et valide chaque dossier avant l&apos;envoi. Nous
            engageons notre responsabilité sur la qualité — c&apos;est le cœur du
            service.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="group relative flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"
            >
              <div className="shrink-0">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 font-mono text-base font-bold text-white shadow-sm shadow-brand-600/25">
                  {s.n}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
                <span className="mt-4 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {s.tag}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

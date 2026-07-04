const FAQS = [
  {
    q: "Vous remplacez mon équipe ?",
    a: "Non. Nous prenons en charge la partie chronophage et technique — l'analyse du DCE, le mémoire, le dossier administratif — mais vous gardez la main : vous relisez, vous corrigez, vous validez et vous décidez du prix. Un dossier ne part jamais sans votre accord.",
  },
  {
    q: "Comment évitez-vous les erreurs et les informations inventées ?",
    a: "Deux garde-fous. D'abord, tout ce qui est rédigé s'appuie sur vos vraies données ; quand une information manque, elle est marquée [À COMPLÉTER] plutôt qu'inventée. Ensuite, un humain relit et valide chaque dossier avant l'envoi. Chaque donnée extraite du DCE pointe vers sa page source, vérifiable en un clic.",
  },
  {
    q: "Vous faites le chiffrage et les prix ?",
    a: "Non, pas au démarrage. Le chiffrage (BPU, DQE, DPGF) est un acte de jugement métier qui vous appartient. Nous produisons tout le reste du dossier ; vous renseignez les prix.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Oui. Vos informations sont chiffrées et hébergées en France / UE. Le cloisonnement entre clients est strict — même si deux de nos clients sont concurrents, les données de l'un ne peuvent jamais alimenter le dossier de l'autre. Nous n'entraînons aucun modèle sur vos données.",
  },
  {
    q: "En quoi consiste la garantie 72 h ?",
    a: "Nous nous engageons sur la complétude et la conformité du dossier livré. Concrètement : aucun dossier n'est déposé incomplet ou hors délai, et nous corrigeons tout écart signalé dans les 72 heures.",
  },
  {
    q: "Quels secteurs couvrez-vous ?",
    a: "Nous démarrons sur le secteur de la propreté, où nous modélisons finement les spécificités (reprise du personnel, plans de nettoyage, grille produits et matériel). D'autres secteurs suivront.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Questions fréquentes
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Ce qu&apos;on nous demande le plus souvent
          </h2>
        </div>

        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((item) => (
            <details key={item.q} className="group py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-transform duration-200 group-open:rotate-45"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="pb-5 pr-10 text-[15px] leading-relaxed text-slate-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

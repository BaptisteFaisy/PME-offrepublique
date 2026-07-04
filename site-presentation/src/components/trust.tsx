import { UserCheckIcon, ShieldIcon, LockIcon, FlagIcon } from "./icons";

const PILLARS = [
  {
    icon: UserCheckIcon,
    title: "Un humain valide chaque dossier",
    body: "Rien ne part sans relecture. Nous engageons notre responsabilité contractuelle sur la qualité de ce qui est déposé.",
  },
  {
    icon: ShieldIcon,
    title: "Zéro fait inventé",
    body: "Interdiction d'inventer un chiffre, une référence ou une certification. L'information manquante est marquée, pas comblée au hasard.",
  },
  {
    icon: LockIcon,
    title: "Vos données restent les vôtres",
    body: "Cloisonnement strict entre clients, même concurrents. Aucune réutilisation de vos données au profit d'un autre, aucun entraînement de modèle dessus.",
  },
  {
    icon: FlagIcon,
    title: "Hébergement en France / UE",
    body: "Vos informations commercialement sensibles — chiffre d'affaires, prix, références — sont chiffrées et hébergées en Europe.",
  },
];

export function Trust() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Pourquoi nous faire confiance
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            La fiabilité n&apos;est pas une option, c&apos;est le modèle
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Un mémoire avec des trous honnêtes vaut infiniment mieux qu&apos;un
            mémoire fluide et faux. C&apos;est votre réputation devant l&apos;acheteur
            — et la nôtre — qui est en jeu.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
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

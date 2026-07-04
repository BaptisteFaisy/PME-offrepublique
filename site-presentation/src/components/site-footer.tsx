import { Logo } from "./logo";

const FOOTER_NAV: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Le service",
    links: [
      { href: "#probleme", label: "Le constat" },
      { href: "#fonctionnement", label: "Comment ça marche" },
      { href: "#prestations", label: "Prestations" },
      { href: "#tarif", label: "Tarif" },
    ],
  },
  {
    title: "En savoir plus",
    links: [
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Réserver un appel" },
      { href: "mailto:contact@zephao.fr", label: "contact@zephao.fr" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-950 text-brand-100/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo variant="light" />
            <p className="mt-4 text-sm leading-relaxed text-brand-100/60">
              Nous produisons vos dossiers de réponse aux marchés publics, de
              l&apos;analyse du DCE au dépôt. Vous gardez la main, nous prenons la
              paperasse.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-brand-100/70">
              <span aria-hidden="true">🇫🇷</span> Données hébergées en France / UE
            </p>
          </div>

          {FOOTER_NAV.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-white">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-brand-100/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-brand-100/50 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Zephao. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-white">
              Mentions légales
            </a>
            <a href="#" className="transition-colors hover:text-white">
              Confidentialité
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

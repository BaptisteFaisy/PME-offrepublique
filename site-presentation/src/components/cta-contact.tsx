import { ArrowRightIcon, CalendarIcon, MailIcon, CheckIcon } from "./icons";

const CONTACT_EMAIL = "contact@zephao.fr";

export function CtaContact() {
  return (
    <section id="contact" className="scroll-mt-20 px-6 py-20 sm:py-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-brand-950 px-6 py-16 shadow-2xl shadow-brand-950/20 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, #6088ff 0, transparent 42%), radial-gradient(circle at 90% 80%, #3b62f6 0, transparent 45%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Un appel d&apos;offres en vue&nbsp;? Envoyez-le nous.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-brand-100/80">
            20 minutes suffisent pour voir si un dossier vaut le coup. On analyse
            un premier appel d&apos;offres avec vous et on vous montre à quoi
            ressemble la Fiche AO.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Demande%20d'appel%20-%20Zephao`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-brand-950 transition-colors hover:bg-brand-50 sm:w-auto"
            >
              <CalendarIcon className="h-5 w-5" />
              Réserver un appel de 20 min
              <ArrowRightIcon className="h-5 w-5" />
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              <MailIcon className="h-5 w-5" />
              {CONTACT_EMAIL}
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-brand-100/80">
            {["Sans engagement", "Réponse sous 24 h", "Confidentialité garantie"].map(
              (item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 text-emerald-400" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

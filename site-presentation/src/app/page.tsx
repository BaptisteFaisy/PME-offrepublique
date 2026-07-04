import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { StatStrip } from "@/components/stat-strip";
import { Problem } from "@/components/problem";
import { HowItWorks } from "@/components/how-it-works";
import { Deliverables } from "@/components/deliverables";
import { Metrics } from "@/components/metrics";
import { Pricing } from "@/components/pricing";
import { Trust } from "@/components/trust";
import { Faq } from "@/components/faq";
import { CtaContact } from "@/components/cta-contact";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <a
        href="#fonctionnement"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Aller au contenu
      </a>

      <SiteHeader />

      <main id="top" className="flex-1">
        <Hero />
        <StatStrip />
        <Problem />
        <HowItWorks />
        <Deliverables />
        <Metrics />
        <Pricing />
        <Trust />
        <Faq />
        <CtaContact />
      </main>

      <SiteFooter />
    </>
  );
}

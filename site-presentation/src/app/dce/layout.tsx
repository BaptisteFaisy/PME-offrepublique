import type { Metadata } from "next";
import "./dce.css";

export const metadata: Metadata = {
  // `absolute` so the internal console isn't branded with the public "· Zephao"
  // title template, and noindex so it never shows up in search.
  title: { absolute: "Console — Usine à dossiers AO" },
  description: "Console interne de production de réponses aux appels d'offres.",
  robots: { index: false, follow: false },
};

export default function DceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dark, self-contained shell for the internal console. The `.dce` wrapper
  // scopes all console styles (see dce.css) so they never touch the marketing
  // site rendered by the shared root layout.
  return <div className="dce">{children}</div>;
}

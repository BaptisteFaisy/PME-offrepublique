import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://zephao.fr";
const title = "Zephao — Décrochez des marchés publics sans la paperasse";
const description =
  "Nous transformons un appel d'offres public de 300 pages en un dossier de réponse complet, relu et déposé. De 30 heures de travail à 2 heures de relecture. 690 € par dossier, garantie 72 h.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Zephao",
  },
  description,
  applicationName: "Zephao",
  keywords: [
    "appels d'offres publics",
    "marchés publics",
    "réponse appel d'offres",
    "mémoire technique",
    "DCE",
    "DC1 DC2",
    "propreté",
    "PME",
  ],
  authors: [{ name: "Zephao" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Zephao",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-700">
        {children}
      </body>
    </html>
  );
}

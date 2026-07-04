import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usine à dossiers AO",
  description: "Outil interne de production de réponses aux appels d'offres.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

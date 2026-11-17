import type { Metadata } from "next";
import "./globals.css";
import "./graphics-recovery.css";
import "./mission-records.css";

export const metadata: Metadata = {
  title: "PARALLAXE — Protocole 9",
  description: "Cinq lieux, des perceptions différentes. Jeu d’horreur coopérative en 3D avec talkies, inspecteurs articulés et reflets suspects. Comparez vos observations pour sortir du Protocole 9.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

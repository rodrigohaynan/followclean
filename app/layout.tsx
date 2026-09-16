import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FollowClean — organize quem você segue",
  description:
    "Analise seus dados do Instagram, identifique quem não segue de volta e monte uma fila inteligente de revisão.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

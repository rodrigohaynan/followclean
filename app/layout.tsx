import type { Metadata, Viewport } from "next";
import { AppInstallPrompt } from "@/components/app-install-prompt";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const siteUrl = "https://followclean.netlify.app";
const title = "FollowClean — organize quem você segue";
const description =
  "Descubra quem não segue você de volta no Instagram, proteja contas importantes e monte uma fila de revisão. Os dados ficam no seu dispositivo.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · FollowClean",
  },
  description,
  applicationName: "FollowClean",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "FollowClean",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <AppInstallPrompt />
      </body>
    </html>
  );
}

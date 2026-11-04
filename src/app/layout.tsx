import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { fontVars } from "@/fonts";
import { LangSync } from "@/i18n";
import { PROJECT } from "@/lib/brand";
import { JumpBox } from "@/ui/JumpBox";
import { Toaster } from "@/ui/Toast";

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'";

export const metadata: Metadata = {
  title: { default: PROJECT.title, template: `%s · ${PROJECT.title}` },
  description: PROJECT.description,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <head>{process.env.NODE_ENV === "production" ? <meta httpEquiv="Content-Security-Policy" content={CSP} /> : null}</head>
      <body>
        <LangSync />
        {children}
        <JumpBox />
        <Toaster />
      </body>
    </html>
  );
}

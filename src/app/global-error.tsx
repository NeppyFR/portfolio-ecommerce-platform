"use client";

import Link from "next/link";
import { fontVars } from "@/fonts";
import { useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { LABEL, PROJECT } from "@/lib/brand";

/** Replaces the root layout, so global styles are gone: everything here is inline and light only. */
export default function GlobalError() {
  const lang = useLang();
  const t = useT(shell);
  const ink = "#0a1f63";
  return (
    <html lang={lang} className={fontVars} style={{ colorScheme: "light" }}>
      <body style={{ margin: 0, background: "#fff", color: ink, fontFamily: "var(--ff-ui), system-ui, sans-serif", fontSize: 16, lineHeight: 1.5 }}>
        <title>{PROJECT.title}</title>
        <main id="main" style={{ padding: "80px 24px", maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--ff-serif), Georgia, serif", fontStyle: "italic", fontSize: 24, margin: "0 0 20px" }}>{LABEL.name}</p>
          <h1 style={{ fontFamily: "var(--ff-serif), Georgia, serif", fontWeight: 300, fontSize: 44, lineHeight: 1.05, margin: 0 }}>{t.errorTitle}</h1>
          <p style={{ margin: "16px 0 0" }}>{t.errorBody}</p>
          <p style={{ margin: "24px 0 0" }}>
            <Link href="/" style={{ color: "#1c4fdc" }}>{t.errorHome}</Link>
          </p>
        </main>
      </body>
    </html>
  );
}

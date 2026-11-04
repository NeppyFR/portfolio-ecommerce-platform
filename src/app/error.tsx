"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { LABEL } from "@/lib/brand";

export default function Error() {
  const t = useT(shell);
  return (
    <main id="main" style={{ padding: "var(--s-10) var(--gutter)", maxWidth: "var(--max)", margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, marginBottom: "var(--s-5)" }}>{LABEL.name}</p>
      <h1 className="type-shop-h2">{t.errorTitle}</h1>
      <p className="type-body-l" style={{ marginTop: "var(--s-4)" }}>{t.errorBody}</p>
      <p style={{ marginTop: "var(--s-6)" }}>
        <Link href="/" style={{ color: "var(--link)", textDecoration: "underline" }}>{t.errorHome}</Link>
      </p>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDocTitle, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { ProductArt } from "@/ui";
import { ShopShell } from "./ShopShell";

/** The 404 in the shop's voice, for use inside the shop layout (unknown product or collection). */
export function NotFoundBody() {
  const t = useT(shop);
  useDocTitle(t.notFound.title);
  return (
    <section className="sp-404 f-shop">
      <div className="sp-404-copy">
        <p className="type-mono sp-eyebrow">{t.notFound.eyebrow}</p>
        <h1 className="type-shop-hero">{t.notFound.title}</h1>
        <p className="type-body-l">{t.notFound.body}</p>
        <div className="sp-404-links">
          <Link href="/shop/" className="sp-textlink">
            {t.notFound.home}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/" className="sp-textlink">
            {t.notFound.map}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <span className="sp-404-art" aria-hidden="true">
        <ProductArt type="candle" tone="ice" className="sp-tile-art" />
      </span>
    </section>
  );
}

/** `src/app/not-found.tsx` renders outside the shop layout, so it brings the shell along. */
export function NotFoundScreen() {
  return (
    <ShopShell>
      <NotFoundBody />
    </ShopShell>
  );
}

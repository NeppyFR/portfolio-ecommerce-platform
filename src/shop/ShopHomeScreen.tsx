"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { collectionHref, productHref } from "@/lib/routes";
import { useStore } from "@/store/core";
import type { Product } from "@/store/types";
import { Garment } from "@/ui";
import { PieceGarment, PriceLine, nameOf, useActiveProducts } from "./parts";

const LOOKS: { slug: string; tile: string; cls: string }[] = [
  { slug: "essential-hoodie-cobalt", tile: "t-lil", cls: "sp-lk-1" },
  { slug: "logo-tee-cloud", tile: "t-sky", cls: "sp-lk-2" },
  { slug: "washed-cap-lagoon", tile: "t-pale", cls: "sp-lk-3" },
  { slug: "relaxed-cargo-pants", tile: "t-mist", cls: "sp-lk-4" },
  { slug: "canvas-tote-cloud", tile: "t-deep", cls: "sp-lk-5" },
  { slug: "rib-beanie-frost", tile: "t-cob", cls: "sp-lk-6" },
];

function Look({ product, tile, cls, no }: { product: Product; tile: string; cls: string; no: number }) {
  const lang = useLang();
  const t = useT(shop);
  return (
    <Link href={productHref(product.slug)} className={`sp-lk ${cls}`}>
      <span className={`sp-lk-tile ${tile}`}>
        <PieceGarment product={product} className="sp-tile-g" />
      </span>
      <span className="sp-lk-cap">
        <span className="type-mono-s sp-lk-no">{fmt(t.home.look, { n: String(no).padStart(2, "0") })}</span>
        <span className="type-shop-name">{nameOf(product, lang)}</span>
        <PriceLine product={product} />
      </span>
    </Link>
  );
}

/** The lookbook: `.f-shop` hero, then six numbered looks of unequal span (7, 5, 4, 8, 6, 6). No equal grid. */
export function ShopHomeScreen() {
  const lang = useLang();
  const t = useT(shop);
  useDocTitle(shell[lang].shop);
  const active = useActiveProducts();
  const collections = useStore((s) => s.collections);
  const bySlug = useMemo(() => new Map(active.map((p) => [p.slug, p])), [active]);
  const lagoon = collections.find((c) => c.slug === "lagoon");
  const lagoonCount = lagoon ? active.filter((p) => p.collectionIds.includes(lagoon.id)).length : 0;
  const hero = bySlug.get("lagoon-zip-hoodie");
  const looks = LOOKS.flatMap((l, i) => {
    const product = bySlug.get(l.slug);
    return product ? [{ ...l, product, no: i + 1 }] : [];
  });
  const [first, ...others] = looks;
  const upper = others.slice(0, 1);
  const middle = others.slice(1, 3);
  const lower = others.slice(3);

  return (
    <>
      <section className="sp-hero f-shop">
        <span className="sp-hero-weave f-weave" aria-hidden="true" />
        <div className="sp-hero-copy">
          <h1 className="type-shop-hero">{LABEL.tagline[lang]}</h1>
          <p className="type-body-l">{t.home.heroLine}</p>
          <Link href="/shop/all/" className="sp-textlink">
            {t.home.heroLink}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {hero ? (
          <Link href={productHref(hero.slug)} className="sp-hero-piece" aria-label={nameOf(hero, lang)}>
            <PieceGarment product={hero} className="sp-hero-g" />
          </Link>
        ) : null}
      </section>

      <section className="sp-look" aria-label={t.nav.shop}>
        {first ? <Look {...first} /> : null}
        {upper.map((l) => (
          <Look key={l.slug} {...l} />
        ))}
        <figure className="sp-cuff">
          <span className="sp-cuff-tile t-ice">
            <Garment type="hoodie" tone="dusk" view="crop-cuff" title={t.home.cuffCaption} className="sp-tile-g" />
          </span>
          <figcaption className="type-mono-s">{t.home.cuffCaption}</figcaption>
        </figure>
        <blockquote className="sp-quote type-shop-quote">{t.home.quote}</blockquote>
        {middle.map((l) => (
          <Look key={l.slug} {...l} />
        ))}
        {lower.map((l) => (
          <Look key={l.slug} {...l} />
        ))}
      </section>

      <nav className="sp-ends" aria-label={t.nav.all}>
        <Link href="/shop/all/" className="type-shop-h2">
          {t.home.allPieces}
          <small className="type-mono">{active.length === 1 ? t.home.pieceLine : fmt(t.home.piecesLine, { n: active.length })}</small>
        </Link>
        <Link href={collectionHref("lagoon")} className="type-shop-h2">
          {t.home.lagoonDrop}
          <small className="type-mono">{lagoonCount === 1 ? t.home.pieceLine : fmt(t.home.piecesLine, { n: lagoonCount })}</small>
        </Link>
      </nav>
    </>
  );
}

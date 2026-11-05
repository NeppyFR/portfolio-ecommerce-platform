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
import { ProductArt } from "@/ui";
import { PieceArt, PriceLine, nameOf, useActiveProducts } from "./parts";

const PICKS: { slug: string; tile: string; cls: string }[] = [
  { slug: "desk-lamp", tile: "t-lil", cls: "sp-pk-1" },
  { slug: "logo-mug", tile: "t-sky", cls: "sp-pk-2" },
  { slug: "zip-pouch-lagoon", tile: "t-pale", cls: "sp-pk-3" },
  { slug: "stoneware-planter", tile: "t-mist", cls: "sp-pk-4" },
  { slug: "logo-notebook-cloud", tile: "t-deep", cls: "sp-pk-5" },
  { slug: "frost-candle", tile: "t-cob", cls: "sp-pk-6" },
];

function Pick({ product, tile, cls, no }: { product: Product; tile: string; cls: string; no: number }) {
  const lang = useLang();
  const t = useT(shop);
  return (
    <Link href={productHref(product.slug)} className={`sp-pk ${cls}`}>
      <span className={`sp-pk-tile ${tile}`}>
        <PieceArt product={product} className="sp-tile-art" />
      </span>
      <span className="sp-pk-cap">
        <span className="type-mono-s sp-pk-no">{fmt(t.home.pick, { n: String(no).padStart(2, "0") })}</span>
        <span className="type-shop-name">{nameOf(product, lang)}</span>
        <PriceLine product={product} />
      </span>
    </Link>
  );
}

/** The front page: `.f-shop` hero, then six numbered picks of unequal span (7, 5, 4, 8, 6, 6). No equal grid. */
export function ShopHomeScreen() {
  const lang = useLang();
  const t = useT(shop);
  useDocTitle(shell[lang].shop);
  const active = useActiveProducts();
  const collections = useStore((s) => s.collections);
  const bySlug = useMemo(() => new Map(active.map((p) => [p.slug, p])), [active]);
  const lagoon = collections.find((c) => c.slug === "lagoon");
  const lagoonCount = lagoon ? active.filter((p) => p.collectionIds.includes(lagoon.id)).length : 0;
  const hero = bySlug.get("lagoon-speaker");
  const picks = PICKS.flatMap((l, i) => {
    const product = bySlug.get(l.slug);
    return product ? [{ ...l, product, no: i + 1 }] : [];
  });
  const [first, ...others] = picks;
  const upper = others.slice(0, 1);
  const middle = others.slice(1, 3);
  const lower = others.slice(3);

  return (
    <>
      <section className="sp-hero f-shop">
        <span className="sp-hero-grid f-grid" aria-hidden="true" />
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
            <PieceArt product={hero} className="sp-hero-art" />
          </Link>
        ) : null}
      </section>

      <section className="sp-picks" aria-label={t.nav.shop}>
        {first ? <Pick {...first} /> : null}
        {upper.map((l) => (
          <Pick key={l.slug} {...l} />
        ))}
        <figure className="sp-close">
          <span className="sp-close-tile t-ice">
            <ProductArt type="speaker" tone="dusk" view="crop-detail" title={t.home.closeCaption} className="sp-tile-art" />
          </span>
          <figcaption className="type-mono-s">{t.home.closeCaption}</figcaption>
        </figure>
        <blockquote className="sp-quote type-shop-quote">{t.home.quote}</blockquote>
        {middle.map((l) => (
          <Pick key={l.slug} {...l} />
        ))}
        {lower.map((l) => (
          <Pick key={l.slug} {...l} />
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

"use client";

import Link from "next/link";
import { Ban } from "lucide-react";
import { useMemo } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { isProductSoldOut, priceRange } from "@/lib/product-rules";
import { productHref } from "@/lib/routes";
import { bagView, type BagView } from "@/store/actions/bag";
import { useStore } from "@/store/core";
import type { Lang, Product } from "@/store/types";
import { Garment } from "@/ui";

export const nameOf = (p: Pick<Product, "nameEn" | "nameDe">, lang: Lang) => (lang === "de" ? p.nameDe : p.nameEn);
export const descOf = (p: Pick<Product, "descriptionEn" | "descriptionDe">, lang: Lang) => (lang === "de" ? p.descriptionDe : p.descriptionEn);

/** Which field sits behind which piece, chosen so pale garments land on deep tiles and dark ones on pale. */
const TILE_BY_SLUG: Record<string, string> = {
  "essential-hoodie-cobalt": "t-mist",
  "lagoon-zip-hoodie": "t-pale",
  "oversized-hoodie-cloud": "t-deep",
  "logo-tee-cloud": "t-sky",
  "logo-tee-cobalt": "t-ice",
  "heavyweight-tee-lilac": "t-cob",
  "relaxed-cargo-pants": "t-lil",
  "track-pants-cobalt": "t-pale",
  "logo-cap-cobalt": "t-mist",
  "washed-cap-lagoon": "t-lil",
  "rib-beanie-frost": "t-vio",
  "canvas-tote-cloud": "t-deep",
  "frost-scarf": "t-sky",
};
const TILE_BY_TONE: Record<Product["tone"], string> = { ice: "t-sky", sky: "t-lil", azure: "t-pale", dusk: "t-mist", lilac: "t-cob" };

export const tileFor = (p: Pick<Product, "slug" | "tone">) => TILE_BY_SLUG[p.slug] ?? TILE_BY_TONE[p.tone];

export function PieceGarment({ product, view = "full", title, className }: { product: Product; view?: "full" | "crop-cuff" | "crop-hood" | "mini"; title?: string; className?: string }) {
  return <Garment type={product.garment} tone={product.tone} view={view} printed={product.printedName} title={title} className={className} />;
}

/** `CHF 39.00`, `from CHF 119.00`, or a Ban icon and `Sold out`. */
export function PriceLine({ product, className }: { product: Product; className?: string }) {
  const t = useT(shop);
  if (isProductSoldOut(product)) {
    return (
      <span className={`sp-sold type-small ${className ?? ""}`}>
        <Ban size={14} aria-hidden="true" />
        {t.wall.soldOut}
      </span>
    );
  }
  const { lowestRappen, varies } = priceRange(product);
  return <span className={`sp-price type-mono ${className ?? ""}`}>{varies ? fmt(t.wall.from, { price: formatChf(lowestRappen) }) : formatChf(lowestRappen)}</span>;
}

/** The gapless wall: four columns, two on a phone, tiles 4:5, a white caption strip under each. */
export function Wall({ products }: { products: Product[] }) {
  const lang = useLang();
  const rest = products.length % 4;
  return (
    <ul className="sp-wall">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={productHref(p.slug)} className="sp-wall-link">
            <span className={`sp-wall-tile ${tileFor(p)}`}>
              <PieceGarment product={p} className="sp-tile-g" />
            </span>
            <span className="sp-cap">
              <span className="type-shop-name">{nameOf(p, lang)}</span>
              <PriceLine product={p} />
            </span>
          </Link>
        </li>
      ))}
      {rest ? Array.from({ length: 4 - rest }, (_, i) => <li key={`d${i}`} className="sp-wall-fill f-receipt" aria-hidden="true" data-at="desktop" />) : null}
      {products.length % 2 ? <li className="sp-wall-fill f-receipt" aria-hidden="true" data-at="phone" /> : null}
    </ul>
  );
}

export function WallHead({ title, count }: { title: string; count: number }) {
  const t = useT(shop);
  return (
    <header className="sp-wall-head">
      <div>
        <p className="sp-eyebrow">{LABEL.name}</p>
        <h1 className="type-shop-h2">{title}</h1>
      </div>
      <p className="type-mono sp-count">{count === 1 ? t.wall.countOne : fmt(t.wall.count, { n: count })}</p>
    </header>
  );
}

export function useBagView(): BagView {
  const bag = useStore((s) => s.bag);
  const products = useStore((s) => s.products);
  const discounts = useStore((s) => s.discounts);
  const settings = useStore((s) => s.settings);
  return useMemo(() => bagView({ bag, products, discounts, settings }), [bag, products, discounts, settings]);
}

export function useActiveProducts(): Product[] {
  const products = useStore((s) => s.products);
  return useMemo(() => products.filter((p) => p.status === "active"), [products]);
}

/** Summary list shared by the bag and the checkout. */
export function SummaryList({ view }: { view: BagView }) {
  const t = useT(shop);
  const { quote } = view;
  return (
    <dl className="sp-sum">
      <div>
        <dt>{t.bag.subtotal}</dt>
        <dd className="type-mono">{formatChf(quote.subtotalRappen)}</dd>
      </div>
      {quote.discountRappen > 0 ? (
        <div>
          <dt>{fmt(t.bag.discount, { code: quote.code ?? "" })}</dt>
          <dd className="type-mono">−{formatChf(quote.discountRappen)}</dd>
        </div>
      ) : null}
      <div>
        <dt>
          {t.bag.shipping}
          <small className="type-small">{t.bag.shippingNote}</small>
        </dt>
        <dd className="type-mono">{quote.shippingRappen === 0 && quote.subtotalRappen > 0 ? t.bag.free : formatChf(quote.shippingRappen)}</dd>
      </div>
      <div className="sp-sum-total">
        <dt>{t.bag.total}</dt>
        <dd>{formatChf(quote.totalRappen)}</dd>
      </div>
    </dl>
  );
}

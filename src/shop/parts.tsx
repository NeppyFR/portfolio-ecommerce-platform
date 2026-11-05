"use client";

import Link from "next/link";
import { Ban } from "lucide-react";
import { useMemo } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { coloursOf, isProductSoldOut, priceRange } from "@/lib/product-rules";
import { productHref } from "@/lib/routes";
import { bagView, type BagView } from "@/store/actions/bag";
import { useStore } from "@/store/core";
import type { ArtTone, ArtView, Lang, Product, Variant } from "@/store/types";
import { ProductArt } from "@/ui";

export const nameOf = (p: Pick<Product, "nameEn" | "nameDe">, lang: Lang) => (lang === "de" ? p.nameDe : p.nameEn);
/** The colour word for a variant, only when its product comes in more than one colour. */
export const colourWord = (product: Pick<Product, "variants">, variant: Pick<Variant, "color">, words: Record<string, string>): string | null =>
  coloursOf(product.variants).length > 1 ? (words[variant.color] ?? variant.color) : null;
export const descOf = (p: Pick<Product, "descriptionEn" | "descriptionDe">, lang: Lang) => (lang === "de" ? p.descriptionDe : p.descriptionEn);

/** Which night tile sits behind which piece, chosen so the glow falls where it lifts the drawing most. */
const TILE_BY_SLUG: Record<string, string> = {
  "desk-lamp": "t-mist",
  "lagoon-speaker": "t-pale",
  "tall-lamp": "t-deep",
  "logo-mug": "t-sky",
  "studio-mug": "t-ice",
  "trail-bottle": "t-cob",
  "stoneware-planter": "t-lil",
  "shelf-speaker": "t-pale",
  "travel-pouch-cobalt": "t-mist",
  "zip-pouch-lagoon": "t-lil",
  "frost-candle": "t-vio",
  "logo-notebook-cloud": "t-deep",
  "frost-candle-trio": "t-sky",
};
const TILE_BY_TONE: Record<Product["tone"], string> = { ice: "t-sky", sky: "t-lil", azure: "t-pale", dusk: "t-mist", lilac: "t-cob" };

export const tileFor = (p: Pick<Product, "slug" | "tone">) => TILE_BY_SLUG[p.slug] ?? TILE_BY_TONE[p.tone];

export function PieceArt({ product, tone, view = "full", title, className }: { product: Product; tone?: ArtTone; view?: ArtView; title?: string; className?: string }) {
  return <ProductArt type={product.art} tone={tone ?? product.tone} view={view} printed={product.printedName} title={title} className={className} />;
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

/** The gapless wall: four columns, two on a phone, tiles 4:5, a dark caption strip under each. */
export function Wall({ products }: { products: Product[] }) {
  const lang = useLang();
  const rest = products.length % 4;
  return (
    <ul className="sp-wall">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={productHref(p.slug)} className="sp-wall-link">
            <span className={`sp-wall-tile ${tileFor(p)}`}>
              <PieceArt product={p} className="sp-tile-art" />
            </span>
            <span className="sp-cap">
              <span className="type-shop-name">{nameOf(p, lang)}</span>
              <PriceLine product={p} />
            </span>
          </Link>
        </li>
      ))}
      {rest ? Array.from({ length: 4 - rest }, (_, i) => <li key={`d${i}`} className="sp-wall-fill" aria-hidden="true" data-at="desktop" />) : null}
      {products.length % 2 ? <li className="sp-wall-fill" aria-hidden="true" data-at="phone" /> : null}
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

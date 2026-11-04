"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Ban } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { effectivePrice, isSoldOut, saleVariants, sizeLabel } from "@/lib/product-rules";
import { RUNTIME_PARAM } from "@/lib/routes";
import { addOne } from "@/store/actions/bag";
import { useStore } from "@/store/core";
import type { Product, Variant } from "@/store/types";
import { Button, Segmented } from "@/ui";
import { NotFoundBody } from "./NotFoundScreen";
import { firePacket } from "./packet";
import { PieceGarment, descOf, nameOf, tileFor } from "./parts";

function Gallery({ product }: { product: Product }) {
  const lang = useLang();
  const t = useT(shop);
  const name = nameOf(product, lang);
  const side = tileFor(product);
  return (
    <section className="sp-gal" aria-label={t.product.galleryLabel}>
      <div className="sp-gal-stage f-stage">
        <PieceGarment product={product} title={fmt(t.product.stageAlt, { name })} className="sp-tile-g" />
      </div>
      <div className="sp-gal-row">
        <div className={`sp-gal-crop ${side}`}>
          <PieceGarment product={product} view="crop-hood" title={fmt(t.product.hoodAlt, { name })} className="sp-crop-g" />
        </div>
        <div className="sp-gal-crop t-pale">
          <PieceGarment product={product} view="crop-cuff" title={fmt(t.product.cuffAlt, { name })} className="sp-crop-g" />
        </div>
      </div>
    </section>
  );
}

function Details({ product }: { product: Product }) {
  const lang = useLang();
  const t = useT(shop);
  useDocTitle(nameOf(product, lang));
  const variants = useMemo(() => saleVariants(product), [product]);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "added" | "maxed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const fallback = variants.find((v) => !isSoldOut(v)) ?? variants[0] ?? null;
  const selected: Variant | null = variants.find((v) => v.id === picked) ?? fallback;
  const soldOut = !selected || isSoldOut(selected);
  const price = selected ? formatChf(effectivePrice(product, selected)) : null;
  const description = descOf(product, lang);

  const add = () => {
    if (!selected || soldOut) return;
    const result = addOne(selected.id);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (result.ok && result.data.added > 0) {
      firePacket();
      setState("added");
      timer.current = window.setTimeout(() => setState("idle"), 2500);
    } else {
      setState("maxed");
    }
  };

  return (
    <div className="sp-pd">
      <p className="sp-pd-word">{LABEL.name}</p>
      <h1 className="sp-pd-name">{nameOf(product, lang)}</h1>
      {price ? <p className="type-mono sp-pd-price">{price}</p> : null}
      {variants.length > 1 ? (
        <div className="sp-pd-sizes">
          <p className="type-label" id="sp-size-label">
            {t.product.size}
          </p>
          <Segmented
            aria-label={t.product.size}
            className="sp-sizes"
            value={selected?.id ?? null}
            onChange={(id) => {
              setPicked(id);
              setState("idle");
            }}
            options={variants.map((v) => ({
              value: v.id,
              disabled: isSoldOut(v),
              label: isSoldOut(v) ? <span aria-label={fmt(t.product.soldOutSize, { size: sizeLabel(v.size, lang) })}>{sizeLabel(v.size, lang)}</span> : sizeLabel(v.size, lang),
            }))}
          />
        </div>
      ) : selected ? (
        <p className="type-small sp-pd-single">{fmt(t.product.sizeSingle, { size: sizeLabel(selected.size, lang) })}</p>
      ) : null}
      <div className="sp-buy">
        {price ? <span className="type-mono sp-buy-price">{price}</span> : null}
        <Button className="sp-buy-btn" disabled={soldOut} onClick={add}>
          {soldOut ? <Ban size={16} aria-hidden="true" /> : null}
          {soldOut ? t.product.soldOut : state === "added" ? t.product.added : t.product.add}
        </Button>
      </div>
      <p className="type-small sp-pd-msg" aria-live="polite">
        {state === "added" ? (
          <Link href="/shop/bag/" className="sp-textlink">
            {t.product.viewBag}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : state === "maxed" ? (
          t.product.maxed
        ) : null}
      </p>
      {description ? <p className="type-body sp-pd-desc">{description}</p> : null}
    </div>
  );
}

/** `slug` is the route param. When it is `x`, the real slug arrives as `?slug=`. Draft and archived pieces read as not found. */
export function ProductScreen({ slug }: { slug: string }) {
  const params = useSearchParams();
  const real = slug === RUNTIME_PARAM ? params.get("slug") ?? "" : slug;
  const product = useStore((s) => s.products.find((p) => p.slug === real && p.status === "active"));
  if (!product) return <NotFoundBody />;
  return (
    <article className="sp-product">
      <Details key={product.id} product={product} />
      <Gallery product={product} />
    </article>
  );
}

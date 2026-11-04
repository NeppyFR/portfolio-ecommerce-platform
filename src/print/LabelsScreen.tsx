"use client";

import { colourLabel } from "@/desk/commerce/orders/rules/order-rules";
import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, Tags, TriangleAlert } from "lucide-react";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { LABEL } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { setParams } from "@/lib/routes";
import { useStore } from "@/store/core";
import { Button, DemoPill, Empty, Input, LangToggle, Select } from "@/ui";
import { Barcode } from "./Barcode";
import { A4_PER_PAGE, BAR_HEIGHT, BAR_ROOM, MAX_COPIES, MAX_LABELS, expandLabels, hasThinBarcode, moduleFor, paginate, parseLabelParams, type LabelData, type LabelLayout } from "./label-rules";
import "./print.css";

export function LabelsScreen() {
  const t = useT(ordersDict);
  useDocTitle(t.labels.title);
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const parsed = useMemo(() => parseLabelParams({ v: params.get("v"), copies: params.get("copies"), layout: params.get("layout") }), [params]);
  const batch = useMemo(() => expandLabels(parsed, products), [parsed, products]);
  const { layout, copies } = parsed;
  const pages = useMemo(() => paginate(batch.labels, layout === "a4" ? A4_PER_PAGE : 1), [batch.labels, layout]);
  const thin = hasThinBarcode(batch.labels, layout);
  const truncated = batch.requested > MAX_LABELS;

  return (
    <main id="main" className="pr-page pr-labels-page" data-layout={layout}>
      <div className="pr-toolbar pr-toolbar-labels">
        <div className="pr-labels-head">
          <h1 className="type-title">{t.labels.title}</h1>
          <p className="type-mono-s pr-help">{fmt(t.labels.count, { labels: batch.labels.length, variants: batch.variants })}</p>
        </div>
        <Input label={t.labels.copies} type="number" min={1} max={MAX_COPIES} value={copies} className="pr-copies" onChange={(e) => setParams({ copies: String(Math.min(MAX_COPIES, Math.max(1, Number(e.target.value) || 1))) })} />
        <Select label={t.labels.layout} value={layout} className="pr-layout" onChange={(e) => setParams({ layout: e.target.value as LabelLayout })}>
          <option value="a4">{t.labels.a4}</option>
          <option value="roll">{t.labels.roll}</option>
        </Select>
        <div className="pr-toolbar-actions">
          <DemoPill />
          <LangToggle />
          <Link href="/desk/inventory/" className="ui-btn ui-btn-ghost">
            <span className="ui-btn-label">{t.labels.back}</span>
          </Link>
          <Button disabled={batch.labels.length === 0} onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            {t.labels.print}
          </Button>
        </div>
        <p className="type-small pr-help pr-hint">{t.labels.hint}</p>
        {batch.missing > 0 ? <Notice text={fmt(t.labels.missing, { n: batch.missing })} /> : null}
        {truncated ? <Notice text={fmt(t.labels.truncated, { max: MAX_LABELS, requested: batch.requested })} /> : null}
        {thin ? <Notice text={t.labels.narrow} /> : null}
      </div>

      {batch.labels.length === 0 ? (
        <div className="pr-missing">
          <Empty icon={Tags} action={<Link href="/desk/inventory/" className="ui-btn ui-btn-outline"><span className="ui-btn-label">{t.labels.toInventory}</span></Link>}>
            {t.labels.empty}
          </Empty>
        </div>
      ) : (
        <div className="pr-pages">
          {pages.map((page, i) => (
            <section key={i} className={layout === "a4" ? "pr-a4" : "pr-roll"} aria-label={fmt(t.labels.page, { n: i + 1 })}>
              {page.map((label) => (
                <OneLabel key={label.key} label={label} layout={layout} />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="pr-warning type-label" role="status">
      <TriangleAlert size={15} aria-hidden="true" />
      {text}
    </p>
  );
}

function OneLabel({ label, layout }: { label: LabelData; layout: LabelLayout }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const size = sizeLabel(label.size, lang);
  return (
    <article className="pr-label-card">
      <header>
        <span className="pr-label-name">{lang === "de" ? label.nameDe : label.nameEn}</span>
        <span className="pr-label-word">{LABEL.name}</span>
      </header>
      <p className="pr-label-meta">
        <span>{[size, colourLabel(label.color, lang)].filter(Boolean).join(" · ")}</span>
        <span className="pr-label-price">{formatChf(label.priceRappen)}</span>
      </p>
      <Barcode value={label.sku} moduleMm={moduleFor(label.sku, BAR_ROOM[layout])} heightMm={BAR_HEIGHT[layout]} label={fmt(t.slip.barcode, { value: label.sku })} />
      <p className="pr-label-sku">{label.sku}</p>
    </article>
  );
}

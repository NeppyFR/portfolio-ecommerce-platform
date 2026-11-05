"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { CODE_MAX_LENGTH, LINE_MAX_QTY } from "@/lib/pricing";
import { DISCOUNT_MESSAGES } from "@/lib/discount-rules";
import { formatChf } from "@/lib/format";
import { sizeLabel, toneForColour } from "@/lib/product-rules";
import { productHref } from "@/lib/routes";
import { applyCode, clearCode, removeLine, setQuantity, type BagRow } from "@/store/actions/bag";
import { getState } from "@/store/core";
import type { DiscountRejection } from "@/store/types";
import { Button, Empty, IconButton, Input } from "@/ui";
import { PieceArt, SummaryList, colourWord, nameOf, tileFor, useBagView } from "./parts";

function Line({ row }: { row: BagRow }) {
  const lang = useLang();
  const t = useT(shop);
  const product = row.product;
  const name = product ? nameOf(product, lang) : t.bag.unavailable;
  const sizeText = row.variant?.size === "ONE_SIZE" ? t.bag.oneSize : row.variant ? fmt(t.bag.sizeLine, { size: sizeLabel(row.variant.size, lang) }) : "";
  const size = [sizeText, product && row.variant ? colourWord(product, row.variant, t.colours) : null].filter(Boolean).join(" · ");
  const cap = Math.min(LINE_MAX_QTY, row.available);
  const problem = row.problem === "unavailable" ? t.bag.unavailable : row.problem === "soldOut" ? t.bag.soldOut : row.problem === "onlyLeft" ? fmt(t.bag.onlyLeft, { n: row.available }) : null;
  const steppable = row.problem === null || row.problem === "onlyLeft";
  return (
    <li className="sp-line">
      <span className={`sp-line-thumb ${product ? tileFor(product) : "t-pale"}`}>{product ? <PieceArt product={product} tone={toneForColour(product, row.variant?.color)} className="sp-tile-art" /> : null}</span>
      <div className="sp-line-main">
        <div className="sp-line-top">
          {product && product.status === "active" ? (
            <Link href={productHref(product.slug)} className="type-shop-name sp-line-name">
              {name}
            </Link>
          ) : (
            <span className="type-shop-name">{name}</span>
          )}
          <span className="type-mono sp-line-total">{row.lineRappen !== null ? formatChf(row.lineRappen) : ""}</span>
        </div>
        {size ? <p className="type-small sp-line-size">{size}</p> : null}
        {problem ? (
          <p className="type-small sp-err">
            <CircleAlert size={14} aria-hidden="true" />
            {problem}
          </p>
        ) : null}
        <div className="sp-line-actions">
          {steppable ? (
            <div className="sp-stepper" role="group" aria-label={t.bag.quantity}>
              <IconButton aria-label={fmt(t.bag.less, { name })} title={fmt(t.bag.less, { name })} onClick={() => setQuantity(row.variantId, row.quantity - 1)}>
                <Minus size={16} aria-hidden="true" />
              </IconButton>
              <output className="type-mono" aria-live="polite">
                {row.quantity}
              </output>
              <IconButton aria-label={fmt(t.bag.more, { name })} title={fmt(t.bag.more, { name })} disabled={row.quantity >= cap} onClick={() => setQuantity(row.variantId, row.quantity + 1)}>
                <Plus size={16} aria-hidden="true" />
              </IconButton>
            </div>
          ) : null}
          <Button variant="ghost" onClick={() => removeLine(row.variantId)}>
            <X size={15} aria-hidden="true" />
            {t.bag.remove}
          </Button>
        </div>
      </div>
    </li>
  );
}

function CodeForm({ active, rejection, onRejected }: { active: string | null; rejection: DiscountRejection | null; onRejected: (r: DiscountRejection | null) => void }) {
  const lang = useLang();
  const t = useT(shop);
  const [typed, setTyped] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = applyCode(typed);
    if (result.ok) {
      onRejected(null);
      setTyped("");
    } else {
      onRejected(result.code as DiscountRejection);
    }
  };
  if (active) {
    return (
      <div className="sp-code-on">
        <p className="type-small">{fmt(t.bag.codeActive, { code: active })}</p>
        <Button variant="ghost" onClick={clearCode}>
          {t.bag.codeRemove}
        </Button>
      </div>
    );
  }
  return (
    <form className="sp-code" onSubmit={submit} noValidate>
      <Input
        label={t.bag.codeLabel}
        value={typed}
        maxLength={CODE_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        className="sp-code-field"
        error={rejection ? DISCOUNT_MESSAGES[rejection][lang] : null}
        hint={rejection ? null : t.bag.codeHint}
        onChange={(e) => {
          setTyped(e.target.value);
          if (rejection) onRejected(null);
        }}
      />
      <Button type="submit" variant="outline" disabled={!typed.trim()}>
        {t.bag.codeApply}
      </Button>
    </form>
  );
}

/** Lines and a sticky summary. A code that stops holding (say the bag drops below its minimum) is taken off with its message. */
export function BagScreen() {
  const t = useT(shop);
  useDocTitle(t.bag.title);
  const view = useBagView();
  const [rejection, setRejection] = useState<DiscountRejection | null>(null);
  const [ready, setReady] = useState(false);
  const refused = view.quote.codeRejection;
  const lastCode = useRef<string | null>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    lastCode.current = getState().bag.code;
    if (refused && lastCode.current) {
      setRejection(refused);
      clearCode();
    }
  }, [refused]);

  const head = (
    <header className="sp-page-head">
      <p className="sp-eyebrow">{LABEL.name}</p>
      <h1 className="type-shop-h2">{t.bag.title}</h1>
    </header>
  );

  if (!ready) return <div className="sp-page">{head}<div className="sp-blank" /></div>;
  if (view.rows.length === 0) {
    return (
      <div className="sp-page">
        {head}
        <Empty
          icon={ShoppingBag}
          action={
            <Link href="/shop/all/" className="sp-textlink">
              {t.bag.shopNow}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          {t.bag.empty}
        </Empty>
      </div>
    );
  }

  const canCheckout = !view.hasProblem && view.quote.totalRappen > 0;
  return (
    <div className="sp-page">
      {head}
      <div className="sp-bag-grid">
        <ul className="sp-lines" aria-label={t.bag.linesLabel}>
          {view.rows.map((row) => (
            <Line key={row.variantId} row={row} />
          ))}
        </ul>
        <aside className="sp-summary" aria-label={t.bag.summaryLabel}>
          <SummaryList view={view} />
          <CodeForm active={view.quote.code} rejection={rejection} onRejected={setRejection} />
          <div className="sp-go">
            {canCheckout ? (
              <Link href="/shop/checkout/" className="ui-btn ui-btn-solid sp-go-btn">
                {t.bag.checkout}
              </Link>
            ) : (
              <Button className="sp-go-btn" disabled>
                {t.bag.checkout}
              </Button>
            )}
          </div>
          {view.hasProblem ? <p className="type-small sp-err-text">{t.bag.fixLines}</p> : null}
        </aside>
      </div>
    </div>
  );
}

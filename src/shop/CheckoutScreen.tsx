"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Ban, CheckCircle2, CircleX, DoorOpen, Hourglass, Pencil, RotateCcw, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { DISCOUNT_MESSAGES } from "@/lib/discount-rules";
import { formatChf } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { checkoutResultHref } from "@/lib/routes";
import { bagView } from "@/store/actions/bag";
import { checkForm, demoForm, endCheckout, firstProblem, type CheckoutForm, type FormField, type FormProblem, type FormProblems } from "@/store/actions/checkout";
import { getState } from "@/store/core";
import { findVariant } from "@/store/flows";
import type { CheckoutOutcome, DiscountRejection, Lang } from "@/store/types";
import { Button, Empty, Input, RuleLine } from "@/ui";
import { ResultPanel } from "./ResultPanel";
import { PieceGarment, SummaryList, nameOf, useBagView } from "./parts";

const PENDING_MS = 900;

function OrderAside() {
  const lang = useLang();
  const t = useT(shop);
  const view = useBagView();
  return (
    <aside className="sp-summary sp-co-aside" aria-label={t.checkout.yourOrder}>
      <h2 className="type-h4">{t.checkout.yourOrder}</h2>
      <ul className="sp-co-lines">
        {view.rows.map((row) => (
          <li key={row.variantId}>
            <span className="sp-co-thumb">{row.product ? <PieceGarment product={row.product} view="mini" className="sp-tile-g" /> : null}</span>
            <span className="sp-co-name">
              <span className="type-label">{row.product ? nameOf(row.product, lang) : ""}</span>
              <span className="type-small">
                {[row.variant && row.variant.size !== "ONE_SIZE" ? sizeLabel(row.variant.size, lang) : null, fmt(t.checkout.qty, { n: row.quantity })].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="type-mono">{row.lineRappen !== null ? formatChf(row.lineRappen) : ""}</span>
          </li>
        ))}
      </ul>
      <SummaryList view={view} />
      <Link href="/shop/bag/" className="sp-textlink sp-co-back">
        <ArrowLeft size={14} aria-hidden="true" />
        {t.checkout.backToBag}
      </Link>
    </aside>
  );
}

function DetailsForm({ form, setForm, onDone }: { form: CheckoutForm; setForm: (fn: (f: CheckoutForm) => CheckoutForm) => void; onDone: () => void }) {
  const t = useT(shop);
  const [problems, setProblems] = useState<FormProblems>({});
  const [boxProblem, setBoxProblem] = useState<FormProblem | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const word = (p: FormProblem) => t.checkout[p];
  const bind = (field: FormField) => ({
    value: form[field],
    error: problems[field] ? word(problems[field] as FormProblem) : null,
    onChange: (e: { target: { value: string } }) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      setProblems((p) => ({ ...p, [field]: undefined }));
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = checkForm(form);
    setProblems(found);
    const first = firstProblem(found);
    if (first) {
      setBoxProblem(first.problem);
      window.setTimeout(() => box.current?.focus(), 0);
      return;
    }
    setBoxProblem(null);
    onDone();
  };
  return (
    <form onSubmit={submit} noValidate className="sp-co-form">
      {boxProblem ? (
        <div className="sp-co-box" ref={box} tabIndex={-1} role="alert">
          <strong>{t.checkout.errorTitle}</strong>
          <p className="type-small">{word(boxProblem)}</p>
        </div>
      ) : null}
      <fieldset>
        <legend className="type-label">{t.checkout.contact}</legend>
        <div className="sp-co-two">
          <Input label={t.checkout.first} maxLength={50} autoComplete="given-name" {...bind("first")} />
          <Input label={t.checkout.last} maxLength={50} autoComplete="family-name" {...bind("last")} />
        </div>
        <Input label={t.checkout.email} type="email" maxLength={254} autoComplete="email" {...bind("email")} />
        <Input label={t.checkout.phone} type="tel" maxLength={40} autoComplete="tel" hint={t.checkout.phoneHint} {...bind("phone")} />
      </fieldset>
      <fieldset>
        <legend className="type-label">{t.checkout.address}</legend>
        <Input label={t.checkout.line1} maxLength={100} autoComplete="address-line1" {...bind("line1")} />
        <Input label={t.checkout.line2} maxLength={100} autoComplete="address-line2" {...bind("line2")} />
        <div className="sp-co-pc">
          <Input label={t.checkout.postal} maxLength={4} inputMode="numeric" autoComplete="postal-code" {...bind("postalCode")} />
          <Input label={t.checkout.city} maxLength={60} autoComplete="address-level2" {...bind("city")} />
        </div>
        <div className="sp-co-country">
          <span className="type-label">{t.checkout.country}</span>
          <span className="type-body">{t.checkout.countryValue}</span>
          <span className="type-small">{t.checkout.countryNote}</span>
        </div>
      </fieldset>
      <div className="sp-co-actions">
        <Button type="submit">
          {t.checkout.continue}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setForm(() => demoForm());
            setProblems({});
            setBoxProblem(null);
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          {t.checkout.reset}
        </Button>
      </div>
    </form>
  );
}

type Choice = { outcome: CheckoutOutcome; icon: typeof CheckCircle2 };
const CHOICES: Choice[] = [
  { outcome: "paid", icon: CheckCircle2 },
  { outcome: "declined", icon: CircleX },
  { outcome: "walked_away", icon: DoorOpen },
  { outcome: "timed_out", icon: Hourglass },
];
type MainOutcome = "paid" | "declined" | "walked_away" | "timed_out";
/** Worded when it renders, so a refusal follows a language switch. */
type Refusal = (dict: (typeof shop)[Lang], lang: Lang) => string;

/** Details, then "How should this one end?". Four outcomes and one small fifth, then 900 ms of pending state. */
export function CheckoutScreen() {
  const lang = useLang();
  const t = useT(shop);
  useDocTitle(t.checkout.title);
  const router = useRouter();
  const view = useBagView();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<CheckoutForm>(demoForm);
  const [step, setStep] = useState<1 | 2>(1);
  const [shownTotal, setShownTotal] = useState(0);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const timer = useRef<number | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const stepTwo = useRef<HTMLHeadingElement>(null);

  useEffect(() => setReady(true), []);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const toStep2 = () => {
    setShownTotal(view.quote.totalRappen);
    setRefusal(null);
    setStep(2);
    window.setTimeout(() => {
      stepTwo.current?.focus({ preventScroll: true });
      stepTwo.current?.scrollIntoView({ block: "start" });
    }, 0);
  };

  const refuse = (text: Refusal) => {
    setPending(false);
    setRefusal(() => text);
    setStep(1);
    window.setTimeout(() => messageRef.current?.focus(), 0);
  };

  const finish = (outcome: CheckoutOutcome) => {
    const result = endCheckout(form, outcome, lang, shownTotal);
    if (result.ok) {
      router.push(checkoutResultHref(result.data.state, result.data.orderNumber ?? undefined));
      return;
    }
    const { code, message: detail } = result;
    if (code === "PRICE_CHANGED") {
      setShownTotal(bagView(getState()).quote.totalRappen);
      refuse((d) => d.checkout.priceChanged);
    } else if (code === "OUT_OF_STOCK") {
      const found = findVariant(getState(), detail);
      const row = bagView(getState()).rows.find((r) => r.variantId === detail);
      refuse((d, l) => (found && row ? fmt(d.checkout.outOfStock, { name: nameOf(found.product, l), n: row.available }) : d.checkout.outOfStockGeneric));
    } else if (code === "VARIANT_UNAVAILABLE") {
      refuse((d) => d.checkout.unavailable);
    } else if (code === "DISCOUNT_INVALID") {
      refuse((_, l) => DISCOUNT_MESSAGES[detail as DiscountRejection]?.[l] ?? DISCOUNT_MESSAGES.other[l]);
    } else if (code === "TOTAL_TOO_LOW") {
      refuse((d) => d.checkout.totalTooLow);
    } else if (code === "CART_INVALID") {
      refuse((d) => d.checkout.cartInvalid);
    } else {
      refuse((d) => d.checkout.generic);
    }
  };

  const choose = (outcome: CheckoutOutcome) => {
    if (pending) return;
    setPending(true);
    timer.current = window.setTimeout(() => finish(outcome), PENDING_MS);
  };

  if (pending) return <ResultPanel state="pending" orderNumber={null} />;

  const head = (
    <header className="sp-page-head">
      <p className="sp-eyebrow">{LABEL.name}</p>
      <h1 className="type-shop-h2">{t.checkout.title}</h1>
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

  return (
    <div className="sp-page">
      {head}
      <div className="sp-co-grid">
        <div className="sp-co-main">
          {refusal ? (
            <div className="sp-co-box" ref={messageRef} tabIndex={-1} role="alert">
              <strong>{t.checkout.errorTitle}</strong>
              <p className="type-small">{refusal(t, lang)}</p>
            </div>
          ) : null}
          <section className="sp-co-step" aria-current={step === 1 ? "step" : undefined}>
            <header className="sp-co-step-head">
              <span className="type-mono sp-co-no">1</span>
              <h2 className="sp-co-title">{t.checkout.step1}</h2>
              {step === 2 ? (
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <Pencil size={14} aria-hidden="true" />
                  {t.checkout.edit}
                </Button>
              ) : null}
            </header>
            {step === 1 ? (
              <DetailsForm form={form} setForm={setForm} onDone={toStep2} />
            ) : (
              <p className="type-body sp-co-recap">
                {form.first} {form.last}, {form.email}
                <br />
                {form.line1}
                {form.line2 ? `, ${form.line2}` : ""}, {form.postalCode} {form.city}
              </p>
            )}
          </section>
          <section className="sp-co-step" aria-current={step === 2 ? "step" : undefined} data-off={step === 1 || undefined}>
            <header className="sp-co-step-head">
              <span className="type-mono sp-co-no">2</span>
              <h2 className="sp-co-title" ref={stepTwo} tabIndex={-1}>
                {t.checkout.step2}
              </h2>
            </header>
            {step === 2 ? (
              <>
                <p className="type-body sp-co-lead">{t.checkout.step2Lead}</p>
                <div className="sp-outcomes">
                  {CHOICES.map(({ outcome, icon: Icon }) => {
                    const copy = t.checkout.outcomes[outcome as MainOutcome];
                    return (
                      <button key={outcome} type="button" className="sp-outcome" data-outcome={outcome} onClick={() => choose(outcome)}>
                        <Icon size={20} aria-hidden="true" />
                        <span className="sp-outcome-text">
                          <span className="sp-outcome-title">{copy.title}</span>
                          <span className="type-small">{copy.body}</span>
                        </span>
                        <ArrowRight size={16} aria-hidden="true" className="sp-outcome-go" />
                      </button>
                    );
                  })}
                </div>
                <RuleLine className="sp-co-rule">{t.checkout.outcomes.declined.rule}</RuleLine>
                <p className="type-small sp-co-late">
                  <Ban size={14} aria-hidden="true" />
                  <button type="button" className="sp-linkbtn" onClick={() => choose("paid_after_hold")}>
                    {t.checkout.lateLink}
                  </button>
                  <span>{t.checkout.lateNote}</span>
                </p>
                <p className="type-small sp-co-note">{t.checkout.testNote}</p>
              </>
            ) : null}
          </section>
        </div>
        <OrderAside />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { seedRows } from "@/i18n/dict/seed-text";
import { formatDate, formatMinor, parseChf } from "@/lib/format";
import { costProblem, saveCost, savePrices, saveRate, type CostInput, type PlanEdit } from "@/store/actions/finance";
import { useStore } from "@/store/core";
import type { Cost, CostService, CostState, FxRate, PricePlan } from "@/store/types";
import { Button, Checkbox, DateInput, IconButton, Input, Segmented, Select, Sheet, Textarea, toast } from "@/ui";
import { formatMicro, formatQuantity, formatRate, lastBillRate, parseQuantity } from "../rules/planner";
import { useCategoryName, useCostLabel, useFinanceAccess } from "../shared";
import { meterPriceText } from "./PlanRow";

const SERVICES: { value: CostService; label: string | null }[] = [
  { value: "supabase", label: "Supabase" }, { value: "vercel", label: "Vercel" }, { value: "r2", label: "Cloudflare R2" }, { value: "resend", label: "Resend" }, { value: "cloudflare", label: "Cloudflare" },
  { value: "github", label: "GitHub" }, { value: "domain", label: "Domain" }, { value: "claude", label: "Claude" }, { value: "mailbox", label: null }, { value: "other", label: null },
];

const moneyText = (minor: number) => (minor / 100).toFixed(2);

function CostForm({ cost, preset, onDone, onCancel }: { cost: Cost | null; preset: CostState; onDone: (saved: Cost) => void; onCancel: () => void }) {
  const dict = useT(finance);
  const t = dict.costs;
  const lang = useLang();
  const categories = useStore((s) => s.categories);
  const accounts = seedRows(useStore((s) => s.accounts), lang, "name");
  const categoryName = useCategoryName();
  const [label, setLabel] = useState(cost?.label ?? "");
  const [vendor, setVendor] = useState(cost?.vendor ?? "");
  const [service, setService] = useState<CostService>(cost?.service ?? "other");
  const [billing, setBilling] = useState<Cost["billing"]>(cost?.billing ?? "monthly");
  const [amount, setAmount] = useState(cost ? moneyText(cost.expectedMinor) : "0.00");
  const [currency, setCurrency] = useState(cost?.currency ?? "CHF");
  const [startsOn, setStartsOn] = useState(cost?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(cost?.endsOn ?? "");
  const [categoryId, setCategoryId] = useState<string>(cost?.categoryId ?? "cat_software-hosting");
  const [accountId, setAccountId] = useState<string>(cost?.accountId ?? "");
  const [note, setNote] = useState(cost?.note ?? "");
  const [state, setState] = useState<CostState>(cost?.state ?? preset);
  const [isEstimate, setIsEstimate] = useState(cost?.isEstimate ?? true);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; ends?: string; start?: string }>({});
  const onPlan = cost?.planId != null;
  const serviceChanged = onPlan && cost?.service !== service;
  const locked = onPlan && !serviceChanged;

  const submit = () => {
    const expectedMinor = parseChf(amount);
    const next: typeof errors = {};
    if (expectedMinor === null || expectedMinor < 0) next.amount = t.errExpected;
    const input: CostInput = { label, vendor, service, billing, expectedMinor: expectedMinor ?? 0, currency, startsOn: startsOn || null, endsOn: endsOn || null, categoryId: categoryId || null, accountId: accountId || null, note, state, isEstimate };
    const problem = costProblem(input);
    if (problem === "name") next.name = t.errName;
    if (problem === "ends_before") next.ends = t.errEnds;
    if (problem === "yearly_start") next.start = t.errYearlyStart;
    if (problem === "amount") next.amount = t.errExpected;
    setErrors(next);
    if (Object.keys(next).length) return;
    const result = saveCost(cost?.id ?? null, input);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    toast(cost ? t.costSaved : t.costAdded);
    onDone(result.data);
  };

  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input label={t.name} value={label} maxLength={60} required error={errors.name} onChange={(e) => setLabel(e.target.value)} />
      <Input label={t.vendor} value={vendor} maxLength={80} onChange={(e) => setVendor(e.target.value)} />
      <div className="fin-form-2">
        <Select label={t.serviceField} value={service} hint={serviceChanged ? t.planDrops : undefined} onChange={(e) => setService(e.target.value as CostService)}>
          {SERVICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label ?? (s.value === "mailbox" ? t.serviceMailbox : t.serviceOther)}
            </option>
          ))}
        </Select>
        <Select label={t.billing} value={billing} disabled={locked} hint={locked ? t.lockedByPlan : undefined} onChange={(e) => setBilling(e.target.value as Cost["billing"])}>
          <option value="monthly">{t.monthly}</option>
          <option value="yearly">{t.yearly}</option>
        </Select>
      </div>
      <div className="fin-form-2">
        <Input label={t.expectedAmount} inputMode="decimal" value={amount} disabled={locked} error={errors.amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label={t.currency} value={currency} disabled={locked} onChange={(e) => setCurrency(e.target.value)}>
          <option value="CHF">CHF</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </Select>
      </div>
      <div className="fin-form-2">
        <DateInput label={t.from} hint={t.fromHint} value={startsOn} error={errors.start} onChange={(e) => setStartsOn(e.target.value)} />
        <DateInput label={t.until} value={endsOn} error={errors.ends} onChange={(e) => setEndsOn(e.target.value)} />
      </div>
      <div className="fin-form-2">
        <Select label={t.category} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.filter((c) => c.kind === "expense" && (c.isActive || c.id === cost?.categoryId)).map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c)}
            </option>
          ))}
        </Select>
        <Select label={t.account} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{dict.ledger.noAccount}</option>
          {accounts.filter((a) => a.isActive || a.id === cost?.accountId).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="fin-seg-field">
        <span className="ui-field-label">{t.stateLabel}</span>
        <Segmented<CostState>
          aria-label={t.stateLabel}
          value={state}
          onChange={setState}
          options={[
            { value: "active", label: t.stateActive },
            { value: "planned", label: t.statePlanned },
            { value: "off", label: t.stateOff },
          ]}
        />
      </div>
      <Checkbox label={t.isEstimate} checked={isEstimate} onChange={(e) => setIsEstimate(e.target.checked)} />
      <Textarea label={t.note} value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />
      <div className="fin-row">
        <Button type="submit">{dict.shared.save}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {dict.shared.cancel}
        </Button>
      </div>
    </form>
  );
}

/** `open` is `costs` for the list, `new` for a planned subscription, `new-cost` for a running one, or a cost's id. */
export function CostsSheet({ open, onOpen, onClose, onCreated }: { open: string | null; onOpen: (value: string) => void; onClose: () => void; onCreated: (cost: Cost) => void }) {
  const costLabel = useCostLabel();
  const { costs: t } = useT(finance);
  const costs = useStore((s) => s.costs);
  const editing = costs.find((c) => c.id === open) ?? null;
  const isNew = open === "new" || open === "new-cost";
  const shown = open === "costs" || isNew || !!editing;
  const title = isNew ? t.newCost : editing ? t.editCost : t.sheetTitle;
  return (
    <Sheet open={shown} onClose={onClose} title={title}>
      {isNew || editing ? (
        <CostForm
          key={open}
          cost={editing}
          preset={open === "new" ? "planned" : "active"}
          onCancel={() => (open === "new" ? onClose() : onOpen("costs"))}
          onDone={(saved) => {
            if (open === "new") {
              onCreated(saved);
              onClose();
            } else onOpen("costs");
          }}
        />
      ) : (
        <div className="fin-stack">
          <p className="fin-note">{t.sheetIntro}</p>
          <ul className="fin-list">
            {costs.map((cost) => (
              <li key={cost.id}>
                <div className="fin-list-t">
                  <b>
                    {costLabel(cost.label)}
                    {cost.vendor ? <span className="fin-faint" style={{ display: "inline", fontWeight: 400 }}>{` · ${cost.vendor}`}</span> : null}
                  </b>
                  <span>{[cost.expectedMinor === 0 ? t.free : formatMinor(cost.expectedMinor, cost.currency), cost.billing === "yearly" ? t.yearly : t.monthly, cost.isEstimate && cost.expectedMinor > 0 ? t.estimate : ""].filter(Boolean).join(" · ")}</span>
                </div>
                <span className="fin-row" style={{ flexWrap: "nowrap" }}>
                  {cost.state !== "active" ? <span className="fin-chip">{cost.state === "planned" ? t.statePlanned : t.stateOff}</span> : null}
                  <IconButton aria-label={`${t.editCost}: ${cost.label}`} onClick={() => onOpen(cost.id)}>
                    <Pencil size={15} aria-hidden="true" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="outline" onClick={() => onOpen("new-cost")}>
              <Plus size={15} aria-hidden="true" />
              {t.addCost}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* Prices and planning rates */

const microText = (micro: number | null) => (micro === null ? "" : formatMicro(micro));
/** Up to six decimals, in millionths. Null for anything else. */
function parseMicro(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,6})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 1_000_000);
}

function PlanEditor({ plan, onDone }: { plan: PricePlan; onDone: () => void }) {
  const dict = useT(finance);
  const t = dict.costs;
  const lang = useLang();
  const [base, setBase] = useState(moneyText(plan.baseMinor));
  const [seat, setSeat] = useState(plan.seatMinor === null ? "" : moneyText(plan.seatMinor));
  const [credit, setCredit] = useState(moneyText(plan.creditMinor));
  const [asOf, setAsOf] = useState(plan.asOf);
  const [source, setSource] = useState(plan.source);
  const [note, setNote] = useState(plan.note);
  const [isActive, setIsActive] = useState(plan.isActive);
  const [meters, setMeters] = useState(plan.meters.map((m) => ({ key: m.key, included: formatQuantity(m.included), price: microText(m.priceMicro), hardLimit: m.hardLimit })));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const baseMinor = parseChf(base);
    const seatMinor = seat.trim() === "" ? null : parseChf(seat);
    const creditMinor = parseChf(credit);
    if (baseMinor === null || creditMinor === null || (seat.trim() !== "" && seatMinor === null) || baseMinor < 0 || creditMinor < 0) return setError(t.errPriceMoney);
    if (!asOf) return setError(t.errPriceDate);
    const parsed: PlanEdit["meters"] = [];
    for (const m of meters) {
      const included = parseQuantity(m.included);
      if (included === null) return setError(t.errPriceIncluded);
      const priceMicro = m.price.trim() === "" ? null : parseMicro(m.price);
      if (m.price.trim() !== "" && priceMicro === null) return setError(t.errPriceMicro);
      parsed.push({ key: m.key, included, priceMicro, hardLimit: m.hardLimit });
    }
    setError(null);
    const result = savePrices(plan.id, { baseMinor, seatMinor, creditMinor, asOf, source, note, isActive, meters: parsed });
    if (!result.ok) return setError(result.message);
    toast(fmt(t.rowSaved, { label: plan.label }));
    onDone();
  };

  return (
    <form
      className="fin-form mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="fin-form-2">
        <Input label={t.feeField} inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} />
        <Input label={t.seatField} inputMode="decimal" hint={t.seatHint} value={seat} onChange={(e) => setSeat(e.target.value)} />
        <Input label={t.creditField} inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} />
      </div>
      {plan.meters.map((meter, i) => {
        const row = meters[i];
        const patch = (next: Partial<typeof row>) => setMeters((all) => all.map((m, j) => (j === i ? { ...m, ...next } : m)));
        return (
          <fieldset key={meter.key} className="fin-form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="type-label">{lang === "de" ? meter.labelDe : meter.labelEn}</legend>
            <div className="fin-form-2">
              <Input label={fmt(t.includedField, { unit: meter.unit })} inputMode="decimal" value={row.included} onChange={(e) => patch({ included: e.target.value })} />
              <Input label={fmt(t.priceField, { block: `${t.perWord} ${formatQuantity(meter.per)}`, currency: plan.currency })} inputMode="decimal" hint={row.hardLimit ? t.priceHardHint : t.priceHint} value={row.price} onChange={(e) => patch({ price: e.target.value })} />
            </div>
            <Checkbox label={t.hardField} checked={row.hardLimit} onChange={(e) => patch({ hardLimit: e.target.checked })} />
          </fieldset>
        );
      })}
      <div className="fin-form-2">
        <DateInput label={t.pricesAsOf} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <Input label={t.source} value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <Textarea label={t.note} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <Checkbox label={t.offered} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
      <div className="fin-row">
        <Button type="submit">{t.savePrices}</Button>
        <Button variant="ghost" onClick={onDone}>
          {dict.shared.cancel}
        </Button>
      </div>
    </form>
  );
}

function RateForm({ rate }: { rate: FxRate }) {
  const { costs: t } = useT(finance);
  const ledger = useStore((s) => s.ledger);
  const [text, setText] = useState(formatRate(rate.chfPpm));
  const [asOf, setAsOf] = useState(rate.asOf ?? "");
  const [source, setSource] = useState(rate.source);
  const [note, setNote] = useState(rate.note);
  const [error, setError] = useState<string | null>(null);
  const bills = lastBillRate(ledger, rate.currency);
  const billText = bills ? bills.bills.map((b) => `${b.title} ${formatDate(b.occurredOn)}`).join(", ") : "";

  return (
    <form
      className="fin-form mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        const micro = parseMicro(text);
        const result = micro === null ? null : saveRate(rate.currency, { chfPpm: micro, asOf: asOf || null, source, note });
        if (!result || !result.ok) {
          setError(fmt(t.errRate, { currency: rate.currency }));
          return;
        }
        setError(null);
        toast(fmt(t.rateSaved, { currency: rate.currency }));
      }}
    >
      <Input label={fmt(t.chfPer, { currency: rate.currency })} inputMode="decimal" value={text} error={error} onChange={(e) => setText(e.target.value)} />
      {bills ? (
        <Button
          variant="outline"
          className="fin-wrap"
          style={{ height: "auto", padding: "8px 12px", textAlign: "left" }}
          onClick={() => {
            setText(formatRate(bills.ppm));
            setAsOf(DEMO_TODAY);
            setNote(fmt(t.billsNote, { currency: rate.currency, bills: billText }));
          }}
        >
          {fmt(t.useBills, { currency: rate.currency, rate: formatRate(bills.ppm), bills: billText })}
        </Button>
      ) : null}
      <div className="fin-form-2">
        <DateInput label={t.checkedOn} hint={t.checkedHint} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <Input label={t.source} value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <Input label={t.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <div>
        <Button type="submit" variant="outline">
          {t.saveRate}
        </Button>
      </div>
    </form>
  );
}

export function PricesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dict = useT(finance);
  const t = dict.costs;
  const plans = useStore((s) => s.pricePlans);
  const rates = useStore((s) => s.fxRates);
  const { full } = useFinanceAccess();
  const lang = useLang();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title={t.pricesTitle} wide>
      <div className="fin-stack">
        <p className="fin-note">{t.pricesIntro}</p>
        <h3 className="fin-h">{t.pricePlans}</h3>
        <div>
          {plans.slice().sort((a, b) => a.sort - b.sort).map((plan) => (
            <div key={plan.id} className="fin-plan-doc">
              <div className="fin-between">
                <b className="type-label">
                  {plan.label} {!plan.isActive ? <span className="fin-chip ml-1">{t.notOffered}</span> : null}
                </b>
                {full ? (
                  <Button variant="ghost" aria-label={fmt(t.editPrices, { label: plan.label })} onClick={() => setEditing(editing === plan.id ? null : plan.id)}>
                    {dict.shared.edit}
                  </Button>
                ) : null}
              </div>
              <p className="fin-note">
                {[
                  plan.baseMinor > 0 ? fmt(t.feeLine, { amount: formatMinor(plan.baseMinor, plan.currency) }) : "",
                  plan.seatMinor !== null ? fmt(t.seatLine, { amount: formatMinor(plan.seatMinor, plan.currency) }) : "",
                  plan.creditMinor > 0 ? fmt(t.creditLine, { amount: formatMinor(plan.creditMinor, plan.currency) }) : "",
                ].filter(Boolean).join(" · ")}
              </p>
              {plan.meters.length ? (
                <ul>
                  {plan.meters.map((m) => {
                    const included = `${formatQuantity(m.included)}${m.unit === "gb" ? " GB" : ""}`;
                    const label = lang === "de" ? m.labelDe : m.labelEn;
                    return (
                      <li key={m.key}>
                        {m.hardLimit ? fmt(t.meterHard, { label, included }) : m.priceMicro === null ? fmt(t.meterNone, { label, included }) : fmt(t.meterThen, { label, included, price: meterPriceText(plan, m, t) })}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="fin-note fin-faint mt-1">{`${fmt(t.asOf, { date: formatDate(plan.asOf) })} · ${t.source}: ${plan.source}`}</p>
              <p className="fin-note">{dict.planNotes[plan.key as keyof typeof dict.planNotes] ?? plan.note}</p>
              {editing === plan.id ? <PlanEditor key={plan.id} plan={plan} onDone={() => setEditing(null)} /> : null}
            </div>
          ))}
        </div>
        <h3 className="fin-h mt-2">{t.planningRates}</h3>
        {rates.map((rate) => (
          <div key={rate.currency} className="fin-plan-doc">
            <p className="type-label">
              {`1 ${rate.currency} = CHF ${formatRate(rate.chfPpm)}`} <span className="fin-faint" style={{ fontWeight: 400 }}>{`· ${rate.asOf ? fmt(t.rateCheckedOn, { date: formatDate(rate.asOf) }) : t.rateNotChecked}`}</span>
            </p>
            {rate.note ? <p className="fin-note">{rate.note}</p> : null}
            {full ? <RateForm key={`${rate.currency}-${rate.chfPpm}-${rate.asOf}`} rate={rate} /> : null}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

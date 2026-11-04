"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronRight, Database, GitBranch, Globe, HardDrive, Link2, Mail, Receipt, Send, Server, TriangleAlert, type LucideIcon } from "lucide-react";
import { DEMO_MONTH } from "@/store/clock";
import { fmt, useLang, useT, type Lang } from "@/i18n";
import { useCostLabel } from "../shared";
import { finance } from "@/i18n/dict/finance";
import { formatDate, formatDateTime, formatMinor, formatMonth, parseChf } from "@/lib/format";
import { savePlanDraft } from "@/store/actions/finance";
import type { Cost, CostService, CostState, FxRate, PlanMeter, PricePlan } from "@/store/types";
import { Button, Segmented, Select, toast } from "@/ui";
import {
  APP_HOST_BILLED_READING, clampSlider, draftPlanId, findPlan, formatMicro, formatQuantity, formatRate, includedStopIndex, isStoragePlan, parseQuantity, planSliders, rowCost, sliderValue, storageQuantities, toRappen,
  type PlanDraft, type PlanResult, type PlanSlider, type RowCost, type StorageMeasure,
} from "../rules/planner";
import { FinSlider } from "./FinSlider";

const ICONS: Record<CostService, LucideIcon> = { vercel: Server, supabase: Database, r2: HardDrive, resend: Send, claude: Bot, cloudflare: Globe, github: GitBranch, domain: Link2, mailbox: Mail, other: Receipt };

type T = (typeof finance)["en"]["costs"];

const microMoney = (currency: string, micro: number): string => `${currency} ${formatMicro(micro)}`;

/** `GB`, `operations`, `MAU`: the words after a quantity. */
function unitWord(unit: string, n: number, t: T): string {
  if (unit === "gb") return "GB";
  if (unit === "mau") return "MAU";
  if (unit === "ops") return n === 1 ? t.unitOps1 : t.unitOps;
  if (unit === "emails") return n === 1 ? t.unitEmail1 : t.unitEmail;
  if (unit === "requests") return n === 1 ? t.unitRequest1 : t.unitRequest;
  return "";
}

const quantityText = (unit: string, n: number, t: T): string => `${formatQuantity(n)} ${unitWord(unit, n, t)}`.trim();

/** `USD 0.015 per GB`, `USD 4.50 per million`, `USD 0.90 per 1'000 emails`. */
export function meterPriceText(plan: Pick<PricePlan, "currency">, meter: PlanMeter, t: T): string {
  if (meter.priceMicro === null) return "";
  const money = microMoney(plan.currency, meter.priceMicro);
  if (meter.per === 1_000_000) return `${money} ${t.perWord} ${t.millionWord}`;
  if (meter.per === 1) return `${money} ${t.perWord} ${meter.unit === "gb" ? "GB" : unitWord(meter.unit, 1, t)}`;
  return `${money} ${t.perWord} ${formatQuantity(meter.per)} ${unitWord(meter.unit, meter.per, t)}`;
}

const sliderLabel = (slider: PlanSlider, lang: Lang): string => (lang === "de" ? slider.labelDe : slider.labelEn);
const meterLabel = (meter: PlanMeter, lang: Lang): string => (lang === "de" ? meter.labelDe : meter.labelEn);

function sliderValueText(slider: PlanSlider, value: number, t: T): string {
  if (slider.kind === "seats") return fmt(value === 1 ? t.seatsOne : t.seatsMany, { n: value });
  if (slider.kind === "extra_uploads") return fmt(value === 1 ? t.unitUpload1 : t.unitUpload, { n: formatQuantity(value) });
  if (slider.kind === "views") return fmt(value === 1 ? t.unitView1 : t.unitView, { n: formatQuantity(value) });
  if (slider.kind === "extra_gb") return `${formatQuantity(value)} GB`;
  return quantityText(slider.unit, value, t);
}

function sliderUnit(slider: PlanSlider, value: number, t: T): string | undefined {
  if (slider.kind === "seats") return fmt(value === 1 ? t.seatsOne : t.seatsMany, { n: "" }).trim();
  if (slider.kind === "extra_uploads" || slider.kind === "views") return undefined;
  if (slider.kind === "extra_gb") return "GB";
  return unitWord(slider.unit, value, t) || undefined;
}

/** Each line of "How this is calculated", in the order the bill builds up. */
function calcLines(row: RowCost, t: T, lang: Lang): { text: string; total?: boolean }[] {
  const lines: { text: string; total?: boolean }[] = [];
  if (!row.result || !row.plan) {
    lines.push({ text: fmt(t.lineCustom, { amount: formatMinor(row.minor, row.currency) }), total: true });
    return lines;
  }
  const r: PlanResult = row.result;
  const plan = row.plan;
  if (r.baseMinor > 0) lines.push({ text: fmt(t.lineBase, { amount: formatMinor(r.baseMinor, r.currency) }) });
  if (r.seatMinor !== null) lines.push({ text: fmt(t.lineSeats, { n: r.seats, price: formatMinor(r.seatMinor, r.currency), amount: formatMinor(r.seatsMinor, r.currency) }) });
  for (const m of r.meters) {
    const label = meterLabel(m.meter, lang);
    const quantity = quantityText(m.meter.unit, m.quantity, t);
    const included = quantityText(m.meter.unit, m.meter.included, t);
    if (m.blocks === 0) lines.push({ text: fmt(t.lineInside, { label, quantity, included }) });
    else if (m.overLimit) lines.push({ text: fmt(t.lineStops, { label, quantity, included }) });
    else if (m.unpriced) lines.push({ text: fmt(t.lineNoPrice, { label, quantity, included }) });
    else lines.push({ text: fmt(t.lineCharge, { label, quantity, included, blocks: formatQuantity(m.blocks), price: meterPriceText(plan, m.meter, t), charge: microMoney(r.currency, Number(m.chargeMicro)) }) });
  }
  if (r.creditUsedMinor > 0) lines.push({ text: fmt(t.lineCredit, { amount: formatMinor(r.creditUsedMinor, r.currency), credit: formatMinor(r.creditMinor, r.currency) }) });
  lines.push({ text: fmt(t.lineTotal, { amount: formatMinor(r.totalMinor, r.currency) }), total: true });
  lines.push({ text: fmt(t.linePrices, { date: formatDate(plan.asOf), source: plan.source }) });
  return lines;
}

export type PlanRowProps = {
  cost: Cost;
  plans: PricePlan[];
  costs: Cost[];
  fx: FxRate[];
  measure: StorageMeasure;
  draft?: PlanDraft;
  expanded: boolean;
  focusPlan: boolean;
  onToggle: () => void;
  onDraft: (patch: PlanDraft) => void;
  onReset: () => void;
  onSaved: () => void;
  onFocused: () => void;
};

export function PlanRow({ cost, plans, costs, fx, measure, draft, expanded, focusPlan, onToggle, onDraft, onReset, onSaved, onFocused }: PlanRowProps) {
  const dict = useT(finance);
  const t = dict.costs;
  const shared = dict.shared;
  const lang = useLang();
  const costLabel = useCostLabel();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [invalid, setInvalid] = useState(false);
  const row = rowCost(cost, plans, measure, draft);
  const saved = rowCost(cost, plans, measure);
  const Icon = ICONS[cost.service] ?? Receipt;
  const nextState = draft?.state ?? cost.state;
  const planId = draftPlanId(cost, draft);
  const plan = findPlan(plans, planId);
  const dirty = !!draft;
  const rappen = toRappen(row.minor, row.currency, fx);
  const money = rappen === null ? formatMinor(row.minor, row.currency) : formatMinor(rappen, "CHF");
  const headline = fmt(row.yearly ? t.perYear : t.perMonth, { amount: money });
  const savedRappen = toRappen(saved.minor, saved.currency, fx);
  const stateWord = { active: t.stateActive, planned: t.statePlanned, off: t.stateOff }[nextState];
  const drift = cost.planId !== null && saved.minor !== cost.expectedMinor;

  useEffect(() => {
    if (!focusPlan || !expanded) return;
    /* The closing sheet hands focus back to its opener first, so this waits for its slide to end. */
    const timer = window.setTimeout(() => {
      const select = pickerRef.current?.querySelector("select");
      select?.focus({ preventScroll: true });
      select?.scrollIntoView({ block: "center" });
      onFocused();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [focusPlan, expanded, onFocused]);

  const planOptions = plans.filter((p) => p.service === cost.service && (p.isActive || p.id === cost.planId)).sort((a, b) => a.sort - b.sort);
  const carrierOf = (candidate: PricePlan): Cost | undefined => (isStoragePlan(candidate) ? costs.find((c) => c.id !== cost.id && c.state !== "off" && isStoragePlan(findPlan(plans, c.planId))) : undefined);

  const save = () => {
    const result = savePlanDraft(cost.id, draft ?? {});
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_offered: fmt(t.errNotOffered, { plan: plan?.label ?? cost.label }),
        yearly_plan: t.errYearly,
        storage_taken: fmt(t.errStorage, { label: costs.find((c) => c.id !== cost.id && isStoragePlan(findPlan(plans, c.planId)))?.label ?? cost.label }),
        too_large: t.errTooLarge,
        ended: fmt(t.errEnded, { endsOn: cost.endsOn ? formatDate(cost.endsOn) : "" }),
      };
      toast(messages[result.code] ?? result.message);
      return;
    }
    onSaved();
    toast(fmt(t.rowSaved, { label: cost.label }));
  };

  const sliders = plan ? planSliders(plan) : [];
  const main = sliders.filter((s) => s.main);
  const more = sliders.filter((s) => !s.main);

  const sliderFor = (slider: PlanSlider) => {
    const usage = row.usage;
    const value = sliderValue(slider, usage);
    const meter = row.result?.meters.find((m) => m.meter.key === slider.key);
    const included = slider.included;
    let charge = null;
    let bubbleNote: string | undefined;
    if (slider.kind === "seats" && row.result && row.result.seatMinor !== null) {
      bubbleNote = `${value} × ${formatMinor(row.result.seatMinor, row.result.currency)}`;
      charge = <span className="fin-sl-charge">{bubbleNote}</span>;
    } else if (meter && meter.blocks > 0) {
      if (meter.overLimit || meter.unpriced) {
        bubbleNote = meter.overLimit ? t.overLimitShort : t.noPriceShort;
        charge = (
          <span className="fin-sl-charge" data-tone="warn">
            <TriangleAlert size={13} aria-hidden="true" />
            {meter.overLimit ? t.overLimitShort : t.noPriceShort}
          </span>
        );
      } else {
        bubbleNote = `+${microMoney(row.currency, Number(meter.chargeMicro))}`;
        charge = (
          <span key={bubbleNote} className="fin-sl-charge fin-tick" data-tone="up">
            {bubbleNote}
          </span>
        );
      }
    } else if (meter) {
      bubbleNote = t.insideIncluded;
      charge = <span className="fin-sl-charge">{t.insideIncluded}</span>;
    }
    const note = slider.kind === "seats" ? t.seatNote : included !== null ? fmt(t.included, { amount: quantityText(slider.unit, included, t) }) : undefined;
    return (
      <FinSlider
        key={slider.key}
        label={sliderLabel(slider, lang)}
        stops={slider.stops}
        value={value}
        valueText={sliderValueText(slider, value, t)}
        bubbleNote={bubbleNote}
        unit={sliderUnit(slider, value, t)}
        includedIndex={included === null ? null : includedStopIndex(slider.stops, included)}
        exactText={formatQuantity}
        parseExact={(text) => {
          const parsed = parseQuantity(text);
          return parsed === null ? null : clampSlider(slider, parsed);
        }}
        exactAria={fmt(t.exactValue, { label: sliderLabel(slider, lang) })}
        note={note}
        charge={charge}
        onChange={(next) => onDraft({ usage: { ...(draft?.usage ?? {}), [slider.key]: next } })}
      />
    );
  };

  const customMinor = draft && "customMinor" in draft ? draft.customMinor ?? 0 : cost.expectedMinor;
  const customMax = Math.max(100, Math.ceil((2 * cost.expectedMinor) / 100));
  const customStops = Array.from({ length: customMax + 1 }, (_, i) => i);
  const ratePpm = fx.find((r) => r.currency === row.currency);

  return (
    <article className="fin-plan" data-open={expanded || undefined}>
      <button type="button" className="fin-plan-h" aria-expanded={expanded} aria-label={fmt(t.rowToggle, { label: cost.label })} onClick={onToggle}>
        <span className="fin-plan-ti">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="fin-plan-name">{costLabel(cost.label)}</span>
          <span className="fin-plan-sub">
            {[plan ? plan.label : cost.vendor, stateWord].filter(Boolean).join(" · ")}
            {dirty ? (
              <span className="fin-chip ml-2" data-tone="warn">
                {t.notSaved}
              </span>
            ) : null}
          </span>
        </span>
        <span className="fin-plan-price" data-dirty={dirty || undefined}>
          <b key={headline} className="fin-tick">
            {row.minor === 0 ? t.free : headline}
          </b>
          {dirty && savedRappen !== null && savedRappen !== rappen ? <small>{fmt(t.wasSaved, { amount: formatMinor(savedRappen, "CHF") })}</small> : null}
        </span>
        <ChevronDown className="fin-plan-chev" size={16} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="fin-plan-body">
          <div className="fin-plan-ctl">
            <div className="fin-seg-field">
              <span className="ui-field-label">{t.stateLabel}</span>
              <Segmented<CostState>
                aria-label={t.stateLabel}
                value={nextState}
                onChange={(state) => onDraft({ state })}
                options={[
                  { value: "active", label: t.stateActive },
                  { value: "planned", label: t.statePlanned },
                  { value: "off", label: t.stateOff },
                ]}
              />
            </div>
            <div ref={pickerRef} className="min-w-0">
              <Select
                label={t.planLabel}
                value={planId ?? "custom"}
                onChange={(e) => {
                  const value = e.target.value;
                  onDraft(value === "custom" ? { planId: null } : { planId: value });
                }}
              >
                {cost.billing === "yearly"
                  ? null
                  : planOptions.map((candidate) => {
                      const carrier = carrierOf(candidate);
                      const label = carrier ? fmt(t.alreadyOn, { label: candidate.label, other: carrier.label }) : !candidate.isActive ? fmt(t.noLongerOffered, { label: candidate.label }) : candidate.label;
                      return (
                        <option key={candidate.id} value={candidate.id} disabled={!!carrier}>
                          {label}
                        </option>
                      );
                    })}
                <option value="custom">{cost.billing === "yearly" ? t.customYear : t.customAmount}</option>
              </Select>
            </div>
          </div>
          {plan ? <p className="fin-note">{dict.planNotes[plan.key as keyof typeof dict.planNotes] ?? plan.note}</p> : null}

          {plan ? (
            sliders.length ? (
              <>
                {main.length ? <div className="fin-sl-grid">{main.map(sliderFor)}</div> : null}
                {more.length ? (
                  <details className="fin-more" open={main.length <= 1 && cost.service === "vercel" ? true : undefined}>
                    <summary>
                      <ChevronRight size={14} aria-hidden="true" />
                      {t.moreUsage}
                    </summary>
                    <div className="fin-sl-grid">{more.map(sliderFor)}</div>
                  </details>
                ) : null}
              </>
            ) : null
          ) : (
            <FinSlider
              label={fmt(cost.billing === "yearly" ? t.amountYear : t.amountMonth, { currency: cost.currency })}
              stops={customStops}
              value={customMinor / 100}
              valueText={formatMinor(customMinor, cost.currency)}
              unit={cost.currency}
              exactText={(value) => value.toFixed(2)}
              parseExact={(text) => {
                const parsed = parseChf(text);
                return parsed === null || parsed < 0 ? null : parsed / 100;
              }}
              exactAria={fmt(t.amountExact, { currency: cost.currency })}
              error={t.errAmount}
              onInvalid={setInvalid}
              onChange={(next) => onDraft({ customMinor: Math.round(next * 100) })}
            />
          )}

          {plan && isStoragePlan(plan) ? <StorageMeasured measure={measure} usage={row.usage} t={t} /> : null}

          <div className="fin-priceline">
            <b key={formatMinor(row.minor, row.currency)} className="fin-tick">
              {fmt(row.yearly ? t.perYear : t.perMonth, { amount: formatMinor(row.minor, row.currency) })}
            </b>
            {row.currency !== "CHF" ? <span>{rappen === null ? `· ${t.noRateShort}` : `· ${fmt(row.yearly ? t.perYear : t.perMonth, { amount: formatMinor(rappen, "CHF") })}`}</span> : null}
            {row.result?.overLimit ? (
              <span className="fin-chip fin-wrap" data-tone="warn">
                <TriangleAlert size={13} aria-hidden="true" />
                {t.overPlan}
              </span>
            ) : null}
            {row.result?.unpriced ? (
              <span className="fin-chip fin-wrap" data-tone="warn">
                <TriangleAlert size={13} aria-hidden="true" />
                {t.noPricePlan}
              </span>
            ) : null}
          </div>

          {plan?.key === "vercel-pro" ? <BilledLine fx={fx} expected={formatMinor(row.minor, row.currency)} t={t} /> : null}

          {drift ? <p className="fin-note fin-amber">{fmt(t.driftNote, { saved: formatMinor(cost.expectedMinor, cost.currency), now: formatMinor(saved.minor, saved.currency) })}</p> : null}

          <details className="fin-more">
            <summary>
              <ChevronRight size={14} aria-hidden="true" />
              {t.howCalculated}
            </summary>
            <div>
              <ul className="fin-calc">
                {calcLines(row, t, lang).map((line) => (
                  <li key={line.text} data-total={line.total || undefined}>
                    {line.text}
                  </li>
                ))}
                {row.currency !== "CHF" ? (
                  <li>
                    {ratePpm
                      ? ratePpm.asOf
                        ? fmt(t.rateChecked, { currency: row.currency, rate: formatRate(ratePpm.chfPpm), date: formatDate(ratePpm.asOf) })
                        : fmt(t.rateUnchecked, { currency: row.currency, rate: formatRate(ratePpm.chfPpm) })
                      : fmt(t.rateMissing, { currency: row.currency })}
                  </li>
                ) : null}
              </ul>
            </div>
          </details>

          {draft?.state === "active" && cost.state !== "active" ? (
            <p className="fin-note">{cost.billing === "yearly" && !cost.startsOn ? t.activationYearly : fmt(t.activationMonth, { month: formatMonth(DEMO_MONTH, lang) })}</p>
          ) : null}

          <div className="fin-row">
            <Button variant="ghost" disabled={!dirty} onClick={onReset}>
              {t.reset}
            </Button>
            <Button disabled={invalid || (!dirty && !drift)} onClick={save}>
              {shared.save}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StorageMeasured({ measure, usage, t }: { measure: StorageMeasure; usage: Record<string, number>; t: T }) {
  const q = storageQuantities(measure, usage);
  const extra = usage.extra_uploads ?? 0;
  return (
    <ul className="fin-dl">
      <li>{fmt(t.storageWrites, { n: formatQuantity(q.class_a), uploads: formatQuantity(measure.uploadsPerMonth), extra: formatQuantity(extra) })}</li>
      <li>
        {fmt(t.storageReads, { n: formatQuantity(q.class_b), views: formatQuantity(usage.views_per_object ?? 10), objects: formatQuantity(measure.objects) })}{" "}
        <span className="fin-chip">{t.assumption}</span>
      </li>
    </ul>
  );
}

function BilledLine({ fx, expected, t }: { fx: FxRate[]; expected: string; t: T }) {
  const lang = useLang();
  const reading = APP_HOST_BILLED_READING;
  const chf = toRappen(reading.minor, reading.currency, fx);
  const amount = `${formatMinor(reading.minor, reading.currency)}${chf === null ? "" : ` (${formatMinor(chf, "CHF")})`}`;
  return (
    <div className="fin-note">
      <p>{fmt(t.billedLine, { month: formatMonth(DEMO_MONTH, lang), amount, expected })}</p>
      <details className="fin-more">
        <summary>
          <ChevronRight size={14} aria-hidden="true" />
          {t.byService}
        </summary>
        <div>
          <ul className="fin-calc">
            {reading.services.map((s) => (
              <li key={s.service}>{`${s.service}: ${formatMinor(s.minor, reading.currency)}`}</li>
            ))}
          </ul>
          <p className="mt-2 fin-faint">{fmt(t.billedFoot, { at: formatDateTime(reading.readAt) })}</p>
        </div>
      </details>
    </div>
  );
}


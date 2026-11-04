import { addMonths, monthOf } from "@/lib/dates";
import type { Cost, CostBooking, CostState, FileRecord, FxRate, LedgerEntry, Minor, PlanMeter, PricePlan, Rappen } from "@/store/types";

export const MAX_COST_MINOR = 1_000_000_000;
const MICRO_PER_CENT = BigInt(10_000);
const HALF_CENT = BigInt(5_000);

export type MeterResult = { meter: PlanMeter; quantity: number; over: number; blocks: number; chargeMicro: bigint; overLimit: boolean; unpriced: boolean };
export type PlanResult = {
  currency: string;
  baseMinor: Minor;
  seats: number;
  seatMinor: Minor | null;
  seatsMinor: Minor;
  meters: MeterResult[];
  usageMinor: Minor;
  creditMinor: Minor;
  creditUsedMinor: Minor;
  totalMinor: Minor;
  tooLarge: boolean;
  overLimit: boolean;
  unpriced: boolean;
};

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** The one price formula. Started blocks count whole, usage rounds half up once, and a credit offsets usage only. */
export function evaluatePlan(plan: PricePlan, usage: Record<string, number>, measured: Record<string, number> = {}): PlanResult {
  const seats = plan.seatMinor === null ? 0 : clamp(Math.round(usage.seats ?? 1), 1, 100);
  const seatsMinor = seats * (plan.seatMinor ?? 0);
  const meters = plan.meters.map((meter): MeterResult => {
    const quantity = clamp(measured[meter.key] ?? usage[meter.key] ?? meter.defaultValue, 0, 1e9);
    const rawOver = quantity - meter.included;
    const over = rawOver < 1e-9 ? 0 : rawOver;
    const blocks = over === 0 ? 0 : Math.ceil(over / meter.per);
    const chargeMicro = meter.priceMicro === null || meter.hardLimit ? BigInt(0) : BigInt(blocks) * BigInt(meter.priceMicro);
    return { meter, quantity, over, blocks, chargeMicro, overLimit: blocks > 0 && meter.hardLimit, unpriced: blocks > 0 && meter.priceMicro === null && !meter.hardLimit };
  });
  const totalMicro = meters.reduce((sum, m) => sum + m.chargeMicro, BigInt(0));
  const usageMinor = Number((totalMicro + HALF_CENT) / MICRO_PER_CENT);
  const creditUsedMinor = Math.min(plan.creditMinor, usageMinor);
  const totalMinor = plan.baseMinor + seatsMinor + usageMinor - creditUsedMinor;
  return {
    currency: plan.currency, baseMinor: plan.baseMinor, seats, seatMinor: plan.seatMinor, seatsMinor, meters, usageMinor, creditMinor: plan.creditMinor, creditUsedMinor, totalMinor,
    tooLarge: totalMinor > MAX_COST_MINOR, overLimit: meters.some((m) => m.overLimit), unpriced: meters.some((m) => m.unpriced),
  };
}

/** Minor units at the planning rate, half up. Null when no rate exists. */
export function toRappen(minor: Minor, currency: string, fx: FxRate[]): Rappen | null {
  if (currency === "CHF") return minor;
  const rate = fx.find((r) => r.currency === currency);
  if (!rate) return null;
  return Math.floor((minor * rate.chfPpm + 500_000) / 1_000_000);
}

/** `800000` gives `0.8000`: at least 4 decimals, at most 6. */
export function formatRate(ppm: number): string {
  const [whole, decimals] = (ppm / 1_000_000).toFixed(6).split(".");
  return `${whole}.${decimals.replace(/0{1,2}$/, "").padEnd(4, "0")}`;
}

/** Prices in millionths: `15000` gives `0.015`. Two to six decimals, no trailing zeros past two. */
export function formatMicro(micro: number): string {
  const [whole, decimals] = (micro / 1_000_000).toFixed(6).split(".");
  return `${whole}.${decimals.replace(/0+$/, "").padEnd(2, "0")}`;
}

/** Grouped whole numbers; fractions at 2 decimals, 4 below 1; trailing zeros trimmed. */
export function formatQuantity(n: number): string {
  const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  if (Number.isInteger(n)) return group(String(n));
  const text = n.toFixed(Math.abs(n) < 1 ? 4 : 2).replace(/0+$/, "").replace(/\.$/, "");
  const [whole, decimals] = text.split(".");
  return `${group(whole)}${decimals ? `.${decimals}` : ""}`;
}

/** Parses a typed quantity: `120'000`, `0.5`, `2,5`. Null for anything else. */
export function parseQuantity(text: string): number | null {
  const cleaned = text.replace(/['\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/* Sliders */

export type SliderKind = "seats" | "meter" | "extra_gb" | "extra_uploads" | "views";
export type PlanSlider = { key: string; kind: SliderKind; labelEn: string; labelDe: string; unit: string; stops: number[]; included: number | null; main: boolean; min: number; max: number; integer: boolean; defaultValue: number };

const SEAT_SLIDER: PlanSlider = { key: "seats", kind: "seats", labelEn: "Paid seats (people who deploy)", labelDe: "Bezahlte Plätze (wer deployt)", unit: "seats", stops: [1, 2, 3, 4, 5, 6, 8, 10], included: null, main: true, min: 1, max: 100, integer: true, defaultValue: 1 };

const STORAGE_SLIDERS: PlanSlider[] = [
  { key: "extra_gb", kind: "extra_gb", labelEn: "Backups and other storage the app can't see, GB", labelDe: "Backups und anderer Speicher, den die App nicht sieht, GB", unit: "gb", stops: [0, 1, 2, 5, 10, 20, 50, 100, 200, 500], included: null, main: true, min: 0, max: 1_000_000, integer: false, defaultValue: 0 },
  { key: "extra_uploads", kind: "extra_uploads", labelEn: "Uploads the app can't see, per month", labelDe: "Uploads, die die App nicht sieht, pro Monat", unit: "uploads", stops: [0, 10, 30, 100, 300, 1000, 10_000, 100_000, 1_000_000], included: null, main: false, min: 0, max: 1e9, integer: true, defaultValue: 0 },
  { key: "views_per_object", kind: "views", labelEn: "Views per object per month", labelDe: "Aufrufe pro Objekt und Monat", unit: "views", stops: [0, 1, 2, 5, 10, 20, 50, 100, 1000], included: null, main: false, min: 0, max: 10_000, integer: false, defaultValue: 10 },
];

export const isStoragePlan = (plan: PricePlan | null | undefined): boolean => plan?.service === "r2";

/** A storage plan slides its assumptions, since its meters are measured. Others: seats first if sold, then meters. */
export function planSliders(plan: PricePlan): PlanSlider[] {
  if (isStoragePlan(plan)) return STORAGE_SLIDERS;
  const meters = plan.meters.map((m): PlanSlider => ({ key: m.key, kind: "meter", labelEn: m.labelEn, labelDe: m.labelDe, unit: m.unit, stops: m.stops, included: m.included, main: m.main, min: 0, max: 1e9, integer: m.unit !== "gb", defaultValue: m.defaultValue }));
  return plan.seatMinor === null ? meters : [SEAT_SLIDER, ...meters];
}

/** The range sits on the nearest stop at or below the value. */
export function stopIndexFor(stops: number[], value: number): number {
  let index = 0;
  stops.forEach((stop, i) => {
    if (stop <= value) index = i;
  });
  return index;
}

/** The tick marks the first stop at or above the included amount. */
export function includedStopIndex(stops: number[], included: number): number {
  const index = stops.findIndex((stop) => stop >= included);
  return index < 0 ? stops.length - 1 : index;
}

/** A value inside the slider's bounds, whole where the slider is whole. */
export function clampSlider(slider: Pick<PlanSlider, "min" | "max" | "integer">, value: number): number {
  const bounded = clamp(value, slider.min, slider.max);
  return slider.integer ? Math.round(bounded) : bounded;
}

export function sliderValue(slider: PlanSlider, usage: Record<string, number>): number {
  if (slider.kind === "extra_gb") return usage.extra_gb ?? usage.storage_gb ?? 0;
  return usage[slider.key] ?? slider.defaultValue;
}

/** Three sample months for the planner. Measured storage and seats stay put: only metered usage moves. */
export type UsageScenario = "quiet" | "busy" | "peak";

/** Quiet sits halfway to what the plan includes, busy on the first stop past it, peak three stops past it. */
export function scenarioUsage(plan: PricePlan, scenario: UsageScenario, base: Record<string, number> = {}): Record<string, number> {
  const usage = { ...base };
  for (const slider of planSliders(plan)) {
    if (slider.kind !== "meter" || slider.included === null || slider.stops.length < 2) continue;
    const included = includedStopIndex(slider.stops, slider.included);
    const index = scenario === "quiet" ? Math.floor(included / 2) : Math.min(slider.stops.length - 1, included + (scenario === "busy" ? 1 : 3));
    usage[slider.key] = slider.stops[index];
  }
  return usage;
}

/* Storage measurement: the database estimate behind a storage plan */

export const BYTES_PER_GB = 1e9;
export const CLASS_B_PER_UPLOAD = 2;
const PACE_MONTHS = 3;

export type StorageMeasure = {
  fileObjects: number; fileBytes: number; trashObjects: number; trashBytes: number; receiptObjects: number; receiptBytes: number;
  objects: number; bytes: number; storedGb: number; gbAddedPerMonth: number; uploadsPerMonth: number; paceMonths: string[]; soFar: boolean;
};

export function measureStorage(files: FileRecord[], ledger: LedgerEntry[], currentMonth: string): StorageMeasure {
  const uploads: { month: string; bytes: number }[] = [];
  let fileBytes = 0;
  let fileObjects = 0;
  let trashBytes = 0;
  let trashObjects = 0;
  for (const file of files) {
    for (const version of file.versions) {
      fileBytes += version.bytes;
      fileObjects += 1;
      if (file.trashedAt) {
        trashBytes += version.bytes;
        trashObjects += 1;
      }
      uploads.push({ month: version.at.slice(0, 7), bytes: version.bytes });
    }
  }
  let receiptBytes = 0;
  let receiptObjects = 0;
  for (const entry of ledger) {
    for (const receipt of entry.receipts) {
      receiptBytes += receipt.sizeBytes;
      receiptObjects += 1;
      uploads.push({ month: monthOf(entry.occurredOn), bytes: receipt.sizeBytes });
    }
  }
  const objects = fileObjects + receiptObjects;
  const bytes = fileBytes + receiptBytes;
  const firstMonth = uploads.map((u) => u.month).sort()[0] ?? currentMonth;
  const complete: string[] = [];
  for (let m = addMonths(currentMonth, -1); m >= firstMonth && complete.length < PACE_MONTHS; m = addMonths(m, -1)) complete.push(m);
  const soFar = complete.length === 0;
  const paceMonths = soFar ? [currentMonth] : complete.slice().reverse();
  const inPace = uploads.filter((u) => paceMonths.includes(u.month));
  const uploadsPerMonth = Math.round((inPace.length / paceMonths.length) * 10) / 10;
  const gbAddedPerMonth = inPace.reduce((sum, u) => sum + u.bytes, 0) / paceMonths.length / BYTES_PER_GB;
  return { fileObjects, fileBytes, trashObjects, trashBytes, receiptObjects, receiptBytes, objects, bytes, storedGb: bytes / BYTES_PER_GB, gbAddedPerMonth, uploadsPerMonth, paceMonths, soFar };
}

/** Storage is what is stored plus the assumed extra; reads count two per upload plus the views. */
export function storageQuantities(measure: Pick<StorageMeasure, "storedGb" | "objects" | "uploadsPerMonth">, usage: Record<string, number>): { storage_gb: number; class_a: number; class_b: number } {
  const extraGb = usage.extra_gb ?? usage.storage_gb ?? 0;
  const uploads = measure.uploadsPerMonth + (usage.extra_uploads ?? 0);
  const views = usage.views_per_object ?? 10;
  return { storage_gb: measure.storedGb + extraGb, class_a: Math.round(uploads), class_b: Math.round(CLASS_B_PER_UPLOAD * uploads + views * measure.objects) };
}

export function freeTierLeft(includedGb: number, measure: Pick<StorageMeasure, "storedGb" | "gbAddedPerMonth">, extraGb: number): { gbLeft: number; monthsAtPace: number | null } {
  const gbLeft = Math.max(0, includedGb - measure.storedGb - extraGb);
  return { gbLeft, monthsAtPace: measure.gbAddedPerMonth > 0 ? gbLeft / measure.gbAddedPerMonth : null };
}

/* Rows */

export type PlanDraft = { state?: CostState; planId?: string | null; usage?: Record<string, number>; customMinor?: Minor | null };
export type RowCost = { minor: Minor; currency: string; yearly: boolean; result: PlanResult | null; plan: PricePlan | null; usage: Record<string, number> };
type PricedCost = Pick<Cost, "billing" | "expectedMinor" | "currency" | "planId" | "usage">;

export const findPlan = (plans: PricePlan[], id: string | null | undefined): PricePlan | null => (id ? plans.find((p) => p.id === id) ?? null : null);

export const draftPlanId = (cost: Pick<Cost, "planId">, draft?: PlanDraft): string | null => (draft && "planId" in draft ? draft.planId ?? null : cost.planId);

/** A linked plan is evaluated, always monthly in the plan's currency. Otherwise the custom amount. */
export function rowCost(cost: PricedCost, plans: PricePlan[], measure: Pick<StorageMeasure, "storedGb" | "objects" | "uploadsPerMonth">, draft?: PlanDraft): RowCost {
  const plan = findPlan(plans, draftPlanId(cost, draft));
  const usage = { ...cost.usage, ...(draft?.usage ?? {}) };
  if (plan) {
    const result = evaluatePlan(plan, usage, isStoragePlan(plan) ? storageQuantities(measure, usage) : {});
    return { minor: result.totalMinor, currency: plan.currency, yearly: false, result, plan, usage };
  }
  const custom = draft && "customMinor" in draft ? draft.customMinor ?? 0 : cost.expectedMinor;
  return { minor: custom, currency: cost.currency, yearly: cost.billing === "yearly", result: null, plan: null, usage };
}

export type PlannerTotals = { nowMonth: Rappen; nowYear: Rappen; plansMonth: Rappen; plansYear: Rappen; missingCurrencies: string[]; freeLabels: string[] };

/** Live figures: never booked, and never part of the running cost or the runway. */
export function plannerTotals(costs: Cost[], plans: PricePlan[], fx: FxRate[], drafts: Record<string, PlanDraft>, measure: Pick<StorageMeasure, "storedGb" | "objects" | "uploadsPerMonth">, currentMonth: string): PlannerTotals {
  let nowYear = 0;
  let plansYear = 0;
  const missing = new Set<string>();
  const freeLabels: string[] = [];
  const add = (row: RowCost): number => {
    const rappen = toRappen(row.minor, row.currency, fx);
    if (rappen === null) {
      missing.add(row.currency);
      return 0;
    }
    return row.yearly ? rappen : rappen * 12;
  };
  for (const cost of costs) {
    if (cost.endsOn && monthOf(cost.endsOn) < currentMonth) continue;
    if (cost.state === "active" && (!cost.startsOn || monthOf(cost.startsOn) <= currentMonth)) {
      nowYear += add(rowCost(cost, plans, measure));
      if (cost.planId === null && cost.expectedMinor === 0) freeLabels.push(cost.label);
    }
    const draft = drafts[cost.id];
    if ((draft?.state ?? cost.state) === "off") continue;
    plansYear += add(rowCost(cost, plans, measure, draft));
  }
  return { nowMonth: Math.round(nowYear / 12), nowYear, plansMonth: Math.round(plansYear / 12), plansYear, missingCurrencies: [...missing], freeLabels };
}

/** The saved row's usage with slider defaults filled in, so an untouched row compares equal to its draft. */
export function savedUsage(plan: PricePlan | null, cost: Pick<Cost, "usage">): Record<string, number> {
  if (!plan) return {};
  const out: Record<string, number> = {};
  for (const slider of planSliders(plan)) out[slider.key] = sliderValue(slider, cost.usage);
  return out;
}

/** A draft equal to the saved row is no draft: this gives null then, so `Not saved` never lies. */
export function normaliseDraft(cost: Cost, plans: PricePlan[], draft: PlanDraft): PlanDraft | null {
  const next: PlanDraft = {};
  if (draft.state && draft.state !== cost.state) next.state = draft.state;
  const planId = draftPlanId(cost, draft);
  if (planId !== cost.planId) next.planId = planId;
  const plan = findPlan(plans, planId);
  if (plan) {
    const saved = planId === cost.planId ? savedUsage(plan, cost) : null;
    const merged = { ...(saved ?? {}), ...(draft.usage ?? {}) };
    const changed = saved === null ? Object.keys(merged).length > 0 : Object.keys(merged).some((key) => merged[key] !== saved[key]);
    if (changed) next.usage = draft.usage ?? {};
  } else if ("customMinor" in draft && (draft.customMinor !== cost.expectedMinor || planId !== cost.planId)) {
    next.customMinor = draft.customMinor;
  } else if (planId !== cost.planId) {
    next.customMinor = cost.expectedMinor;
  }
  return Object.keys(next).length === 0 ? null : next;
}

/** Moving into Active on a monthly cost starts it this month, unless it was set to start later. */
export function activationStartsOn(cost: Pick<Cost, "billing" | "startsOn" | "state">, nextState: CostState, currentMonth: string): string | null {
  if (nextState !== "active" || cost.state === "active" || cost.billing !== "monthly") return cost.startsOn;
  const first = `${currentMonth}-01`;
  return cost.startsOn && cost.startsOn > first ? cost.startsOn : first;
}

/* Booked truth */

export function cashOnHand(accounts: { id: string; openingRappen: Rappen; isActive: boolean }[], entries: { accountId: string | null; amountRappen: Rappen }[]): Rappen {
  if (accounts.length === 0) return entries.reduce((sum, e) => sum + e.amountRappen, 0);
  return accounts.filter((a) => a.isActive).reduce((sum, a) => sum + a.openingRappen + entries.filter((e) => e.accountId === a.id).reduce((s, e) => s + e.amountRappen, 0), 0);
}

/** Months of money at that running cost, one decimal, never below zero. Null without a running cost. */
export function runway(cash: Rappen, perMonth: Rappen | null): number | null {
  if (perMonth === null || perMonth <= 0) return null;
  return Math.max(0, Math.round((cash / perMonth) * 10) / 10);
}

/** Planning rate from real bills: expenses in that currency of at least 5.00, recurring ones first, newest 3. */
export function lastBillRate(entries: LedgerEntry[], currency: string): { ppm: number; bills: LedgerEntry[] } | null {
  const bills = entries.filter((e) => e.amountRappen < 0 && e.originalCurrency === currency && (e.originalAmountMinor ?? 0) >= 500);
  const pool = bills.some((b) => b.source === "recurring") ? bills.filter((b) => b.source === "recurring") : bills;
  const newest = pool.slice().sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0, 3);
  if (newest.length === 0) return null;
  const chf = newest.reduce((sum, e) => sum + Math.abs(e.amountRappen), 0);
  const minor = newest.reduce((sum, e) => sum + (e.originalAmountMinor ?? 0), 0);
  const ppm = Math.round((chf * 1_000_000) / minor);
  return ppm < 100_000 || ppm > 10_000_000 ? null : { ppm, bills: newest };
}

export type TwelveRow = { cost: Cost; cells: (Rappen | null)[]; total: Rappen };

/** Rows of the 12-month grid: active costs plus any cost with a booking in the window. */
export function lastTwelve(costs: Cost[], bookings: CostBooking[], endMonth: string): { months: string[]; rows: TwelveRow[]; totals: Rappen[]; total: Rappen } {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(endMonth, i - 11));
  const rows = costs
    .filter((c) => c.state === "active" || bookings.some((b) => b.costId === c.id && months.includes(b.month)))
    .map((cost) => {
      const cells = months.map((month) => {
        const hits = bookings.filter((b) => b.costId === cost.id && b.month === month);
        return hits.length === 0 ? null : hits.reduce((sum, b) => sum + b.amountRappen, 0);
      });
      return { cost, cells, total: cells.reduce<number>((sum, c) => sum + (c ?? 0), 0) };
    });
  const totals = months.map((_, i) => rows.reduce((sum, r) => sum + (r.cells[i] ?? 0), 0));
  return { months, rows, totals, total: totals.reduce((a, b) => a + b, 0) };
}

/** Share of the month gone: at least one day's worth, at most 1. */
export function monthElapsed(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(1, Math.max(1, d) / days);
}

/** One fixed reading from the storage provider. The real system fetches this; the demo prints one. */
export const STORAGE_PROVIDER_READING = {
  readAt: "2027-01-08T13:10:00+01:00",
  buckets: 2,
  objects: 1412,
  bytes: 140_620_000_000,
  classA: 3_180,
  classB: 96_400,
  ownObjects: 412,
  ownBytes: 620_000_000,
  ownClassA: 210,
  ownClassB: 41_200,
};

/** One fixed reading of what the app host billed so far this month. Nothing is booked from it. */
export const APP_HOST_BILLED_READING = {
  readAt: "2027-01-08T13:12:00+01:00",
  currency: "USD",
  minor: 1240,
  services: [
    { service: "Pro Plan", minor: 1000 },
    { service: "Function Duration", minor: 164 },
    { service: "Edge Requests", minor: 76 },
  ],
};

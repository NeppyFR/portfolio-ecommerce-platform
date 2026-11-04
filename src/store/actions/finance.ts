import { DEMO_MONTH, DEMO_NOW_MS, DEMO_TODAY, now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity } from "@/store/flows";
import type { Account, ActionResult, CategoryKind, Cost, CostBooking, CostState, FxRate, LedgerCategory, LedgerEntry, Minor, PlanMeter, PricePlan, Rappen, Receipt, ReportGroup, StockCount } from "@/store/types";
import { FIXED_KIND_SLUGS, MAX_RECEIPTS, bookingKey, costLocksKind, isBooked, type EntryValues } from "@/desk/finance/rules/ledger";
import { activationStartsOn, draftPlanId, findPlan, isStoragePlan, measureStorage, rowCost, savedUsage, type PlanDraft } from "@/desk/finance/rules/planner";
import { canDiscardDraft, confirmRefusal, countTotals, startLines } from "@/desk/finance/rules/stock-count";

let nextId = 1;
registerReset(() => {
  nextId = 1;
});
const uid = (prefix: string) => `${prefix}_b5_${nextId++}`;

const fail = (code: string, message = code): { ok: false; code: string; message: string } => ({ ok: false, code, message });

/** The first year the books hold, which is the earliest year a stock count can exist. */
export const BOOKS_START_YEAR = 2025;

function actorPerson(): LedgerEntry["createdBy"] {
  const p = getState().profile;
  return p === "superUser" ? "owner" : p;
}

/* Entries */

export function createEntry(values: EntryValues): ActionResult<LedgerEntry> {
  const at = now();
  const entry: LedgerEntry = { ...values, id: uid("led"), source: "manual", externalRef: null, receipts: [], createdBy: actorPerson(), createdAt: at, updatedAt: at };
  update((s) => ({ ...s, ledger: [...s.ledger, entry] }));
  logActivity({ area: "finance", action: "entry_added", detail: entry.title });
  return { ok: true, data: entry };
}

export function editEntry(id: string, values: EntryValues): ActionResult<LedgerEntry> {
  const found = getState().ledger.find((e) => e.id === id);
  if (!found) return fail("not_found");
  const next: LedgerEntry = { ...found, ...values, updatedAt: now() };
  update((s) => ({ ...s, ledger: s.ledger.map((e) => (e.id === id ? next : e)) }));
  return { ok: true, data: next };
}

/** A booked running cost goes back to unbooked with its entry, so the month can be booked again. */
export function deleteEntry(id: string): ActionResult<void> {
  const found = getState().ledger.find((e) => e.id === id);
  if (!found) return fail("not_found");
  update((s) => ({ ...s, ledger: s.ledger.filter((e) => e.id !== id), costBookings: s.costBookings.filter((b) => b.entryId !== id) }));
  logActivity({ area: "finance", action: "entry_deleted", detail: found.title });
  return { ok: true, data: undefined };
}

/* Receipts: the name and size are all that is kept. The picker never reads the bytes. */

export function addReceipts(entryId: string, files: { name: string; sizeBytes: number }[]): ActionResult<number> {
  const entry = getState().ledger.find((e) => e.id === entryId);
  if (!entry) return fail("not_found");
  if (entry.receipts.length + files.length > MAX_RECEIPTS) return fail("too_many");
  const added: Receipt[] = files.map((f) => ({ id: uid("rc"), name: f.name, sizeBytes: f.sizeBytes }));
  update((s) => ({ ...s, ledger: s.ledger.map((e) => (e.id === entryId ? { ...e, receipts: [...e.receipts, ...added] } : e)) }));
  return { ok: true, data: added.length };
}

export function removeReceipt(entryId: string, receiptId: string): ActionResult<void> {
  update((s) => ({ ...s, ledger: s.ledger.map((e) => (e.id === entryId ? { ...e, receipts: e.receipts.filter((r) => r.id !== receiptId) } : e)) }));
  return { ok: true, data: undefined };
}

/* Accounts and categories: nothing is ever deleted, only switched off. */

export type AccountInput = { name: string; kind: Account["kind"]; openingRappen: Rappen; openingOn: string; isActive: boolean };

export function saveAccount(id: string | null, input: AccountInput): ActionResult<Account> {
  if (input.name.trim() === "") return fail("name");
  const at = now();
  if (id === null) {
    const row: Account = { ...input, name: input.name.trim().slice(0, 40), id: uid("acc"), updatedAt: at };
    update((s) => ({ ...s, accounts: [...s.accounts, row] }));
    return { ok: true, data: row };
  }
  const found = getState().accounts.find((a) => a.id === id);
  if (!found) return fail("not_found");
  const row: Account = { ...found, ...input, name: input.name.trim().slice(0, 40), updatedAt: at };
  update((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? row : a)) }));
  return { ok: true, data: row };
}

export type CategoryInput = { nameEn: string; nameDe: string; kind: CategoryKind; group: ReportGroup | null; isActive: boolean };

export function saveCategory(id: string | null, input: CategoryInput): ActionResult<LedgerCategory> {
  if (input.nameEn.trim() === "" || input.nameDe.trim() === "") return fail("name");
  if (input.kind === "expense" && input.group === null) return fail("group");
  const group = input.kind === "expense" ? input.group : null;
  if (id === null) {
    const slug = input.nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
    const row: LedgerCategory = { id: uid("cat"), slug: `${slug}-${nextId}`, nameEn: input.nameEn.trim().slice(0, 40), nameDe: input.nameDe.trim().slice(0, 40), kind: input.kind, group, isActive: input.isActive };
    update((s) => ({ ...s, categories: [...s.categories, row] }));
    return { ok: true, data: row };
  }
  const s = getState();
  const found = s.categories.find((c) => c.id === id);
  if (!found) return fail("not_found");
  if (found.kind !== input.kind && costLocksKind(found, s.ledger, s.costs)) return fail("kind_locked");
  const row: LedgerCategory = { ...found, nameEn: input.nameEn.trim().slice(0, 40), nameDe: input.nameDe.trim().slice(0, 40), kind: input.kind, group, isActive: input.isActive };
  update((st) => ({ ...st, categories: st.categories.map((c) => (c.id === id ? row : c)) }));
  return { ok: true, data: row };
}

export const categoryKindLocked = (category: LedgerCategory): boolean => {
  const s = getState();
  return FIXED_KIND_SLUGS.includes(category.slug) || costLocksKind(category, s.ledger, s.costs);
};

/* Running costs */

export type CostInput = { label: string; vendor: string; service: Cost["service"]; billing: Cost["billing"]; expectedMinor: Minor; currency: string; startsOn: string | null; endsOn: string | null; categoryId: string | null; accountId: string | null; note: string; state: CostState; isEstimate: boolean };
export type CostProblem = "name" | "ends_before" | "yearly_start" | "amount";

export function costProblem(input: Pick<CostInput, "label" | "expectedMinor" | "startsOn" | "endsOn" | "billing">): CostProblem | null {
  if (input.label.trim() === "") return "name";
  if (input.expectedMinor < 0) return "amount";
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return "ends_before";
  if (input.billing === "yearly" && !input.startsOn) return "yearly_start";
  return null;
}

export function saveCost(id: string | null, input: CostInput): ActionResult<Cost> {
  const problem = costProblem(input);
  if (problem) return fail(problem);
  const at = now();
  if (id === null) {
    const row: Cost = { ...input, label: input.label.trim().slice(0, 60), vendor: input.vendor.trim().slice(0, 80), note: input.note.trim().slice(0, 500), id: uid("cost"), planId: null, usage: {}, updatedAt: at };
    update((s) => ({ ...s, costs: [...s.costs, row] }));
    logActivity({ area: "finance", action: "cost_added", detail: row.label });
    return { ok: true, data: row };
  }
  const found = getState().costs.find((c) => c.id === id);
  if (!found) return fail("not_found");
  const serviceChanged = found.service !== input.service;
  const planId = serviceChanged ? null : found.planId;
  const onPlan = planId !== null;
  const row: Cost = {
    ...found, ...input, label: input.label.trim().slice(0, 60), vendor: input.vendor.trim().slice(0, 80), note: input.note.trim().slice(0, 500), planId, usage: serviceChanged ? {} : found.usage,
    billing: onPlan ? found.billing : input.billing, expectedMinor: onPlan ? found.expectedMinor : input.expectedMinor, currency: onPlan ? found.currency : input.currency, updatedAt: at,
  };
  update((s) => ({ ...s, costs: s.costs.map((c) => (c.id === id ? row : c)) }));
  return { ok: true, data: row };
}

export type BookInput = { costId: string; month: string; chargedRappen: Rappen; billMinor: Minor | null; occurredOn: string };

/** One entry and one booking, keyed by cost and month. A month books once; a second try is refused. */
export function bookCost(input: BookInput): ActionResult<CostBooking> {
  const s = getState();
  const cost = s.costs.find((c) => c.id === input.costId);
  if (!cost) return fail("not_found");
  if (cost.state !== "active") return fail("planned");
  if (isBooked(s.costBookings, cost.id, input.month)) return fail("already_booked");
  if (input.chargedRappen <= 0) return fail("charged");
  const at = now();
  const entryId = uid("led");
  const foreign = cost.currency !== "CHF";
  const entry: LedgerEntry = {
    id: entryId, amountRappen: -input.chargedRappen, title: `${cost.label} · ${input.month}`, occurredOn: input.occurredOn, description: "", counterparty: cost.vendor,
    categoryId: cost.categoryId ?? "cat_software-hosting", accountId: cost.accountId, dropId: null, originalAmountMinor: foreign ? input.billMinor : null, originalCurrency: foreign && input.billMinor !== null ? cost.currency : null,
    vatRateBp: null, vatRappen: null, source: "recurring", externalRef: bookingKey(cost.id, input.month), receipts: [], createdBy: actorPerson(), createdAt: at, updatedAt: at,
  };
  const booking: CostBooking = { id: uid("bk"), costId: cost.id, month: input.month, amountRappen: input.chargedRappen, originalMinor: foreign ? input.billMinor : input.chargedRappen, currency: cost.currency, occurredOn: input.occurredOn, entryId };
  update((st) => ({ ...st, ledger: [...st.ledger, entry], costBookings: [...st.costBookings, booking], costs: st.costs.map((c) => (c.id === cost.id ? { ...c, isEstimate: false } : c)) }));
  logActivity({ area: "finance", action: "cost_booked", detail: entry.title });
  return { ok: true, data: booking };
}

export function unbookCost(costId: string, month: string): ActionResult<void> {
  const booking = getState().costBookings.find((b) => b.costId === costId && b.month === month);
  if (!booking) return fail("not_found");
  update((s) => ({ ...s, costBookings: s.costBookings.filter((b) => b.id !== booking.id), ledger: s.ledger.filter((e) => e.id !== booking.entryId) }));
  return { ok: true, data: undefined };
}

/** The saved row is revalued here, not taken from the preview: amount and currency come from the plan. */
export function savePlanDraft(costId: string, draft: PlanDraft): ActionResult<Cost> {
  const s = getState();
  const cost = s.costs.find((c) => c.id === costId);
  if (!cost) return fail("not_found");
  const nextState = draft.state ?? cost.state;
  const planId = draftPlanId(cost, draft);
  const plan = findPlan(s.pricePlans, planId);
  if (cost.endsOn && cost.endsOn.slice(0, 7) < DEMO_MONTH && nextState !== "off") return fail("ended");
  if (plan) {
    if (!plan.isActive && plan.id !== cost.planId) return fail("not_offered");
    if (cost.billing === "yearly") return fail("yearly_plan");
    if (isStoragePlan(plan) && s.costs.some((c) => c.id !== cost.id && isStoragePlan(findPlan(s.pricePlans, c.planId)) && c.state !== "off")) return fail("storage_taken");
  }
  const measure = measureStorage(s.files, s.ledger, DEMO_MONTH);
  const usage = plan ? { ...savedUsage(plan, cost), ...(draft.usage ?? {}) } : {};
  const priced = rowCost({ ...cost, usage, planId }, s.pricePlans, measure, plan ? undefined : { planId: null, customMinor: "customMinor" in draft ? draft.customMinor ?? 0 : cost.expectedMinor });
  if (priced.result?.tooLarge) return fail("too_large");
  const row: Cost = { ...cost, state: nextState, planId, usage, expectedMinor: priced.minor, currency: priced.currency, billing: plan ? "monthly" : cost.billing, startsOn: activationStartsOn(cost, nextState, DEMO_MONTH), updatedAt: now() };
  update((st) => ({ ...st, costs: st.costs.map((c) => (c.id === costId ? row : c)) }));
  return { ok: true, data: row };
}

export type PlanEdit = { baseMinor: Minor; seatMinor: Minor | null; creditMinor: Minor; asOf: string; source: string; note: string; isActive: boolean; meters: Pick<PlanMeter, "key" | "included" | "priceMicro" | "hardLimit">[] };

export function savePrices(planId: string, edit: PlanEdit): ActionResult<PricePlan> {
  const plan = getState().pricePlans.find((p) => p.id === planId);
  if (!plan) return fail("not_found");
  const row: PricePlan = {
    ...plan, baseMinor: edit.baseMinor, seatMinor: edit.seatMinor, creditMinor: edit.creditMinor, asOf: edit.asOf, source: edit.source, note: edit.note, isActive: edit.isActive,
    meters: plan.meters.map((m) => {
      const next = edit.meters.find((e) => e.key === m.key);
      return next ? { ...m, included: next.included, priceMicro: next.priceMicro, hardLimit: next.hardLimit } : m;
    }),
  };
  update((s) => ({ ...s, pricePlans: s.pricePlans.map((p) => (p.id === planId ? row : p)) }));
  return { ok: true, data: row };
}

export function saveRate(currency: string, edit: Pick<FxRate, "chfPpm" | "asOf" | "source" | "note">): ActionResult<FxRate> {
  if (edit.chfPpm < 100_000 || edit.chfPpm > 10_000_000) return fail("range");
  const found = getState().fxRates.find((r) => r.currency === currency);
  const row: FxRate = { currency, ...edit };
  update((s) => ({ ...s, fxRates: found ? s.fxRates.map((r) => (r.currency === currency ? row : r)) : [...s.fxRates, row] }));
  return { ok: true, data: row };
}

/** VAT stays a feature: a toggle with no statement behind it. Off by default. */
export function setVatEnabled(on: boolean): ActionResult<boolean> {
  update((s) => ({ ...s, settings: { ...s.settings, vatEnabled: on, updatedAt: now() } }));
  logActivity({ area: "finance", action: on ? "vat_on" : "vat_off", detail: "" });
  return { ok: true, data: on };
}

/* Stock count: counting never moves stock. */

const patchCount = (year: number, fn: (c: StockCount) => StockCount) => update((s) => ({ ...s, stockCounts: s.stockCounts.map((c) => (c.year === year ? fn(c) : c)) }));

/** A second start tops up the missing sizes instead of duplicating. */
export function startCount(year: number): ActionResult<number> {
  const s = getState();
  const existing = s.stockCounts.find((c) => c.year === year);
  if (existing?.status === "confirmed") return fail("confirmed");
  const lines = startLines(year, s.products, s.movements, existing?.lines ?? []);
  if (existing) {
    patchCount(year, (c) => ({ ...c, lines: [...c.lines, ...lines] }));
    return { ok: true, data: lines.length };
  }
  const count: StockCount = { id: uid("count"), year, status: "draft", startedOn: DEMO_TODAY, startedBy: actorPerson(), confirmedAt: null, confirmedBy: null, lines };
  update((st) => ({ ...st, stockCounts: [count, ...st.stockCounts] }));
  logActivity({ area: "finance", action: "stock_count_started", detail: String(year) });
  return { ok: true, data: lines.length };
}

export type LinePatch = { id: string; counted: number | null; toShip: number; stockAtCount: number | null; typedCostRappen: Rappen | null };

export function saveCountLines(year: number, patches: LinePatch[]): ActionResult<number> {
  const count = getState().stockCounts.find((c) => c.year === year);
  if (!count) return fail("gone");
  if (count.status === "confirmed") return fail("confirmed");
  const byId = new Map(patches.map((p) => [p.id, p]));
  patchCount(year, (c) => ({ ...c, lines: c.lines.map((l) => (byId.has(l.id) ? { ...l, ...(byId.get(l.id) as LinePatch) } : l)) }));
  return { ok: true, data: patches.length };
}

/** Sizes on sale that the count does not hold yet. */
export function missingSizes(year: number): number {
  const s = getState();
  const count = s.stockCounts.find((c) => c.year === year);
  return count ? startLines(year, s.products, s.movements, count.lines).length : 0;
}

export function confirmCount(year: number, typedYear: string): ActionResult<{ pieces: number; valueRappen: Rappen; unknownPieces: number }> {
  const count = getState().stockCounts.find((c) => c.year === year);
  if (!count) return fail("gone");
  if (count.status === "confirmed") return fail("confirmed");
  const refusal = confirmRefusal(count, typedYear, DEMO_NOW_MS, missingSizes(year));
  if (refusal) return fail(refusal);
  const totals = countTotals(count.lines);
  patchCount(year, (c) => ({ ...c, status: "confirmed", confirmedAt: now(), confirmedBy: actorPerson() }));
  logActivity({ area: "finance", action: "stock_count_confirmed", detail: `${year}: ${totals.pieces} pieces` });
  return { ok: true, data: { pieces: totals.pieces, valueRappen: totals.valueRappen, unknownPieces: totals.unknownCostPieces } };
}

export function discardCount(year: number): ActionResult<void> {
  const count = getState().stockCounts.find((c) => c.year === year);
  if (!count) return fail("gone");
  if (count.status !== "draft") return fail("confirmed");
  if (!canDiscardDraft(year, DEMO_TODAY, BOOKS_START_YEAR)) return fail("kept");
  update((s) => ({ ...s, stockCounts: s.stockCounts.filter((c) => c.year !== year) }));
  logActivity({ area: "finance", action: "stock_count_discarded", detail: String(year) });
  return { ok: true, data: undefined };
}

/** Only superUser reopens. The year-end value leaves the report until it is confirmed again. */
export function reopenCount(year: number, reason: string): ActionResult<void> {
  const s = getState();
  if (s.profile !== "superUser") return fail("forbidden");
  if (reason.trim() === "") return fail("reason");
  const count = s.stockCounts.find((c) => c.year === year);
  if (!count || count.status !== "confirmed") return fail("not_confirmed");
  patchCount(year, (c) => ({ ...c, status: "draft", confirmedAt: null, confirmedBy: null }));
  logActivity({ area: "finance", action: "stock_count_reopened", detail: `${year}: ${reason.trim().slice(0, 200)}` });
  return { ok: true, data: undefined };
}

import { monthOf } from "@/lib/dates";
import { parseChf } from "@/lib/format";
import { vatIncluded } from "@/lib/vat";
import type { Account, Cost, CostBooking, LedgerCategory, LedgerEntry, Rappen } from "@/store/types";

export const MAX_ENTRY_RAPPEN = 1_000_000_000;
export const MAX_RECEIPTS = 10;
export const MAX_RECEIPT_BYTES = 20_000_000;
export const RECEIPT_TYPES = /\.(png|jpe?g|webp|avif|pdf)$/i;
/** Their kind stays fixed, whatever happens to them. */
export const FIXED_KIND_SLUGS = ["shop-sales", "partner-deposit", "partner-withdrawal", "vat-settlement"];

export const openingTotal = (accounts: Pick<Account, "openingRappen">[]): Rappen => accounts.reduce((sum, a) => sum + a.openingRappen, 0);

/** Oldest first by day, then creation, then id: the order the running balance is built in. */
export function bookOrder(a: LedgerEntry, b: LedgerEntry): number {
  return a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** The balance after each entry, over the whole book. Filtering hides rows but never changes these. */
export function runningBalances(entries: LedgerEntry[], accounts: Pick<Account, "openingRappen">[]): Map<string, Rappen> {
  const out = new Map<string, Rappen>();
  let balance = openingTotal(accounts);
  for (const entry of entries.slice().sort(bookOrder)) {
    balance += entry.amountRappen;
    out.set(entry.id, balance);
  }
  return out;
}

export const bookBalance = (entries: Pick<LedgerEntry, "amountRappen">[], accounts: Pick<Account, "openingRappen">[]): Rappen => openingTotal(accounts) + entries.reduce((sum, e) => sum + e.amountRappen, 0);

export const accountBalance = (account: Pick<Account, "id" | "openingRappen">, entries: Pick<LedgerEntry, "accountId" | "amountRappen">[]): Rappen =>
  account.openingRappen + entries.filter((e) => e.accountId === account.id).reduce((sum, e) => sum + e.amountRappen, 0);

export const notOnAccount = (entries: Pick<LedgerEntry, "accountId" | "amountRappen">[]): Rappen => entries.filter((e) => e.accountId === null).reduce((sum, e) => sum + e.amountRappen, 0);

export function moneyInOut(entries: Pick<LedgerEntry, "amountRappen">[]): { moneyIn: Rappen; moneyOut: Rappen } {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const e of entries) {
    if (e.amountRappen >= 0) moneyIn += e.amountRappen;
    else moneyOut -= e.amountRappen;
  }
  return { moneyIn, moneyOut };
}

/** An empty string is any; `none` is only entries without one. */
export type LedgerFilter = { q: string; month: string; category: string; account: string; drop: string };
export const NO_FILTER: LedgerFilter = { q: "", month: "", category: "", account: "", drop: "" };
export const isFiltered = (f: LedgerFilter): boolean => f.q.trim() !== "" || f.month !== "" || f.category !== "" || f.account !== "" || f.drop !== "";

const matchesRef = (value: string | null, wanted: string): boolean => wanted === "" || (wanted === "none" ? value === null : value === wanted);

export function filterEntries(entries: LedgerEntry[], f: LedgerFilter): LedgerEntry[] {
  const needle = f.q.trim().toLowerCase();
  return entries.filter((e) => {
    if (f.month && monthOf(e.occurredOn) !== f.month) return false;
    if (!matchesRef(e.categoryId, f.category) || !matchesRef(e.accountId, f.account) || !matchesRef(e.dropId, f.drop)) return false;
    return needle === "" || `${e.title}\n${e.description}\n${e.counterparty}`.toLowerCase().includes(needle);
  });
}

export const monthsWithEntries = (entries: Pick<LedgerEntry, "occurredOn">[]): string[] => [...new Set(entries.map((e) => monthOf(e.occurredOn)))].sort().reverse();

export const newestFirst = (entries: LedgerEntry[]): LedgerEntry[] => entries.slice().sort((a, b) => bookOrder(b, a));

/** Income and expense carry VAT. Shop sales, transfers and entries with no category never do. */
export const takesVat = (category: Pick<LedgerCategory, "kind" | "slug"> | null | undefined): boolean => !!category && category.kind !== "transfer" && category.slug !== "shop-sales";

export type EntryDraft = {
  direction: "in" | "out"; amountText: string; occurredOn: string; title: string; categoryId: string | null; accountId: string | null; counterparty: string; dropId: string | null;
  originalText: string; originalCurrency: string; vatRateBp: number | null; vatText: string; description: string;
};
export type EntryProblem = "amount" | "title" | "date" | "original" | "vat";
export type EntryValues = Pick<LedgerEntry, "amountRappen" | "occurredOn" | "title" | "categoryId" | "accountId" | "counterparty" | "dropId" | "originalAmountMinor" | "originalCurrency" | "vatRateBp" | "vatRappen" | "description">;

/** Turns the form into a signed entry, or names the one field at fault. VAT is stored with the amount's sign. */
export function readEntryDraft(d: EntryDraft, vatFields: boolean): { ok: true; values: EntryValues } | { ok: false; problem: EntryProblem } {
  const amount = parseChf(d.amountText);
  if (amount === null || amount <= 0 || amount > MAX_ENTRY_RAPPEN) return { ok: false, problem: "amount" };
  if (d.title.trim() === "") return { ok: false, problem: "title" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.occurredOn)) return { ok: false, problem: "date" };
  const hasOriginal = d.originalText.trim() !== "";
  const hasCurrency = d.originalCurrency !== "";
  if (hasOriginal !== hasCurrency) return { ok: false, problem: "original" };
  const original = hasOriginal ? parseChf(d.originalText) : null;
  if (hasOriginal && (original === null || original <= 0)) return { ok: false, problem: "original" };
  const sign = d.direction === "in" ? 1 : -1;
  let vatRateBp: number | null = null;
  let vatRappen: number | null = null;
  if (vatFields && d.vatRateBp !== null) {
    const vat = parseChf(d.vatText);
    if (vat === null || vat < 0 || vat > amount || (d.vatRateBp === 0 && vat !== 0)) return { ok: false, problem: "vat" };
    vatRateBp = d.vatRateBp;
    vatRappen = vat === 0 ? 0 : sign * vat;
  }
  return {
    ok: true,
    values: {
      amountRappen: sign * amount, occurredOn: d.occurredOn, title: d.title.trim().slice(0, 120), categoryId: d.categoryId, accountId: d.accountId, counterparty: d.counterparty.trim().slice(0, 80), dropId: d.dropId,
      originalAmountMinor: original, originalCurrency: hasOriginal ? d.originalCurrency : null, vatRateBp, vatRappen, description: d.description.trim().slice(0, 2000),
    },
  };
}

/** Prefills the VAT field whenever the amount or the rate changes; the field stays editable. */
export function suggestedVat(amountText: string, bp: number | null): string {
  const amount = parseChf(amountText);
  if (amount === null || amount <= 0 || bp === null) return "";
  const vat = vatIncluded(amount, bp);
  return `${Math.floor(vat / 100)}.${String(vat % 100).padStart(2, "0")}`;
}

export const uncategorised = (entries: Pick<LedgerEntry, "categoryId">[]): number => entries.filter((e) => e.categoryId === null).length;

/** A booking writes one entry, keyed so a month can only be booked once. */
export const bookingKey = (costId: string, month: string): string => `recurring:${costId}:${month}`;

export const isBooked = (bookings: CostBooking[], costId: string, month: string): boolean => bookings.some((b) => b.costId === costId && b.month === month);

export const costLocksKind = (category: LedgerCategory, entries: Pick<LedgerEntry, "categoryId">[], costs: Pick<Cost, "categoryId">[]): boolean =>
  FIXED_KIND_SLUGS.includes(category.slug) || entries.some((e) => e.categoryId === category.id) || costs.some((c) => c.categoryId === category.id);

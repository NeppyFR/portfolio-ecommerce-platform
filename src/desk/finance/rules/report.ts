import { csvAmount, toCsv, type CsvCell } from "@/lib/csv";
import { addMonths, monthBounds, monthOf, quarterBounds, quarterOf } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { LABEL } from "@/lib/brand";
import { vatIncluded, vatRatePercent } from "@/lib/vat";
import type { Account, Drop, Lang, LedgerCategory, LedgerEntry, Rappen, ReportGroup } from "@/store/types";

export type PeriodKey = string;
const QUARTER = /^(\d{4})-Q([1-4])$/;
const YEAR = /^\d{4}$/;

export const isPeriod = (key: string): boolean => QUARTER.test(key) || YEAR.test(key);

/** `2026-Q3` prints `Q3 2026`; a year prints itself, in both languages. */
export function periodLabel(key: PeriodKey): string {
  const m = QUARTER.exec(key);
  return m ? `Q${m[2]} ${m[1]}` : key;
}

/** In a quarter's first month the old books are still being closed, so the previous quarter is the default. */
export function defaultPeriod(today: string): PeriodKey {
  const month = Number(today.slice(5, 7));
  if ((month - 1) % 3 !== 0) return quarterOf(today);
  return quarterOf(`${addMonths(today.slice(0, 7), -1)}-01`);
}

export function periodBounds(key: PeriodKey): { start: string; end: string } {
  if (YEAR.test(key)) return { start: `${key}-01-01`, end: `${key}-12-31` };
  return quarterBounds(key);
}

export const inPeriod = (day: string, key: PeriodKey): boolean => {
  const { start, end } = periodBounds(key);
  return day >= start && day <= end;
};

/** Every quarter from the first day's quarter to the current one, newest first, then those years. */
export function periodOptions(days: string[], today: string): PeriodKey[] {
  const current = quarterOf(today);
  const fallback = defaultPeriod(today);
  const past = days.filter((d) => d <= today).map(quarterOf).sort();
  const first = past[0] && past[0] < fallback ? past[0] : fallback;
  const quarters: string[] = [];
  let [y, q] = first.split("-Q").map(Number);
  for (;;) {
    const key = `${y}-Q${q}`;
    quarters.push(key);
    if (key === current) break;
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  const years = [...new Set(quarters.map((k) => k.slice(0, 4)))].sort().reverse();
  return [...quarters.reverse(), ...years];
}

export function periodColumns(key: PeriodKey): string[] {
  if (YEAR.test(key)) return [1, 2, 3, 4].map((q) => `${key}-Q${q}`);
  const start = periodBounds(key).start.slice(0, 7);
  return [0, 1, 2].map((i) => addMonths(start, i));
}

const MONTH_HEADS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sept", "Okt", "Nov", "Dez"],
};

export const columnHead = (column: string, lang: Lang): string => {
  const m = QUARTER.exec(column);
  if (m) return `Q${m[2]}`;
  return MONTH_HEADS[lang][Number(column.slice(5, 7)) - 1];
};

const columnOf = (day: string, key: PeriodKey): string => (YEAR.test(key) ? quarterOf(day) : monthOf(day));

export type ReportLine = "sales" | "other_income" | ReportGroup | "uncategorised" | "transfer";
export const REPORT_ORDER: ReportLine[] = ["sales", "other_income", "production", "administration", "shipping", "equipment", "other", "uncategorised"];

export function reportLineOf(categoryId: string | null, categories: LedgerCategory[]): ReportLine {
  const cat = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
  if (!cat) return "uncategorised";
  if (cat.kind === "transfer") return "transfer";
  if (cat.kind === "income") return cat.slug === "shop-sales" ? "sales" : "other_income";
  return cat.group ?? "other";
}

export type ReportRow = { line: ReportLine; cells: Record<string, Rappen>; total: Rappen; count: number };
export type ReportTable = { columns: string[]; rows: ReportRow[]; result: ReportRow; transfers: ReportRow; entryCount: number };

/** Cash basis: an entry counts on its day. Money out stays negative. Transfers never reach the result. */
export function reportTable(entries: LedgerEntry[], categories: LedgerCategory[], key: PeriodKey, vatOn: boolean): ReportTable {
  const columns = periodColumns(key);
  const blank = (line: ReportLine): ReportRow => ({ line, cells: Object.fromEntries(columns.map((c) => [c, 0])), total: 0, count: 0 });
  const rows = new Map<ReportLine, ReportRow>(REPORT_ORDER.map((line) => [line, blank(line)]));
  const result = blank("other");
  const transfers = blank("transfer");
  let entryCount = 0;
  for (const e of entries) {
    if (!inPeriod(e.occurredOn, key)) continue;
    entryCount += 1;
    const rappen = vatOn ? e.amountRappen - (e.vatRappen ?? 0) : e.amountRappen;
    const column = columnOf(e.occurredOn, key);
    const line = reportLineOf(e.categoryId, categories);
    const targets = line === "transfer" ? [transfers] : [rows.get(line) as ReportRow, result];
    for (const row of targets) {
      row.cells[column] = (row.cells[column] ?? 0) + rappen;
      row.total += rappen;
      row.count += 1;
    }
  }
  const shown = REPORT_ORDER.filter((line) => line !== "uncategorised" || (rows.get(line) as ReportRow).count > 0).map((line) => rows.get(line) as ReportRow);
  return { columns, rows: shown, result, transfers, entryCount };
}

/** Year-end stock shows on a year or on a Q4. */
export const showsYearEnd = (key: PeriodKey): boolean => YEAR.test(key) || key.endsWith("-Q4");
export const yearOfPeriod = (key: PeriodKey): number => Number(key.slice(0, 4));

/* VAT */

export type VatOutputRow = { bp: number; entries: number; base: Rappen; tax: Rappen; typed: Rappen; rounding: Rappen };
export type VatInputRow = { group: ReportGroup; entries: number; tax: Rappen };
export type VatSummary = { payouts: number; payoutRappen: Rappen; output: VatOutputRow[]; input: VatInputRow[]; inputTotal: Rappen; missingVat: number; uncategorisedVat: number };

/** Effective method, from what the ledger holds. Transfers and shop sales carry no tax here. */
export function vatSummary(entries: LedgerEntry[], categories: LedgerCategory[], key: PeriodKey): VatSummary {
  const out: VatSummary = { payouts: 0, payoutRappen: 0, output: [], input: [], inputTotal: 0, missingVat: 0, uncategorisedVat: 0 };
  const output = new Map<number, { entries: number; gross: Rappen; typed: Rappen }>();
  const input = new Map<ReportGroup, { entries: number; tax: Rappen }>();
  for (const e of entries) {
    if (!inPeriod(e.occurredOn, key)) continue;
    const cat = e.categoryId ? categories.find((c) => c.id === e.categoryId) : undefined;
    if (!cat) {
      if (e.vatRappen !== null) out.uncategorisedVat += 1;
      continue;
    }
    if (cat.kind === "transfer") continue;
    if (cat.slug === "shop-sales") {
      out.payouts += 1;
      out.payoutRappen += e.amountRappen;
      continue;
    }
    if (e.vatRateBp === null || e.vatRappen === null) {
      out.missingVat += 1;
      continue;
    }
    if (cat.kind === "income") {
      const row = output.get(e.vatRateBp) ?? { entries: 0, gross: 0, typed: 0 };
      row.entries += 1;
      row.gross += e.amountRappen;
      row.typed += e.vatRappen;
      output.set(e.vatRateBp, row);
    } else {
      const group = cat.group ?? "other";
      const row = input.get(group) ?? { entries: 0, tax: 0 };
      row.entries += 1;
      row.tax -= e.vatRappen;
      input.set(group, row);
    }
  }
  out.output = [...output.entries()].sort((a, b) => b[0] - a[0]).map(([bp, r]) => {
    const tax = vatIncluded(r.gross, bp);
    return { bp, entries: r.entries, base: r.gross - r.typed, tax, typed: r.typed, rounding: tax - r.typed };
  });
  out.input = (["production", "administration", "shipping", "equipment", "other"] as ReportGroup[]).filter((g) => input.has(g)).map((group) => ({ group, ...(input.get(group) as { entries: number; tax: Rappen }) }));
  out.inputTotal = out.input.reduce((sum, r) => sum + r.tax, 0);
  return out;
}

/* The accountant's CSV */

const LINE_CSV: Record<Exclude<ReportLine, "sales">, string> = {
  other_income: "Other income", production: "Production", administration: "Administration", shipping: "Shipping", equipment: "Equipment", other: "Other", uncategorised: "Uncategorised", transfer: "Transfers (not in the result)",
};

export const FINANCE_COLUMNS = ["Date", "Type", "Group", "Category", "Title", "Counterparty", "Account", "Drop", "Amount CHF", "Original amount", "Original currency", "Receipts", "Source", "Description"];
const VAT_COLUMNS = ["VAT rate %", "VAT CHF", "Net CHF"];

type CsvBook = { entries: LedgerEntry[]; categories: LedgerCategory[]; accounts: Pick<Account, "id" | "name">[]; drops: Pick<Drop, "id" | "name">[]; vatOn: boolean };
type Sortable = { day: string; order: number; created: string; id: string; cells: CsvCell[] };

/** Each entry is a row, except shop sales, which collapse to one total per month. English header, no footer. */
export function financeCsv(book: CsvBook, key: PeriodKey): string {
  const { entries, categories, accounts, drops, vatOn } = book;
  const { start, end } = periodBounds(key);
  const within = entries.filter((e) => e.occurredOn >= start && e.occurredOn <= end);
  const withVat = vatOn || within.some((e) => e.vatRappen !== null);
  const sales = categories.find((c) => c.slug === "shop-sales");
  const rows: Sortable[] = [];
  for (const e of within) {
    if (e.categoryId && e.categoryId === sales?.id) continue;
    const line = reportLineOf(e.categoryId, categories);
    const cat = categories.find((c) => c.id === e.categoryId);
    const cells: CsvCell[] = [
      formatDate(e.occurredOn), "Entry", line === "sales" ? "Sales (net payouts)" : LINE_CSV[line], cat?.nameEn ?? "", e.title, e.counterparty, accounts.find((a) => a.id === e.accountId)?.name ?? "", drops.find((d) => d.id === e.dropId)?.name ?? "",
      csvAmount(e.amountRappen), e.originalAmountMinor === null ? "" : csvAmount(e.originalAmountMinor), e.originalCurrency ?? "", e.receipts.map((r) => r.name).join(" | "), e.source, e.description,
    ];
    if (withVat) cells.push(e.vatRateBp === null ? "" : vatRatePercent(e.vatRateBp), e.vatRappen === null ? "" : csvAmount(e.vatRappen), e.vatRappen === null ? "" : csvAmount(e.amountRappen - e.vatRappen));
    rows.push({ day: e.occurredOn, order: 0, created: e.createdAt, id: e.id, cells });
  }
  for (let month = start.slice(0, 7); month <= end.slice(0, 7); month = addMonths(month, 1)) {
    const hits = within.filter((e) => monthOf(e.occurredOn) === month && e.categoryId === sales?.id);
    const total = hits.reduce((sum, e) => sum + e.amountRappen, 0);
    const monthEnd = monthBounds(month).end;
    const day = monthEnd > end ? end : monthEnd;
    const [y, m] = month.split("-");
    const cells: CsvCell[] = [formatDate(day), "Sales total", "Sales (net payouts)", "Shop sales", `Payouts ${m}.${y}`, "", "", "", csvAmount(total), "", "", "", "", hits.length === 1 ? "1 payout booked" : `${hits.length} payouts booked`];
    if (withVat) cells.push("", "", "");
    rows.push({ day, order: 1, created: "", id: month, cells });
  }
  rows.sort((a, b) => a.day.localeCompare(b.day) || a.order - b.order || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
  return toCsv(withVat ? [...FINANCE_COLUMNS, ...VAT_COLUMNS] : FINANCE_COLUMNS, rows.map((r) => r.cells));
}

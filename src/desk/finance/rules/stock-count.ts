import { csvAmount, toCsv } from "@/lib/csv";
import { SIZES } from "@/lib/product-rules";
import { parseChf } from "@/lib/format";
import type { Order, Product, Rappen, SizeCode, StockCount, StockCountLine, StockMove } from "@/store/types";

export const MAX_COUNTED = 100_000;
export const MAX_TYPED_COST = 1_000_000_000;
export const FIRST_COUNT_YEAR = 2024;

/** 00:00 Zurich on 1 January of the next year. */
export const cutoffIso = (year: number): string => new Date(Date.UTC(year, 11, 31, 23, 0, 0)).toISOString();
export const canConfirmYet = (year: number, nowMs: number): boolean => nowMs >= Date.parse(cutoffIso(year));

/** On 31.12 the current year, otherwise the last one. Null before the first year. */
export function countableYear(today: string, booksStartYear: number | null): number | null {
  const year = Number(today.slice(0, 4));
  const target = today.slice(5) === "12-31" ? year : year - 1;
  const first = Math.max(booksStartYear ?? year, FIRST_COUNT_YEAR);
  return target < first ? null : target;
}
export const canDiscardDraft = (year: number, today: string, booksStartYear: number | null): boolean => countableYear(today, booksStartYear) === year;

export type LineFigures = { moved: number | null; yearEnd: number | null; difference: number | null; value: Rappen | null; unit: Rappen | null };

/** moved = stock at count − system. year-end = counted − to ship − moved. A count on 31.12 or on 5.1 gives the same. */
export function lineSums(line: Pick<StockCountLine, "systemQty" | "counted" | "toShip" | "stockAtCount" | "productCostRappen" | "typedCostRappen">): LineFigures {
  const unit = line.productCostRappen ?? line.typedCostRappen;
  if (line.counted === null || line.stockAtCount === null) return { moved: null, yearEnd: null, difference: null, value: null, unit };
  const moved = line.stockAtCount - line.systemQty;
  const yearEnd = line.counted - line.toShip - moved;
  return { moved, yearEnd, difference: yearEnd - line.systemQty, value: unit === null ? null : yearEnd * unit, unit };
}

export type CountTotals = { pieces: number; valuedPieces: number; valueRappen: Rappen; unknownCostPieces: number; unknownCostLines: number; uncountedLines: number; negativeLines: number; countedLines: number; totalLines: number };

/** An explicit cost of 0 is valued; an unknown cost is reported, never valued at 0. */
export function countTotals(lines: StockCountLine[]): CountTotals {
  const t: CountTotals = { pieces: 0, valuedPieces: 0, valueRappen: 0, unknownCostPieces: 0, unknownCostLines: 0, uncountedLines: 0, negativeLines: 0, countedLines: 0, totalLines: lines.length };
  for (const line of lines) {
    const f = lineSums(line);
    if (f.yearEnd === null) {
      t.uncountedLines += 1;
      continue;
    }
    t.countedLines += 1;
    t.pieces += f.yearEnd;
    if (f.yearEnd < 0) t.negativeLines += 1;
    if (f.unit === null) {
      if (f.yearEnd > 0) {
        t.unknownCostPieces += f.yearEnd;
        t.unknownCostLines += 1;
      }
    } else {
      t.valuedPieces += f.yearEnd;
      t.valueRappen += f.yearEnd * f.unit;
    }
  }
  return t;
}

/** Empty clears; whole 0 to 100'000 with `'` and spaces allowed; anything else is invalid. */
export function parseCounted(text: string): { ok: true; value: number | null } | { ok: false } {
  const cleaned = text.replace(/['\s ]/g, "");
  if (cleaned === "") return { ok: true, value: null };
  if (!/^\d+$/.test(cleaned)) return { ok: false };
  const value = Number(cleaned);
  return value > MAX_COUNTED ? { ok: false } : { ok: true, value };
}

/** Empty means unknown; 0 to CHF 10'000'000. */
export function parseTypedCost(text: string): { ok: true; value: Rappen | null } | { ok: false } {
  if (text.trim() === "") return { ok: true, value: null };
  const value = parseChf(text);
  return value === null || value < 0 || value > MAX_TYPED_COST ? { ok: false } : { ok: true, value };
}

export type LiveFigures = { stock: number; toShip: number };

/** What each variant holds now, and what is sold but not shipped. */
export function liveFigures(products: Pick<Product, "variants">[], orders: Pick<Order, "status" | "items">[]): Map<string, LiveFigures> {
  const out = new Map<string, LiveFigures>();
  for (const product of products) for (const v of product.variants) out.set(v.id, { stock: v.stock, toShip: 0 });
  for (const order of orders) {
    if (order.status !== "paid" && order.status !== "packed") continue;
    for (const item of order.items) {
      const row = out.get(item.variantId);
      if (row) row.toShip += Math.max(0, item.quantity - item.shortfall);
    }
  }
  return out;
}

/** What the system expects on the shelf: stock plus sold, not shipped. A variant that is gone keeps its system figure. */
export const expectedOnShelf = (line: Pick<StockCountLine, "variantId" | "systemQty">, live: Map<string, LiveFigures>): number => {
  const row = line.variantId ? live.get(line.variantId) : undefined;
  return row ? Math.max(0, row.stock + row.toShip) : line.systemQty;
};

/** A line as it would save: a changed count uses the variant's live figures; a variant that is gone counts as unmoved. */
export function withCounted(line: StockCountLine, counted: number | null, live: Map<string, LiveFigures>): StockCountLine {
  if (counted === null) return { ...line, counted: null, toShip: 0, stockAtCount: null };
  const row = line.variantId ? live.get(line.variantId) : undefined;
  return { ...line, counted, toShip: row?.toShip ?? 0, stockAtCount: row?.stock ?? line.systemQty };
}

const sizeRank = (size: SizeCode) => SIZES.indexOf(size);

export const lineOrder = (a: StockCountLine, b: StockCountLine): number =>
  a.productName.localeCompare(b.productName) || sizeRank(a.size) - sizeRank(b.size) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku);

/** Stock at the cutoff: the current stock with every later movement taken back. */
export const stockAtCutoff = (variantId: string, current: number, movements: Pick<StockMove, "variantId" | "createdAt" | "delta">[], cutoff: string): number => {
  const limit = Date.parse(cutoff);
  return current - movements.filter((m) => m.variantId === variantId && Date.parse(m.createdAt) >= limit).reduce((sum, m) => sum + m.delta, 0);
};

/** The variants a count holds: created before the cutoff, and on sale or holding stock at the cutoff. */
export function startLines(year: number, products: Product[], movements: StockMove[], existing: StockCountLine[] = []): StockCountLine[] {
  const cutoff = cutoffIso(year);
  const have = new Set(existing.map((l) => l.variantId));
  const lines: StockCountLine[] = [];
  for (const product of products) {
    if (Date.parse(product.createdAt) >= Date.parse(cutoff)) continue;
    for (const variant of product.variants) {
      if (have.has(variant.id)) continue;
      const system = stockAtCutoff(variant.id, variant.stock, movements, cutoff);
      const onSale = product.status === "active" && variant.isActive;
      if (!onSale && system === 0) continue;
      lines.push({ id: `scl_${year}_${variant.id}`, variantId: variant.id, productName: product.nameEn, size: variant.size, color: variant.color, sku: variant.sku, systemQty: system, counted: null, toShip: 0, stockAtCount: null, productCostRappen: product.costRappen, typedCostRappen: null, sizeDeleted: false });
    }
  }
  return lines;
}

export type ConfirmRefusal = "wrong_year" | "before_cutoff" | "missing_sizes" | "uncounted" | "negative";

/** The order of refusals matters: time, then gaps, then counts. */
export function confirmRefusal(count: StockCount, typedYear: string, nowMs: number, missingSizes: number): ConfirmRefusal | null {
  if (typedYear.trim() !== String(count.year)) return "wrong_year";
  if (!canConfirmYet(count.year, nowMs)) return "before_cutoff";
  if (missingSizes > 0) return "missing_sizes";
  const totals = countTotals(count.lines);
  if (totals.uncountedLines > 0) return "uncounted";
  if (totals.negativeLines > 0) return "negative";
  return null;
}

export const STOCK_COLUMNS = ["SKU", "Product", "Size", "Colour", "System qty 31.12", "Counted", "Sold not shipped", "Moved since 31.12", "Year-end qty", "Difference", "Unit cost CHF", "Cost source", "Value CHF"];

/** One row per variant, then the two footer rows. */
export function stockCountCsv(count: StockCount): string {
  const lines = count.lines.slice().sort(lineOrder);
  const rows = lines.map((line) => {
    const f = lineSums(line);
    return [
      line.sku, line.productName, line.size === "ONE_SIZE" ? "One size" : line.size, line.color, line.systemQty, line.counted, line.toShip, f.moved, f.yearEnd, f.difference,
      f.unit === null ? "" : csvAmount(f.unit), line.productCostRappen !== null ? "Product" : line.typedCostRappen !== null ? "Typed" : "Unknown", f.value === null ? "" : csvAmount(f.value),
    ];
  });
  const t = countTotals(lines);
  rows.push(["Total (cost known)", "", "", "", "", "", "", "", t.valuedPieces, "", "", "", csvAmount(t.valueRappen)]);
  rows.push([`Cost unknown: ${t.unknownCostPieces} piece(s) in ${t.unknownCostLines} size(s)`, "", "", "", "", "", "", "", t.unknownCostPieces, "", "", "", ""]);
  return toCsv(STOCK_COLUMNS, rows);
}

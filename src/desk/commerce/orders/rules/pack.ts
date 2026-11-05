import type { Order, SizeCode } from "@/store/types";
import { classifyScan } from "./scan";

export type PackLine = { itemId: string; sku: string; name: string; nameDe: string; size: SizeCode; color: string; need: number };
/** Pieces already in the box, by order item. */
export type PackState = Record<string, number>;

export type PackOutcome =
  | { kind: "counted"; line: PackLine; packed: number }
  | { kind: "complete"; line: PackLine; packed: number }
  | { kind: "wrong"; sku: string }
  | { kind: "over"; line: PackLine }
  | { kind: "unknown"; code: string }
  | { kind: "this_order" }
  | { kind: "other_order"; number: string };

/** What has to go in the box: ordered, less what was missing at payment and what is already back in stock. */
export function packLines(order: Pick<Order, "items">): PackLine[] {
  return order.items.map((i) => ({ itemId: i.id, sku: i.sku, name: i.name, nameDe: i.nameDe, size: i.size, color: i.color, need: Math.max(0, i.quantity - i.shortfall - i.restocked) }));
}

export const packNeed = (lines: PackLine[]): number => lines.reduce((sum, l) => sum + l.need, 0);
export const packPacked = (lines: PackLine[], state: PackState): number => lines.reduce((sum, l) => sum + Math.min(l.need, state[l.itemId] ?? 0), 0);
export const packIsComplete = (lines: PackLine[], state: PackState): boolean => packNeed(lines) > 0 && packPacked(lines, state) === packNeed(lines);

/** One scan. The state changes only for a piece this box still needs. */
export function packScan(lines: PackLine[], state: PackState, code: string, orderNumber: string): { state: PackState; outcome: PackOutcome } {
  const scan = classifyScan(code);
  if (scan.kind === "order") return { state, outcome: scan.number === orderNumber ? { kind: "this_order" } : { kind: "other_order", number: scan.number } };
  if (scan.kind !== "sku") return { state, outcome: { kind: "unknown", code: code.trim() } };
  const line = lines.find((l) => l.sku === scan.sku && l.need > 0);
  if (!line) return { state, outcome: { kind: "wrong", sku: scan.sku } };
  const had = state[line.itemId] ?? 0;
  if (had >= line.need) return { state, outcome: { kind: "over", line } };
  const packed = had + 1;
  const next = { ...state, [line.itemId]: packed };
  return { state: next, outcome: packIsComplete(lines, next) ? { kind: "complete", line, packed } : { kind: "counted", line, packed } };
}

export function packMinus(state: PackState, itemId: string): PackState {
  const had = state[itemId] ?? 0;
  return had <= 0 ? state : { ...state, [itemId]: had - 1 };
}

/** The next code a scanner would read: a piece still missing, or, once full, one too many of the last line. */
export function nextPackCode(lines: PackLine[], state: PackState): string | null {
  const open = lines.find((l) => l.need > (state[l.itemId] ?? 0));
  if (open) return open.sku;
  const filled = lines.filter((l) => l.need > 0);
  return filled.at(-1)?.sku ?? null;
}

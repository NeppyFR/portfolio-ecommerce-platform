import type { Bag, BagLine } from "@/store/types";
import { CART_MAX_LINES, CART_MAX_UNITS, LINE_MAX_QTY, normaliseCode } from "./pricing";

export const itemCount = (bag: Pick<Bag, "lines">): number => bag.lines.reduce((sum, l) => sum + l.quantity, 0);

const unitsOutside = (lines: BagLine[], variantId: string) => lines.reduce((sum, l) => (l.variantId === variantId ? sum : sum + l.quantity), 0);

/** The most this line may hold, given the size's availability and the bag's limits. */
export function lineCap(lines: BagLine[], variantId: string, available: number): number {
  return Math.max(0, Math.min(LINE_MAX_QTY, available, CART_MAX_UNITS - unitsOutside(lines, variantId)));
}

/** Adds one, capped. Adding never lowers a line, and a new line must fit under the line limit. */
export function addToBag(bag: Bag, variantId: string, available: number): Bag {
  const line = bag.lines.find((l) => l.variantId === variantId);
  if (!line && bag.lines.length >= CART_MAX_LINES) return bag;
  const cap = lineCap(bag.lines, variantId, available);
  const current = line?.quantity ?? 0;
  if (current >= cap) return bag;
  if (line) return { ...bag, lines: bag.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: current + 1 } : l)) };
  return { ...bag, lines: [...bag.lines, { variantId, quantity: 1 }] };
}

/** How many units an add really added, for the "max" message. */
export const addedBy = (before: Bag, after: Bag): number => itemCount(after) - itemCount(before);

export function removeBagLine(bag: Bag, variantId: string): Bag {
  return { ...bag, lines: bag.lines.filter((l) => l.variantId !== variantId) };
}

/** Clamped to the limits; 0 removes. */
export function setBagLine(bag: Bag, variantId: string, quantity: number, available: number): Bag {
  const cap = lineCap(bag.lines, variantId, available);
  const next = Math.min(Math.max(0, Math.floor(quantity)), cap);
  if (next === 0) return removeBagLine(bag, variantId);
  if (!bag.lines.some((l) => l.variantId === variantId)) {
    return bag.lines.length >= CART_MAX_LINES ? bag : { ...bag, lines: [...bag.lines, { variantId, quantity: next }] };
  }
  return { ...bag, lines: bag.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: next } : l)) };
}

/** One code at a time; stored trimmed and upper-cased. An empty code clears it. */
export function setBagCode(bag: Bag, code: string | null): Bag {
  const clean = code ? normaliseCode(code) : "";
  return { ...bag, code: clean || null };
}

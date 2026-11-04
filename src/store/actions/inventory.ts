import { useSyncExternalStore } from "react";
import { findVariant, logActivity, moveStock } from "@/store/flows";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import type { ActionResult, State } from "@/store/types";
import { adjustDelta, adjustProblem, type AdjustReason } from "@/desk/commerce/inventory/rules";
import { EMPTY_RECEIVE, receiveAdd, receiveRemove, receiveStep, receiveTotal, receiveUndo, type ReceiveAdd, type ReceiveState } from "@/desk/commerce/orders/rules/receive";

export const findBySku = (s: State, sku: string) => {
  for (const product of s.products) {
    const variant = product.variants.find((v) => v.sku === sku);
    if (variant) return { product, variant };
  }
  return null;
};

export function adjustStock(input: { variantId: string; reason: AdjustReason; amount: number | null; note: string }): ActionResult<{ sku: string; before: number; after: number }> {
  const found = findVariant(getState(), input.variantId);
  if (!found) return { ok: false, code: "not_found", message: "This size does not exist." };
  const problem = adjustProblem({ reason: input.reason, amount: input.amount, note: input.note, onHand: found.variant.stock });
  if (problem) return { ok: false, code: problem, message: problem };
  const moved = moveStock({ variantId: input.variantId, delta: adjustDelta(input.reason, input.amount as number), reason: input.reason, note: input.note.trim() });
  if (!moved.ok) return moved;
  logActivity({ area: "inventory", action: "stock.adjust", detail: `${found.variant.sku}: ${moved.data.before} to ${moved.data.after}` });
  return { ok: true, data: { sku: found.variant.sku, before: moved.data.before, after: moved.data.after } };
}

/** A null threshold means the shop default. */
export function setThreshold(variantId: string, threshold: number | null): ActionResult {
  if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0)) return { ok: false, code: "threshold", message: "Enter a threshold of 0 or more." };
  const found = findVariant(getState(), variantId);
  if (!found) return { ok: false, code: "not_found", message: "This size does not exist." };
  const at = now();
  update((s) => ({
    ...s,
    products: s.products.map((p) => (p.id === found.product.id ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, threshold, updatedAt: at } : v)) } : p)),
  }));
  logActivity({ area: "inventory", action: "stock.threshold", detail: `${found.variant.sku}: ${threshold ?? "default"}` });
  return { ok: true, data: undefined };
}

/* The pending delivery lives in memory until it is booked, so moving between screens keeps it. */

let pending: ReceiveState = EMPTY_RECEIVE;
const listeners = new Set<() => void>();
const set = (next: ReceiveState) => {
  pending = next;
  listeners.forEach((l) => l());
};
registerReset(() => set(EMPTY_RECEIVE));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const usePendingDelivery = (): ReceiveState => useSyncExternalStore(subscribe, () => pending, () => EMPTY_RECEIVE);
export const pendingDelivery = (): ReceiveState => pending;

export function scanDelivery(sku: string): ReceiveAdd | null {
  const found = findBySku(getState(), sku);
  if (!found) return null;
  const added = receiveAdd(pending, sku, found.variant.id);
  if (added.result === "added") set(added.state);
  return added;
}

export const stepDelivery = (sku: string, delta: 1 | -1) => set(receiveStep(pending, sku, delta));
export const removeFromDelivery = (sku: string) => set(receiveRemove(pending, sku));
export const undoLastScan = () => set(receiveUndo(pending));
export const discardDelivery = () => set(EMPTY_RECEIVE);

export const DELIVERY_NOTE = "Scanned delivery";

/** Books each row as its own stock move. A row that fails stays in the list. */
export function bookDelivery(): ActionResult<{ booked: number; failed: number }> {
  const before = pending;
  if (before.lines.length === 0) return { ok: false, code: "empty", message: "Nothing scanned yet." };
  let booked = 0;
  let next = before;
  let failed = 0;
  for (const line of before.lines) {
    const moved = moveStock({ variantId: line.variantId, delta: line.quantity, reason: "delivery", note: DELIVERY_NOTE });
    if (moved.ok) {
      booked += line.quantity;
      next = receiveRemove(next, line.sku);
    } else failed += 1;
  }
  set(next);
  logActivity({ area: "inventory", action: "stock.delivery", detail: `${booked} items booked from a scanned delivery` });
  return { ok: true, data: { booked, failed } };
}

export { receiveTotal };

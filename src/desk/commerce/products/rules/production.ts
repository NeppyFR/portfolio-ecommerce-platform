import { PO_PREFIX } from "@/lib/brand";
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from "@/store/types";

export const PO_STATUSES: PurchaseOrderStatus[] = ["draft", "ordered", "in_production", "shipped", "received", "cancelled"];
/** Picked by hand. `received` only comes from receiving the order. */
export const EDITABLE_PO_STATUSES: PurchaseOrderStatus[] = ["draft", "ordered", "in_production", "shipped", "cancelled"];
export const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ["ordered", "in_production", "shipped"];
export const PO_CURRENCIES = ["CHF", "EUR", "USD"];

export const isOpenPo = (status: PurchaseOrderStatus): boolean => OPEN_PO_STATUSES.includes(status);
export const isClosedPo = (status: PurchaseOrderStatus): boolean => status === "received" || status === "cancelled";

export const poNumber = (n: number): string => `${PO_PREFIX}${String(n).padStart(4, "0")}`;

/** The highest number so far, plus one. */
export function nextPoNumber(orders: Pick<PurchaseOrder, "number">[]): string {
  const highest = orders.reduce((top, o) => Math.max(top, Number(o.number.replace(PO_PREFIX, "")) || 0), 0);
  return poNumber(highest + 1);
}

export type PoTotals = { goodsMinor: number; shippingMinor: number; totalMinor: number; units: number; receivedUnits: number };

export function poTotals(lines: Pick<PurchaseOrderLine, "quantity" | "unitCostMinor" | "receivedQuantity">[], shippingMinor: number): PoTotals {
  let goodsMinor = 0;
  let units = 0;
  let receivedUnits = 0;
  for (const line of lines) {
    goodsMinor += line.quantity * line.unitCostMinor;
    units += line.quantity;
    receivedUnits += line.receivedQuantity;
  }
  return { goodsMinor, shippingMinor, totalMinor: goodsMinor + shippingMinor, units, receivedUnits };
}

/** One piece's unit cost plus an equal share of the shipping, in whole minor units. */
export function landedUnitCost(unitCostMinor: number, units: number, shippingMinor: number): number {
  return Math.round(unitCostMinor + (units > 0 ? shippingMinor / units : 0));
}

/** Average unit cost plus shipping per piece. Null without pieces. */
export function landedCostPerPiece(totals: PoTotals): number | null {
  return totals.units > 0 ? Math.round(totals.totalMinor / totals.units) : null;
}

/** Cost prices come only from a production order in CHF: a sample's price is not the run's, and there are no rates here. */
export const takesCostPrices = (order: Pick<PurchaseOrder, "kind" | "currency">): boolean => order.kind === "production" && order.currency === "CHF";

/** A received order that no ledger entry books yet. An order that cost nothing has nothing to book. */
export function awaitsBooking(order: Pick<PurchaseOrder, "status" | "financeEntryId" | "lines" | "shippingMinor">): boolean {
  return order.status === "received" && !order.financeEntryId && poTotals(order.lines, order.shippingMinor).totalMinor > 0;
}

/** What receiving books: the outstanding pieces of variants that still exist, and the SKUs of variants deleted since. */
export function toReceive(lines: PurchaseOrderLine[], variantExists: (variantId: string) => boolean): { pieces: number; skipped: string[] } {
  let pieces = 0;
  const skipped: string[] = [];
  for (const line of lines) {
    const outstanding = Math.max(0, line.quantity - line.receivedQuantity);
    if (!outstanding) continue;
    if (variantExists(line.variantId)) pieces += outstanding;
    else skipped.push(line.sku);
  }
  return { pieces, skipped };
}

/** Pieces on open orders, per variant. Inventory prints this as `+{n} incoming`. */
export function incomingByVariant(orders: PurchaseOrder[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const order of orders) {
    if (!isOpenPo(order.status)) continue;
    for (const line of order.lines) out.set(line.variantId, (out.get(line.variantId) ?? 0) + Math.max(0, line.quantity - line.receivedQuantity));
  }
  return out;
}

export type PoInputProblem = "supplier" | "dates" | "shipping";

export function poInputProblem(input: { supplierId: string; orderedOn: string | null; expectedOn: string | null; shippingMinor: number | null }): PoInputProblem | null {
  if (!input.supplierId) return "supplier";
  if (input.orderedOn && input.expectedOn && input.expectedOn < input.orderedOn) return "dates";
  if (input.shippingMinor === null || !Number.isInteger(input.shippingMinor) || input.shippingMinor < 0) return "shipping";
  return null;
}

export type PoFilter = "open" | "draft" | "received" | "cancelled" | "all";
export const PO_FILTERS: PoFilter[] = ["open", "draft", "received", "cancelled", "all"];

export function matchesPoFilter(status: PurchaseOrderStatus, filter: PoFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return isOpenPo(status);
  return status === filter;
}

/** Number, newest first. */
export const comparePoNewest = (a: Pick<PurchaseOrder, "number">, b: Pick<PurchaseOrder, "number">): number => b.number.localeCompare(a.number);

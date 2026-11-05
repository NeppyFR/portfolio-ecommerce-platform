import { compareVariants, variantStockState, type VariantStockState } from "@/lib/product-rules";
import type { ArtTone, Product, ProductStatus, PurchaseOrder, SizeCode, State, StockMoveReason } from "@/store/types";

/** Pale drawings sit on a stronger tile, dark ones on a pale one, so the small drawing stays readable. */
const TILE: Record<ArtTone, string> = { ice: "t-sky", sky: "t-ice", azure: "t-pale", dusk: "t-mist", lilac: "t-ice" };
export const tileFor = (tone: ArtTone): string => TILE[tone];

export type AdjustReason = Extract<StockMoveReason, "delivery" | "sample_back" | "damaged" | "sample_out" | "count_correction" | "manual">;
export type AdjustSign = "plus" | "minus" | "either";

export const ADJUST_REASONS: { reason: AdjustReason; sign: AdjustSign; noteRequired: boolean }[] = [
  { reason: "delivery", sign: "plus", noteRequired: false },
  { reason: "sample_back", sign: "plus", noteRequired: false },
  { reason: "damaged", sign: "minus", noteRequired: true },
  { reason: "sample_out", sign: "minus", noteRequired: false },
  { reason: "count_correction", sign: "either", noteRequired: true },
  { reason: "manual", sign: "either", noteRequired: true },
];

export const reasonRule = (reason: AdjustReason) => ADJUST_REASONS.find((r) => r.reason === reason) ?? ADJUST_REASONS[0];

/** Whole number from the amount field. A plus or minus reason ignores any sign and applies its own. */
export function adjustDelta(reason: AdjustReason, amount: number): number {
  const { sign } = reasonRule(reason);
  if (sign === "plus") return Math.abs(amount);
  if (sign === "minus") return -Math.abs(amount);
  return amount;
}

export type AdjustProblem = "amount" | "note" | "below_zero";

export function adjustProblem(input: { reason: AdjustReason; amount: number | null; note: string; onHand: number }): AdjustProblem | null {
  if (input.amount === null || !Number.isInteger(input.amount) || input.amount === 0) return "amount";
  if (reasonRule(input.reason).noteRequired && !input.note.trim()) return "note";
  return input.onHand + adjustDelta(input.reason, input.amount) < 0 ? "below_zero" : null;
}

/** Reads `3`, `+3`, `-3` and `−3`; anything else is null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace("−", "-");
  return /^[+-]?\d{1,5}$/.test(cleaned) ? Number(cleaned) : null;
}

export type InventoryRow = {
  variantId: string; productId: string; slug: string; productName: string; productNameDe: string; productStatus: ProductStatus; size: SizeCode; color: string; sku: string; isActive: boolean;
  art: Product["art"]; tone: Product["tone"];
  onHand: number; reserved: number; available: number; toShip: number; incoming: number; threshold: number | null; effectiveThreshold: number; state: VariantStockState; onSale: boolean;
};

export type StockFilter = "all" | "low" | "out";

const OPEN_PO: PurchaseOrder["status"][] = ["ordered", "in_production", "shipped"];

/** What is still owed by production orders that have not landed. */
export function incomingByVariant(purchaseOrders: PurchaseOrder[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (!OPEN_PO.includes(po.status)) continue;
    for (const line of po.lines) {
      const left = line.quantity - line.receivedQuantity;
      if (left > 0) out.set(line.variantId, (out.get(line.variantId) ?? 0) + left);
    }
  }
  return out;
}

/** Sold but not shipped: pieces of paid orders that are not out of the door yet. */
export function toShipByVariant(orders: State["orders"]): Map<string, number> {
  const out = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "paid" && order.status !== "packed") continue;
    for (const item of order.items) {
      const left = item.quantity - item.shortfall - item.restocked;
      if (left > 0) out.set(item.variantId, (out.get(item.variantId) ?? 0) + left);
    }
  }
  return out;
}

export function inventoryRows(s: Pick<State, "products" | "orders" | "purchaseOrders" | "settings">): InventoryRow[] {
  const incoming = incomingByVariant(s.purchaseOrders);
  const toShip = toShipByVariant(s.orders);
  const rows: InventoryRow[] = [];
  for (const product of s.products) {
    for (const variant of [...product.variants].sort(compareVariants)) {
      rows.push({
        variantId: variant.id, productId: product.id, slug: product.slug, productName: product.nameEn, productNameDe: product.nameDe, productStatus: product.status, size: variant.size, color: variant.color, sku: variant.sku, isActive: variant.isActive,
        art: product.art, tone: product.tone,
        onHand: variant.stock, reserved: variant.reserved, available: variant.stock - variant.reserved, toShip: toShip.get(variant.id) ?? 0, incoming: incoming.get(variant.id) ?? 0,
        threshold: variant.threshold, effectiveThreshold: variant.threshold ?? s.settings.lowStockDefault, state: variantStockState(variant, s.settings.lowStockDefault), onSale: product.status === "active" && variant.isActive,
      });
    }
  }
  return rows;
}

/** Low and out count only variants on sale, the same as the shell's status and the bell. */
export function filterRows(rows: InventoryRow[], filter: StockFilter, q: string): InventoryRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter === "low" && !(r.onSale && r.state !== "ok")) return false;
    if (filter === "out" && !(r.onSale && r.state === "out")) return false;
    if (!needle) return true;
    return [r.productName, r.productNameDe, r.color, r.sku].some((v) => v.toLowerCase().includes(needle));
  });
}

export const filterCounts = (rows: InventoryRow[]): Record<StockFilter, number> => ({
  all: rows.length,
  low: rows.filter((r) => r.onSale && r.state !== "ok").length,
  out: rows.filter((r) => r.onSale && r.state === "out").length,
});

import type { Order, OrderItem, Rappen, ReturnRecord, ReturnReason, ReturnStatus } from "@/store/types";

export const RETURN_REASONS: ReturnReason[] = ["size", "quality", "damaged", "wrong_item", "changed_mind", "other"];
export const RETURN_STATUSES: ReturnStatus[] = ["requested", "received", "refunded", "closed"];

export const isOpenReturn = (r: Pick<ReturnRecord, "status">): boolean => r.status === "requested" || r.status === "received";

export const returnPieces = (r: Pick<ReturnRecord, "items">): number => r.items.reduce((sum, i) => sum + i.quantity, 0);

export function nextReturnNo(returns: Pick<ReturnRecord, "returnNo">[]): string {
  const top = returns.reduce((max, r) => Math.max(max, Number(r.returnNo.replace(/\D/g, "")) || 0), 0);
  return `R-${String(top + 1).padStart(4, "0")}`;
}

/** What `qty` pieces of a line cost after its discount, rounded down to the Rappen. */
export function piecesPaidRappen(item: Pick<OrderItem, "quantity" | "unitPriceRappen" | "discountRappen">, qty: number): Rappen {
  if (item.quantity <= 0) return 0;
  return Math.floor((qty * (item.unitPriceRappen * item.quantity - item.discountRappen)) / item.quantity);
}

export const remainingRappen = (order: Pick<Order, "totalRappen" | "refundedRappen">): Rappen => Math.max(0, order.totalRappen - order.refundedRappen);

/** Suggested refund for a return: the pieces after discount, no shipping, capped by what is still refundable. */
export function suggestedRefund(order: Pick<Order, "items" | "totalRappen" | "refundedRappen">, ret: Pick<ReturnRecord, "items">): Rappen {
  const sum = ret.items.reduce((total, line) => {
    const item = order.items.find((i) => i.id === line.orderItemId);
    return item ? total + piecesPaidRappen(item, line.quantity) : total;
  }, 0);
  return Math.min(sum, remainingRappen(order));
}

export type RefundProblem = "invalid" | "zero" | "too_much";

export function refundAmountProblem(amount: number | null, refundable: Rappen): RefundProblem | null {
  if (amount === null || !Number.isFinite(amount)) return "invalid";
  if (amount <= 0) return "zero";
  return amount > refundable ? "too_much" : null;
}

/** Ordered, less missing at payment, less pieces in returns not closed, less pieces restocked outside returns. */
export function returnableByItem(order: Pick<Order, "items">, returns: Pick<ReturnRecord, "status" | "items">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of order.items) {
    let inReturns = 0;
    let restockedInReturns = 0;
    for (const r of returns) {
      for (const line of r.items) {
        if (line.orderItemId !== item.id) continue;
        if (r.status !== "closed") inReturns += line.quantity;
        if (r.status === "refunded") restockedInReturns += line.restockQuantity;
      }
    }
    out[item.id] = Math.max(0, item.quantity - item.shortfall - inReturns - Math.max(0, item.restocked - restockedInReturns));
  }
  return out;
}

export type ReturnBlock = "not_shipped" | "refunded" | "cancelled" | "erased" | "all_out";

/** Why this order takes no new return, or null when it does. */
export function returnBlock(order: Pick<Order, "status" | "customerErased" | "items" | "totalRappen" | "refundedRappen">, returns: Pick<ReturnRecord, "status" | "items">[]): ReturnBlock | null {
  if (order.status === "cancelled") return "cancelled";
  if (order.customerErased) return "erased";
  if (order.status === "refunded" || remainingRappen(order) === 0) return "refunded";
  if (order.status !== "shipped" && order.status !== "delivered") return "not_shipped";
  const open = Object.values(returnableByItem(order, returns)).reduce((a, b) => a + b, 0);
  return open > 0 ? null : "all_out";
}

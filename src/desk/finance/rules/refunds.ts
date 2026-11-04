import { csvAmount, toCsv } from "@/lib/csv";
import { dayKey, formatDate } from "@/lib/format";
import type { IsoTime, Order, Rappen, ReturnReason, ReturnRecord } from "@/store/types";
import { inPeriod, type PeriodKey } from "./report";

export type RefundRow = { id: string; createdAt: IsoTime; day: string; type: "return" | "order"; returnNo: string | null; orderNumber: string; reasonCode: ReturnReason | null; reasonText: string; amountRappen: Rappen };

/** A refund is a return refund if a return points at it, an order refund otherwise. Newest first. */
export function refundRows(orders: Order[], returns: ReturnRecord[]): RefundRow[] {
  const rows: RefundRow[] = [];
  for (const order of orders) {
    for (const refund of order.refunds) {
      const ret = refund.returnNo ? returns.find((r) => r.returnNo === refund.returnNo) : undefined;
      rows.push({ id: refund.id, createdAt: refund.createdAt, day: dayKey(refund.createdAt), type: refund.returnNo ? "return" : "order", returnNo: refund.returnNo, orderNumber: order.orderNumber, reasonCode: ret?.reason ?? null, reasonText: refund.reason, amountRappen: refund.amountRappen });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export const refundsIn = (rows: RefundRow[], key: PeriodKey): RefundRow[] => rows.filter((r) => inPeriod(r.day, key));

export function summariseRefunds(rows: Pick<RefundRow, "amountRappen">[]): { count: number; total: Rappen } {
  return { count: rows.length, total: rows.reduce((sum, r) => sum + r.amountRappen, 0) };
}

/** Opened in the period and still without a refund: waiting, received, or closed without one. */
export const openReturnsIn = (returns: ReturnRecord[], key: PeriodKey): ReturnRecord[] =>
  returns.filter((r) => r.status !== "refunded" && inPeriod(dayKey(r.createdAt), key)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const REASON_CSV: Record<ReturnReason, string> = { size: "Wrong size", quality: "Quality", damaged: "Arrived damaged", wrong_item: "Wrong item sent", changed_mind: "Changed their mind", other: "Other" };

/** Oldest first, no footer. The free text of an order refund goes out only with Orders access. */
export function refundsCsv(rows: RefundRow[], ordersAccess: boolean): string {
  const header = ["Date", "Type", "Return", "Order", "Reason", "Amount CHF"];
  const body = rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => [
    formatDate(r.day), r.type === "return" ? "Return refund" : "Order refund", r.returnNo ?? "", r.orderNumber,
    r.type === "return" ? (r.reasonCode ? REASON_CSV[r.reasonCode] : "") : ordersAccess ? r.reasonText : "",
    csvAmount(r.amountRappen),
  ]);
  return toCsv(header, body);
}

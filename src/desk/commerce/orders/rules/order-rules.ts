import { addDays, weekdayIndex } from "@/lib/dates";
import { dayKey } from "@/lib/format";
import { checkTracking, makeTracking } from "@/lib/tracking";
import { DEMO_TODAY } from "@/store/clock";
import { ERASED_NAME } from "@/store/seed/people";
import type { Order, OrderItem, Rappen } from "@/store/types";
import { remainingRappen } from "./returns";

/** An erased person's stored name is one fixed English placeholder. Screens print it in the viewer's language. */
/** The 1-based page a row at this 0-based position lands on. */
export const pageOf = (index: number, pageSize: number): number => Math.floor(Math.max(0, index) / pageSize) + 1;

export const shownName = (name: string, erasedLabel: string): string => (name === ERASED_NAME ? erasedLabel : name);

const COLOUR_DE: Record<string, string> = { Cobalt: "Kobalt", Cloud: "Wolke", Lilac: "Flieder", Ice: "Eis" };
/** Colours are stored in English. Lagoon and Frost are names and stay the same in German. */
export const colourLabel = (colour: string | null | undefined, lang: "en" | "de"): string => (colour ? (lang === "de" ? COLOUR_DE[colour] ?? colour : colour) : "");

export type PaymentState = "pending" | "paid" | "partially_refunded" | "refunded";
export type FulfilmentState = "unfulfilled" | "packed" | "shipped" | "delivered" | "cancelled";
export type OrderAction = "pack" | "unpack" | "ship" | "deliver" | "tracking" | "refund" | "cancel" | "resolve";

type Lifecycle = Pick<Order, "status" | "paidAt" | "packedAt" | "shippedAt" | "deliveredAt" | "totalRappen" | "refundedRappen" | "needsAttention" | "attentionResolvedAt">;

export function paymentState(o: Pick<Order, "status" | "paidAt" | "totalRappen" | "refundedRappen">): PaymentState {
  if (!o.paidAt) return "pending";
  if (o.status === "refunded" || o.refundedRappen >= o.totalRappen) return "refunded";
  return o.refundedRappen > 0 ? "partially_refunded" : "paid";
}

export function fulfilmentState(o: Pick<Order, "status" | "packedAt" | "shippedAt" | "deliveredAt">): FulfilmentState {
  if (o.status === "cancelled") return "cancelled";
  if (o.deliveredAt) return "delivered";
  if (o.shippedAt) return "shipped";
  return o.packedAt ? "packed" : "unfulfilled";
}

/** The buttons an order shows, in the order the screen prints them. */
export function orderActions(o: Lifecycle): OrderAction[] {
  const payment = paymentState(o);
  const paid = payment === "paid" || payment === "partially_refunded";
  const f = fulfilmentState(o);
  const out: OrderAction[] = [];
  if (paid && f === "unfulfilled") out.push("pack");
  if (paid && f === "packed") out.push("unpack");
  if (paid && (f === "unfulfilled" || f === "packed")) out.push("ship");
  if (o.status === "shipped") out.push("deliver", "tracking");
  if (paid && remainingRappen(o) > 0 && f !== "cancelled") out.push("refund");
  if ((f === "unfulfilled" || f === "packed") && o.status !== "refunded") out.push("cancel");
  if (o.needsAttention && !o.attentionResolvedAt) out.push("resolve");
  return out;
}

/** Pieces that physically went to the customer, or will. */
export const piecesOut = (i: Pick<OrderItem, "quantity" | "shortfall" | "restocked">): number => Math.max(0, i.quantity - i.shortfall - i.restocked);

export const orderPieces = (o: Pick<Order, "items">): number => o.items.reduce((sum, i) => sum + i.quantity, 0);

/** A tracking number that passes the check digit, stable for an order, so the Ship dialog can be one click. */
export function suggestedTracking(orderNumber: string): string {
  const n = Number(orderNumber.replace(/\D/g, "")) || 1;
  return makeTracking(10_000_000 + n * 7919);
}

export type TrackingHint = "ok" | "format" | "check_digit" | "other_carrier" | null;

/** Validates live for the demo carrier. Anything else is only a warning: it can still be saved. */
export function trackingHint(value: string, carrier: string, demoCarrier: string): TrackingHint {
  if (!value.trim()) return null;
  if (carrier.trim().toLowerCase() !== demoCarrier.toLowerCase()) return null;
  const check = checkTracking(value);
  if (check === "ok") return "ok";
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(value.trim()) && !/ZZ$/i.test(value.trim())) return "other_carrier";
  return check;
}

export const FEE_BP = 160;
export const FEE_FIXED: Rappen = 30;

/** Rounded to five Rappen, like every Swiss cash amount. */
export const paymentFee = (total: Rappen): Rappen => Math.round(((total * FEE_BP) / 10_000 + FEE_FIXED) / 5) * 5;

function nextWorkingDay(day: string): string {
  let d = addDays(day, 1);
  while (weekdayIndex(d) >= 5) d = addDays(d, 1);
  return d;
}

export type RoadToBooks = { paid: Rappen; fee: Rappen; net: Rappen; refunded: Rappen; bankDay: string; booked: boolean };

/** Customer paid, fee taken, money reaches the bank two working days later, inside a payout. Null before payment. */
export function roadToBooks(o: Pick<Order, "paidAt" | "totalRappen" | "refundedRappen">, today: string = DEMO_TODAY): RoadToBooks | null {
  if (!o.paidAt) return null;
  const fee = paymentFee(o.totalRappen);
  const bankDay = nextWorkingDay(nextWorkingDay(dayKey(o.paidAt)));
  return { paid: o.totalRappen, fee, net: o.totalRappen - fee, refunded: o.refundedRappen, bankDay, booked: bankDay <= today };
}

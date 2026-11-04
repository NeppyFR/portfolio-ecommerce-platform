import { useSyncExternalStore } from "react";
import { CARRIER, ORDER_PREFIX } from "@/lib/brand";
import { actorName, addOrderEvent, logActivity, moveStock, notify, queueEmail, renderEmail } from "@/store/flows";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import type { ActionResult, Note, Order, OrderEventType, OrderRefund, Rappen, ReturnReason, StockMoveReason } from "@/store/types";
import { orderActions, type OrderAction } from "@/desk/commerce/orders/rules/order-rules";
import { packMinus, packScan, packLines, type PackOutcome, type PackState } from "@/desk/commerce/orders/rules/pack";
import { nextReturnNo, refundAmountProblem, remainingRappen, returnBlock, returnableByItem } from "@/desk/commerce/orders/rules/returns";

let nextId = 1;
const uid = (prefix: string) => `${prefix}_b3_${nextId++}`;

export const MIN_REFUND: Rappen = 5;

const refuse = <T = void>(code: string, message: string): ActionResult<T> => ({ ok: false, code, message });

const findOrder = (orderNumber: string): Order | undefined => getState().orders.find((o) => o.orderNumber === orderNumber);

const patchOrder = (orderNumber: string, fn: (o: Order) => Order): void => {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.orderNumber === orderNumber ? fn(o) : o)) }));
};

function gate(orderNumber: string, action: OrderAction): ActionResult<Order> {
  const order = findOrder(orderNumber);
  if (!order) return refuse("not_found", `There is no order ${orderNumber}.`);
  if (!orderActions(order).includes(action)) return refuse("not_allowed", `${orderNumber} cannot do that right now.`);
  return { ok: true, data: order };
}

function record(orderNumber: string, type: OrderEventType, detail?: string, count?: number, service: "app" | "database" | "mail" = "app"): void {
  addOrderEvent(orderNumber, { type, detail, count, service });
}

function activity(action: string, detail: string): void {
  logActivity({ area: "orders", action, detail });
}

/** The two real templates only ever reach `rendered`. An erased customer gets none. */
function shippingEmail(order: Order): void {
  if (order.customerErased) return;
  const email = queueEmail({ template: "shipping_notification", orderNumber: order.orderNumber, to: order.email, locale: order.locale });
  record(order.orderNumber, "email_queued", "Shipping notification", undefined, "mail");
  renderEmail(email.id);
}

export function markPacked(orderNumber: string): ActionResult {
  const gated = gate(orderNumber, "pack");
  if (!gated.ok) return gated;
  const at = now();
  patchOrder(orderNumber, (o) => ({ ...o, status: "packed", packedAt: at }));
  record(orderNumber, "packed");
  activity("order.packed", `${orderNumber} marked packed`);
  clearPack(orderNumber);
  return { ok: true, data: undefined };
}

export function unpack(orderNumber: string): ActionResult {
  const gated = gate(orderNumber, "unpack");
  if (!gated.ok) return gated;
  patchOrder(orderNumber, (o) => ({ ...o, status: "paid", packedAt: null }));
  record(orderNumber, "unpacked");
  activity("order.unpacked", `${orderNumber} moved back to not packed`);
  return { ok: true, data: undefined };
}

export function shipOrder(orderNumber: string, tracking: string, carrier: string): ActionResult {
  const gated = gate(orderNumber, "ship");
  if (!gated.ok) return gated;
  const number = tracking.trim().toUpperCase();
  if (!number) return refuse("tracking_missing", "Enter a tracking number.");
  const at = now();
  patchOrder(orderNumber, (o) => ({ ...o, status: "shipped", packedAt: o.packedAt ?? at, shippedAt: at, trackingNumber: number, trackingCarrier: carrier.trim() || CARRIER.name }));
  record(orderNumber, "shipped", number);
  shippingEmail(gated.data);
  activity("order.shipped", `${orderNumber} shipped with ${number}`);
  return { ok: true, data: undefined };
}

export function markDelivered(orderNumber: string): ActionResult {
  const gated = gate(orderNumber, "deliver");
  if (!gated.ok) return gated;
  const at = now();
  patchOrder(orderNumber, (o) => ({ ...o, status: "delivered", deliveredAt: at }));
  record(orderNumber, "delivered");
  activity("order.delivered", `${orderNumber} marked delivered`);
  return { ok: true, data: undefined };
}

export function editTracking(orderNumber: string, tracking: string, carrier: string, queueNew: boolean): ActionResult {
  const gated = gate(orderNumber, "tracking");
  if (!gated.ok) return gated;
  const number = tracking.trim().toUpperCase();
  if (!number) return refuse("tracking_missing", "Enter a tracking number.");
  patchOrder(orderNumber, (o) => ({ ...o, trackingNumber: number, trackingCarrier: carrier.trim() || CARRIER.name }));
  record(orderNumber, "tracking_updated", number);
  if (queueNew) shippingEmail(gated.data);
  activity("order.tracking", `${orderNumber} tracking changed to ${number}`);
  return { ok: true, data: undefined };
}

/** Puts counted pieces back and writes each move. Returns how many went back. */
function putBack(orderNumber: string, restock: Record<string, number>, reason: StockMoveReason): number {
  let total = 0;
  for (const [itemId, count] of Object.entries(restock)) {
    if (count <= 0) continue;
    const item = findOrder(orderNumber)?.items.find((i) => i.id === itemId);
    if (!item) continue;
    const moved = moveStock({ variantId: item.variantId, delta: count, reason, orderNumber });
    if (!moved.ok) continue;
    total += count;
    patchOrder(orderNumber, (o) => ({ ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, restocked: i.restocked + count } : i)) }));
  }
  return total;
}

function addRefund(orderNumber: string, amount: Rappen, reason: string, returnNo: string | null): void {
  const refund: OrderRefund = { id: uid("ref"), reason, actor: actorName(), createdAt: now(), amountRappen: amount, returnNo };
  patchOrder(orderNumber, (o) => {
    const refunded = o.refundedRappen + amount;
    return { ...o, refundedRappen: refunded, refunds: [...o.refunds, refund], status: refunded >= o.totalRappen && o.status !== "cancelled" ? "refunded" : o.status };
  });
  record(orderNumber, "refund_recorded", reason || undefined, undefined, "database");
  notify({ title: `Refund recorded on ${orderNumber}`, href: "/desk/finance/refunds/", kind: "refund_paid" });
}

export function recordRefund(orderNumber: string, input: { amount: Rappen | null; reason: string; restock: Record<string, number> }): ActionResult {
  const gated = gate(orderNumber, "refund");
  if (!gated.ok) return gated;
  const max = remainingRappen(gated.data);
  if (input.amount === null || input.amount < MIN_REFUND || input.amount > max) return refuse("refund_invalid", "That amount is outside what can be refunded.");
  for (const item of gated.data.items) {
    const count = input.restock[item.id] ?? 0;
    if (count < 0 || count > item.quantity - item.shortfall - item.restocked) return refuse("restock_invalid", "That is more pieces than can go back.");
  }
  addRefund(orderNumber, input.amount, input.reason.trim(), null);
  const back = putBack(orderNumber, input.restock, "back_from_refund");
  if (back > 0) record(orderNumber, "restocked", undefined, back, "database");
  activity("order.refund", `Refund on ${orderNumber}`);
  return { ok: true, data: undefined };
}

export function cancelOrder(orderNumber: string, input: { reason: string; fullRefund: boolean }): ActionResult {
  const gated = gate(orderNumber, "cancel");
  if (!gated.ok) return gated;
  const order = gated.data;
  const at = now();
  patchOrder(orderNumber, (o) => ({ ...o, status: "cancelled", cancelledAt: at, cancelReason: input.reason.trim() || null }));
  record(orderNumber, "cancelled", input.reason.trim() || undefined);
  if (order.paidAt) {
    const restock = Object.fromEntries(order.items.map((i) => [i.id, Math.max(0, i.quantity - i.shortfall - i.restocked)]));
    const back = putBack(orderNumber, restock, "back_from_cancellation");
    if (back > 0) record(orderNumber, "restocked", undefined, back, "database");
    const left = remainingRappen(order);
    if (input.fullRefund && left > 0) addRefund(orderNumber, left, input.reason.trim(), null);
  }
  clearPack(orderNumber);
  activity("order.cancelled", `${orderNumber} cancelled`);
  return { ok: true, data: undefined };
}

export function resolveAttention(orderNumber: string, note: string): ActionResult {
  const gated = gate(orderNumber, "resolve");
  if (!gated.ok) return gated;
  const at = now();
  patchOrder(orderNumber, (o) => ({ ...o, attentionResolvedAt: at }));
  record(orderNumber, "attention_resolved", note.trim() || undefined);
  activity("order.resolved", `${orderNumber} marked resolved`);
  return { ok: true, data: undefined };
}

export function addOrderNote(orderNumber: string, body: string): ActionResult {
  const order = findOrder(orderNumber);
  if (!order) return refuse("not_found", `There is no order ${orderNumber}.`);
  if (order.customerErased) return refuse("erased", "This order takes no more notes.");
  const text = body.trim();
  if (!text) return refuse("empty", "Write something first.");
  const note: Note = { id: uid("on"), body: text.slice(0, 2000), author: actorName(), createdAt: now() };
  patchOrder(orderNumber, (o) => ({ ...o, notes: [...o.notes, note] }));
  record(orderNumber, "note_added");
  return { ok: true, data: undefined };
}

/* Returns */

export function startReturn(orderNumber: string, input: { pieces: Record<string, number>; reason: ReturnReason; note: string }): ActionResult<{ returnNo: string }> {
  const s = getState();
  const order = findOrder(orderNumber);
  if (!order) return refuse("not_found", `There is no order ${orderNumber}.`);
  const own = s.returns.filter((r) => r.orderNumber === orderNumber);
  const block = returnBlock(order, own);
  if (block) return refuse(block, "This order takes no new return.");
  const open = returnableByItem(order, own);
  const items = order.items
    .map((item) => ({ orderItemId: item.id, quantity: input.pieces[item.id] ?? 0, restockQuantity: 0 }))
    .filter((line) => line.quantity > 0);
  if (items.length === 0) return refuse("none", "Choose at least one piece.");
  if (items.some((line) => line.quantity > (open[line.orderItemId] ?? 0))) return refuse("too_many", "That is more pieces than are still out.");
  const returnNo = nextReturnNo(s.returns);
  const at = now();
  update((state) => ({
    ...state,
    returns: [{ id: uid("ret"), returnNo, orderNumber, customerName: order.customerName, label: returnNo, status: "requested", reason: input.reason, note: input.note.trim(), closeNote: "", openedBy: actorName(state), createdAt: at, closedAt: null, refundRappen: 0, items }, ...state.returns],
  }));
  record(orderNumber, "return_opened", returnNo, items.reduce((sum, l) => sum + l.quantity, 0));
  notify({ title: `Return ${returnNo} opened on ${orderNumber}`, href: "/desk/orders/returns/", kind: "return_opened" });
  logActivity({ area: "returns", action: "return.opened", detail: `${returnNo} on ${orderNumber}` });
  return { ok: true, data: { returnNo } };
}

const findReturn = (id: string) => getState().returns.find((r) => r.id === id);

const patchReturn = (id: string, fn: (r: NonNullable<ReturnType<typeof findReturn>>) => NonNullable<ReturnType<typeof findReturn>>) => {
  update((s) => ({ ...s, returns: s.returns.map((r) => (r.id === id ? fn(r) : r)) }));
};

export function receiveReturn(id: string, restock: Record<string, number>): ActionResult<{ resellable: number }> {
  const ret = findReturn(id);
  if (!ret || ret.status !== "requested") return refuse("not_allowed", "This return is not waiting for a parcel.");
  if (ret.items.some((line) => (restock[line.orderItemId] ?? 0) < 0 || (restock[line.orderItemId] ?? 0) > line.quantity)) return refuse("too_many", "That is more pieces than came back.");
  const resellable = ret.items.reduce((sum, line) => sum + (restock[line.orderItemId] ?? 0), 0);
  patchReturn(id, (r) => ({ ...r, status: "received", items: r.items.map((line) => ({ ...line, restockQuantity: restock[line.orderItemId] ?? 0 })) }));
  record(ret.orderNumber, "return_received", ret.returnNo, resellable);
  logActivity({ area: "returns", action: "return.received", detail: `${ret.returnNo}: ${resellable} resellable` });
  return { ok: true, data: { resellable } };
}

export function refundReturn(id: string, amount: Rappen | null): ActionResult {
  const ret = findReturn(id);
  if (!ret || ret.status !== "received") return refuse("not_allowed", "This return has not been received.");
  const order = findOrder(ret.orderNumber);
  if (!order) return refuse("not_found", `There is no order ${ret.orderNumber}.`);
  const problem = refundAmountProblem(amount, remainingRappen(order));
  if (problem) return refuse(problem, "That amount cannot be refunded.");
  const at = now();
  patchReturn(id, (r) => ({ ...r, status: "refunded", refundRappen: amount as number, closedAt: at }));
  addRefund(ret.orderNumber, amount as number, `Return ${ret.returnNo}`, ret.returnNo);
  const back = putBack(ret.orderNumber, Object.fromEntries(ret.items.map((line) => [line.orderItemId, line.restockQuantity])), "back_from_refund");
  record(ret.orderNumber, "return_refunded", ret.returnNo, back, "database");
  logActivity({ area: "returns", action: "return.refunded", detail: `${ret.returnNo} refunded` });
  return { ok: true, data: undefined };
}

export function closeReturn(id: string, note: string): ActionResult {
  const ret = findReturn(id);
  if (!ret || (ret.status !== "requested" && ret.status !== "received")) return refuse("not_allowed", "This return is already done.");
  const at = now();
  patchReturn(id, (r) => ({ ...r, status: "closed", closeNote: note.trim(), closedAt: at }));
  record(ret.orderNumber, "return_closed", ret.returnNo);
  logActivity({ area: "returns", action: "return.closed", detail: `${ret.returnNo} closed without refund` });
  return { ok: true, data: undefined };
}

/* Pack by scanning keeps its count in memory per order, so leaving a half-packed box does not lose it. */

let packs: Record<string, PackState> = {};
const packListeners = new Set<() => void>();
const emitPacks = () => packListeners.forEach((l) => l());
const EMPTY_PACK: PackState = {};

function clearPack(orderNumber: string): void {
  if (!(orderNumber in packs)) return;
  const { [orderNumber]: _gone, ...rest } = packs;
  packs = rest;
  emitPacks();
}

registerReset(() => {
  packs = {};
  nextId = 1;
  emitPacks();
});

const subscribePacks = (l: () => void) => {
  packListeners.add(l);
  return () => {
    packListeners.delete(l);
  };
};

export function usePackState(orderNumber: string): PackState {
  return useSyncExternalStore(subscribePacks, () => packs[orderNumber] ?? EMPTY_PACK, () => EMPTY_PACK);
}

export const packStateOf = (orderNumber: string): PackState => packs[orderNumber] ?? EMPTY_PACK;

export function scanIntoBox(orderNumber: string, code: string): PackOutcome | null {
  const order = findOrder(orderNumber);
  if (!order) return null;
  const { state, outcome } = packScan(packLines(order), packs[orderNumber] ?? EMPTY_PACK, code, orderNumber);
  if (state !== packs[orderNumber]) {
    packs = { ...packs, [orderNumber]: state };
    emitPacks();
  }
  return outcome;
}

export function onePieceLess(orderNumber: string, itemId: string): void {
  packs = { ...packs, [orderNumber]: packMinus(packs[orderNumber] ?? EMPTY_PACK, itemId) };
  emitPacks();
}

export function restartPack(orderNumber: string): void {
  clearPack(orderNumber);
}

/** Bare digits find `AL-1042` too. */
export const normaliseOrderQuery = (q: string): string => (/^\d+$/.test(q.trim()) ? `${ORDER_PREFIX}${q.trim()}` : q.trim());

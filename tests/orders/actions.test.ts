import { beforeEach, describe, expect, it } from "vitest";
import { addCustomerNote, eraseCustomer, removeCustomerNote } from "@/store/actions/customers";
import { adjustStock, bookDelivery, discardDelivery, pendingDelivery, scanDelivery, setThreshold, undoLastScan } from "@/store/actions/inventory";
import { addOrderNote, cancelOrder, closeReturn, editTracking, markDelivered, markPacked, onePieceLess, packStateOf, receiveReturn, recordRefund, refundReturn, resolveAttention, restartPack, scanIntoBox, shipOrder, startReturn, unpack } from "@/store/actions/orders";
import { customerExport, hasOpenBusiness } from "@/desk/commerce/customers/rules";
import { suggestedTracking } from "@/desk/commerce/orders/rules/order-rules";
import { packLines, packNeed } from "@/desk/commerce/orders/rules/pack";
import { getState, resetStore, update } from "@/store/core";
import { findVariant } from "@/store/flows";
import { attentionCount, toPackCount } from "@/store/selectors";
import type { Order } from "@/store/types";

const STORY = "AL-1150";
const get = (number: string): Order => getState().orders.find((o) => o.orderNumber === number) as Order;
const stockOf = (variantId: string): number => findVariant(getState(), variantId)!.variant.stock;
const ok = <T extends { ok: boolean }>(result: T): T => {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return result;
};

beforeEach(() => resetStore());

describe("order actions", () => {
  it("packs and unpacks, moving the count and writing the timeline", () => {
    const before = toPackCount(getState());
    ok(markPacked(STORY));
    expect(get(STORY).status).toBe("packed");
    expect(get(STORY).packedAt).toBeTruthy();
    expect(toPackCount(getState())).toBe(before - 1);
    expect(get(STORY).events.at(-1)?.type).toBe("packed");
    ok(unpack(STORY));
    expect(get(STORY).status).toBe("paid");
    expect(get(STORY).packedAt).toBeNull();
    expect(get(STORY).events.at(-1)?.type).toBe("unpacked");
  });

  it("refuses what the state does not allow", () => {
    expect(unpack(STORY).ok).toBe(false);
    expect(markDelivered(STORY).ok).toBe(false);
    expect(markPacked("AL-9999").ok).toBe(false);
  });

  it("ships with tracking, renders the mail and never reaches sent", () => {
    const tracking = suggestedTracking(STORY);
    const outbox = getState().outbox.length;
    expect(shipOrder(STORY, " ", "Beispielpost").ok).toBe(false);
    ok(shipOrder(STORY, tracking.toLowerCase(), ""));
    const order = get(STORY);
    expect(order.status).toBe("shipped");
    expect(order.trackingNumber).toBe(tracking);
    expect(order.trackingCarrier).toBe("Beispielpost");
    expect(order.packedAt).toBeTruthy();
    expect(getState().outbox).toHaveLength(outbox + 1);
    expect(getState().outbox[0]).toMatchObject({ template: "shipping_notification", status: "rendered", orderNumber: STORY });
    ok(editTracking(STORY, "BP123456785ZZ", "Beispielpost", true));
    expect(get(STORY).trackingNumber).toBe("BP123456785ZZ");
    expect(getState().outbox).toHaveLength(outbox + 2);
    ok(markDelivered(STORY));
    expect(get(STORY).status).toBe("delivered");
    expect(get(STORY).deliveredAt).toBeTruthy();
  });

  it("records a refund within limits, with a restock, and marks a full refund", () => {
    const order = get(STORY);
    const line = order.items[0];
    const had = stockOf(line.variantId);
    expect(recordRefund(STORY, { amount: 1, reason: "", restock: {} }).ok).toBe(false);
    expect(recordRefund(STORY, { amount: order.totalRappen + 1, reason: "", restock: {} }).ok).toBe(false);
    expect(recordRefund(STORY, { amount: 100, reason: "", restock: { [line.id]: line.quantity + 1 } }).ok).toBe(false);
    ok(recordRefund(STORY, { amount: 500, reason: "Size", restock: { [line.id]: 1 } }));
    expect(get(STORY).refundedRappen).toBe(500);
    expect(get(STORY).items[0].restocked).toBe(1);
    expect(stockOf(line.variantId)).toBe(had + 1);
    expect(getState().movements[0]).toMatchObject({ reason: "back_from_refund", delta: 1, orderNumber: STORY });
    ok(recordRefund(STORY, { amount: order.totalRappen - 500, reason: "", restock: {} }));
    expect(get(STORY).status).toBe("refunded");
  });

  it("cancels: paid stock comes back once and a full refund is optional", () => {
    const order = get(STORY);
    const had = stockOf(order.items[0].variantId);
    ok(cancelOrder(STORY, { reason: "Asked to", fullRefund: true }));
    const after = get(STORY);
    expect(after.status).toBe("cancelled");
    expect(after.cancelReason).toBe("Asked to");
    expect(after.refundedRappen).toBe(order.totalRappen);
    expect(stockOf(order.items[0].variantId)).toBe(had + order.items[0].quantity - order.items[0].shortfall);
    expect(cancelOrder(STORY, { reason: "", fullRefund: false }).ok).toBe(false);
  });

  it("resolves attention, so the count falls", () => {
    const before = attentionCount(getState());
    ok(resolveAttention("AL-1147", "Called them"));
    expect(attentionCount(getState())).toBe(before - 1);
    expect(get("AL-1147").events.at(-1)).toMatchObject({ type: "attention_resolved", detail: "Called them" });
    expect(resolveAttention("AL-1147", "").ok).toBe(false);
  });

  it("adds notes, except on an erased order", () => {
    expect(addOrderNote(STORY, "  ").ok).toBe(false);
    ok(addOrderNote(STORY, "Gift wrap"));
    expect(get(STORY).notes.at(-1)?.body).toBe("Gift wrap");
    update((s) => ({ ...s, orders: s.orders.map((o) => (o.orderNumber === STORY ? { ...o, customerErased: true } : o)) }));
    expect(addOrderNote(STORY, "More").ok).toBe(false);
  });

  it("keeps a half-packed box in memory, and drops it when packed or reset", () => {
    const order = get(STORY);
    const sku = order.items[0].sku;
    expect(scanIntoBox(STORY, sku)?.kind).toMatch(/counted|complete/);
    expect(packStateOf(STORY)[order.items[0].id]).toBe(1);
    onePieceLess(STORY, order.items[0].id);
    expect(packStateOf(STORY)[order.items[0].id]).toBe(0);
    scanIntoBox(STORY, sku);
    restartPack(STORY);
    expect(packStateOf(STORY)).toEqual({});
    scanIntoBox(STORY, sku);
    ok(markPacked(STORY));
    expect(packStateOf(STORY)).toEqual({});
    scanIntoBox("AL-1149", get("AL-1149").items[0].sku);
    resetStore();
    expect(packStateOf("AL-1149")).toEqual({});
  });

  it("gives every paid seed order something to pack, or hides the panel", () => {
    const needs = getState().orders.filter((o) => o.status === "paid").map((o) => packNeed(packLines(o)));
    expect(needs.filter((n) => n > 0).length).toBeGreaterThanOrEqual(13);
  });
});

describe("returns", () => {
  const deliveredWithoutReturn = (): Order => {
    const s = getState();
    const taken = new Set(s.returns.map((r) => r.orderNumber));
    return s.orders.find((o) => o.status === "delivered" && !taken.has(o.orderNumber) && o.refundedRappen === 0 && o.discountRappen === 0) as Order;
  };

  it("runs start, received, refunded: stock and money move only at the refund", () => {
    const order = deliveredWithoutReturn();
    const line = order.items[0];
    const had = stockOf(line.variantId);
    const wasRefunded = order.refundedRappen;
    expect(startReturn(order.orderNumber, { pieces: {}, reason: "size", note: "" }).ok).toBe(false);
    expect(startReturn(order.orderNumber, { pieces: { [line.id]: line.quantity + 1 }, reason: "size", note: "" }).ok).toBe(false);
    const started = ok(startReturn(order.orderNumber, { pieces: { [line.id]: 1 }, reason: "size", note: "Wants L" }));
    if (!started.ok) return;
    const ret = getState().returns.find((r) => r.returnNo === started.data.returnNo)!;
    expect(ret.status).toBe("requested");
    expect(ret.returnNo).toBe("R-0009");
    expect(stockOf(line.variantId)).toBe(had);
    expect(refundReturn(ret.id, 100).ok).toBe(false);
    expect(receiveReturn(ret.id, { [line.id]: 2 }).ok).toBe(false);
    ok(receiveReturn(ret.id, { [line.id]: 1 }));
    expect(stockOf(line.variantId)).toBe(had);
    expect(refundReturn(ret.id, 999_999_999).ok).toBe(false);
    ok(refundReturn(ret.id, 1000));
    const done = getState().returns.find((r) => r.id === ret.id)!;
    expect(done).toMatchObject({ status: "refunded", refundRappen: 1000 });
    expect(done.closedAt).toBeTruthy();
    expect(stockOf(line.variantId)).toBe(had + 1);
    expect(get(order.orderNumber).refundedRappen).toBe(wasRefunded + 1000);
    expect(get(order.orderNumber).refunds.at(-1)?.returnNo).toBe(ret.returnNo);
  });

  it("closes without refund and frees the pieces again", () => {
    const order = deliveredWithoutReturn();
    const line = order.items[0];
    const had = stockOf(line.variantId);
    const started = ok(startReturn(order.orderNumber, { pieces: { [line.id]: 1 }, reason: "other", note: "" }));
    if (!started.ok) return;
    const ret = getState().returns.find((r) => r.returnNo === started.data.returnNo)!;
    ok(closeReturn(ret.id, "Never arrived"));
    expect(getState().returns.find((r) => r.id === ret.id)).toMatchObject({ status: "closed", closeNote: "Never arrived" });
    expect(stockOf(line.variantId)).toBe(had);
    expect(closeReturn(ret.id, "").ok).toBe(false);
    ok(startReturn(order.orderNumber, { pieces: { [line.id]: 1 }, reason: "other", note: "" }));
  });

  it("refuses an order that takes no return", () => {
    expect(startReturn(STORY, { pieces: { [get(STORY).items[0].id]: 1 }, reason: "size", note: "" }).ok).toBe(false);
  });
});

describe("inventory actions", () => {
  const variant = () => getState().products[0].variants[0];

  it("adjusts with a reason, writes history and refuses the bad ones", () => {
    const v = variant();
    expect(adjustStock({ variantId: v.id, reason: "damaged", amount: 1, note: "" })).toMatchObject({ ok: false, code: "note" });
    expect(adjustStock({ variantId: v.id, reason: "damaged", amount: v.stock + 1, note: "x" })).toMatchObject({ ok: false, code: "below_zero" });
    expect(adjustStock({ variantId: v.id, reason: "delivery", amount: 0, note: "" })).toMatchObject({ ok: false, code: "amount" });
    const result = ok(adjustStock({ variantId: v.id, reason: "delivery", amount: 5, note: "" }));
    if (!result.ok) return;
    expect(result.data).toMatchObject({ before: v.stock, after: v.stock + 5 });
    expect(getState().movements[0]).toMatchObject({ variantId: v.id, delta: 5, reason: "delivery", before: v.stock, after: v.stock + 5 });
  });

  it("sets and clears a threshold", () => {
    const v = variant();
    expect(setThreshold(v.id, -1).ok).toBe(false);
    ok(setThreshold(v.id, 7));
    expect(variant().threshold).toBe(7);
    ok(setThreshold(v.id, null));
    expect(variant().threshold).toBeNull();
  });

  it("books a scanned delivery once and clears the list", () => {
    const v = variant();
    expect(scanDelivery("AL-NOPE-NOPE")).toBeNull();
    scanDelivery(v.sku);
    scanDelivery(v.sku);
    undoLastScan();
    scanDelivery(v.sku);
    expect(pendingDelivery().lines[0].quantity).toBe(2);
    const booked = ok(bookDelivery());
    if (booked.ok) expect(booked.data).toEqual({ booked: 2, failed: 0 });
    expect(pendingDelivery().lines).toHaveLength(0);
    expect(variant().stock).toBe(v.stock + 2);
    expect(getState().movements[0]).toMatchObject({ reason: "delivery", note: "Scanned delivery" });
    expect(bookDelivery().ok).toBe(false);
  });

  it("discards a delivery without touching stock, and reset clears it", () => {
    const v = variant();
    scanDelivery(v.sku);
    discardDelivery();
    expect(pendingDelivery().lines).toHaveLength(0);
    expect(variant().stock).toBe(v.stock);
    scanDelivery(v.sku);
    resetStore();
    expect(pendingDelivery().lines).toHaveLength(0);
  });
});

describe("customer actions", () => {
  const settled = () => {
    const s = getState();
    return s.customers.find((c) => !c.erased && s.orders.some((o) => o.customerId === c.id) && !hasOpenBusiness(c.id, s.orders, s.returns))!;
  };
  const open = () => {
    const s = getState();
    return s.customers.find((c) => !c.erased && hasOpenBusiness(c.id, s.orders, s.returns))!;
  };

  it("adds and removes notes", () => {
    const c = settled();
    expect(addCustomerNote(c.id, " ").ok).toBe(false);
    ok(addCustomerNote(c.id, "Called"));
    const note = getState().customers.find((x) => x.id === c.id)!.notes.at(-1)!;
    expect(note.body).toBe("Called");
    removeCustomerNote(c.id, note.id);
    expect(getState().customers.find((x) => x.id === c.id)!.notes.some((n) => n.id === note.id)).toBe(false);
  });

  it("exports what is stored about one person", () => {
    const c = settled();
    const data = customerExport(getState(), c.id)!;
    expect(data.customer.email).toBe(c.email);
    expect(data.orders.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toMatch(/stripe|fetch/i);
    expect(customerExport(getState(), "nobody")).toBeNull();
  });

  it("erases only with the right email, full access and nothing open", () => {
    const c = settled();
    expect(eraseCustomer(c.id, "wrong@example.com")).toMatchObject({ ok: false, code: "mismatch" });
    expect(eraseCustomer(open().id, open().email)).toMatchObject({ ok: false, code: "open" });
    update((s) => ({ ...s, profile: "warehouse" }));
    expect(eraseCustomer(c.id, c.email)).toMatchObject({ ok: false, code: "not_allowed" });
    update((s) => ({ ...s, profile: "owner" }));
    const orderIds = getState().orders.filter((o) => o.customerId === c.id).map((o) => o.orderNumber);
    const amounts = orderIds.map((n) => get(n).totalRappen);
    const result = ok(eraseCustomer(c.id, c.email.toUpperCase()));
    if (result.ok) expect(result.data.orders).toBe(orderIds.length);
    const after = getState().customers.find((x) => x.id === c.id)!;
    expect(after.erased).toBe(true);
    expect(after.email).not.toBe(c.email);
    expect(after.addresses).toEqual([]);
    expect(after.notes).toEqual([]);
    for (const number of orderIds) {
      const o = get(number);
      expect(o.customerErased).toBe(true);
      expect(o.email).not.toBe(c.email);
      expect(o.shippingAddress.line1).toBe("–");
    }
    expect(orderIds.map((n) => get(n).totalRappen)).toEqual(amounts);
    expect(getState().outbox.some((m) => m.to === c.email)).toBe(false);
    expect(eraseCustomer(c.id, after.email).ok).toBe(false);
    resetStore();
    expect(getState().customers.find((x) => x.id === c.id)!.email).toBe(c.email);
  });
});

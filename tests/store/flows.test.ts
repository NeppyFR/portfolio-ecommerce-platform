import { beforeEach, describe, expect, it } from "vitest";
import { CHECKOUT_DEFAULTS } from "@/lib/brand";
import { publicAvailable } from "@/lib/product-rules";
import { getState, registerReset, resetStore, subscribe, update } from "@/store/core";
import { addOrderEvent, emailHtml, findVariant, logActivity, moveStock, nextOrderNumber, notify, placeOrder, pushStripeEvent, queueEmail, release, renderEmail, reserve, simulateIncomingOrder } from "@/store/flows";
import { renderEmailParts } from "@/store/emails";
import type { Bag } from "@/store/types";

const VARIANT = "var_logo-mug_m";
const OTHER = "var_studio-mug_m";
const bag = (over: Partial<Bag> = {}): Bag => ({ lines: [{ variantId: VARIANT, quantity: 2 }], code: null, ...over });
const details = { ...CHECKOUT_DEFAULTS };
const stockOf = (id = VARIANT) => findVariant(getState(), id)!.variant;

beforeEach(() => resetStore());

describe("store core", () => {
  it("notifies subscribers and resets to the seed, running registered resets", () => {
    let calls = 0;
    const off = subscribe(() => {
      calls += 1;
    });
    update((s) => ({ ...s, profile: "finance" }));
    expect(calls).toBe(1);
    expect(getState().profile).toBe("finance");
    let reset = false;
    registerReset(() => {
      reset = true;
    });
    resetStore();
    expect(reset).toBe(true);
    expect(getState().profile).toBe("owner");
    off();
  });
  it("gives the same state back after a reset", () => {
    const before = JSON.stringify(getState());
    placeOrder({ details, bag: bag(), lang: "en" }, "paid");
    expect(JSON.stringify(getState())).not.toBe(before);
    resetStore();
    expect(JSON.stringify(getState())).toBe(before);
    expect(nextOrderNumber(false)).toBe("AL-1151");
  });
});

describe("numbers", () => {
  it("peeks without consuming, and starts at AL-1151", () => {
    expect(nextOrderNumber(false)).toBe("AL-1151");
    expect(nextOrderNumber(false)).toBe("AL-1151");
    expect(nextOrderNumber()).toBe("AL-1151");
    expect(nextOrderNumber(false)).toBe("AL-1152");
  });
});

describe("reserve and release", () => {
  it("holds stock and gives it back", () => {
    const before = stockOf();
    const result = reserve(bag());
    expect(result.ok).toBe(true);
    expect(stockOf().reserved).toBe(before.reserved + 2);
    expect(stockOf().stock).toBe(before.stock);
    const hold = getState().holds[0];
    expect(Date.parse(hold.expiresAt) - Date.parse(hold.createdAt)).toBe(31 * 60_000);
    if (result.ok) release(result.data.holdId);
    expect(stockOf().reserved).toBe(before.reserved);
    expect(getState().releases[0].units).toBe(2);
    if (result.ok) release(result.data.holdId);
    expect(stockOf().reserved).toBe(before.reserved);
  });
  it("refuses more than is available", () => {
    const result = reserve({ lines: [{ variantId: "var_frost-candle_one_size", quantity: 1 }], code: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("OUT_OF_STOCK");
  });
});

describe("the four outcomes, and the fifth", () => {
  it("Paid: order, stock, code, confirmation, activity", () => {
    const start = getState();
    const code = start.discounts.find((d) => d.code === "LAUNCH15")!;
    const before = stockOf();
    const result = placeOrder({ details, bag: bag({ code: "laUNCH15" }), lang: "de" }, "paid");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.state).toBe("completed");
    expect(result.data.orderNumber).toBe("AL-1151");
    const s = getState();
    const order = s.orders[0];
    expect(order.orderNumber).toBe("AL-1151");
    expect(order.status).toBe("paid");
    expect(order.locale).toBe("de");
    expect(order.discountCode).toBe("LAUNCH15");
    expect(order.discountRappen).toBe(1170);
    expect(order.shippingRappen).toBe(700);
    expect(order.totalRappen).toBe(7800 - 1170 + 700);
    expect(s.orders).toHaveLength(151);
    expect(stockOf().stock).toBe(before.stock - 2);
    expect(stockOf().reserved).toBe(before.reserved);
    expect(stockOf().ordered).toBe(before.ordered + 2);
    expect(s.holds).toHaveLength(start.holds.length);
    expect(s.releases).toHaveLength(start.releases.length);
    expect(s.movements[0].delta).toBe(-2);
    expect(s.movements[0].orderNumber).toBe("AL-1151");
    expect(s.stripeEvents[0].type).toBe("checkout.session.completed");
    expect(s.stripeEvents[0].status).toBe("processed");
    expect(s.discounts.find((d) => d.code === "LAUNCH15")!.timesUsed).toBe(code.timesUsed + 1);
    const mail = s.outbox[0];
    expect(mail.status).toBe("rendered");
    expect(mail.orderNumber).toBe("AL-1151");
    expect(s.activity[0].action).toBe("order.paid");
    expect(s.bag.lines).toHaveLength(0);
    expect(order.events.map((e) => e.type)).toEqual(["placed", "paid", "email_queued"]);
    expect(result.data.diff).toEqual({ orders: 1, stock: 2, emails: 1 });
  });
  it("Declined changes nothing: no order, no stock, no email", () => {
    const start = getState();
    const before = stockOf();
    const result = placeOrder({ details, bag: bag(), lang: "en" }, "declined");
    expect(result.ok && result.data.state).toBe("failed");
    expect(result.ok && result.data.diff).toEqual({ orders: 0, stock: 0, emails: 0 });
    const s = getState();
    expect(s.orders).toHaveLength(start.orders.length);
    expect(s.outbox).toHaveLength(start.outbox.length);
    expect(s.movements).toHaveLength(start.movements.length);
    expect(s.stripeEvents).toHaveLength(start.stripeEvents.length);
    expect(stockOf()).toEqual(before);
    expect(nextOrderNumber(false)).toBe("AL-1151");
  });
  it("Walked away: hold released, bag kept", () => {
    update((s) => ({ ...s, bag: bag() }));
    const before = stockOf();
    const result = placeOrder({ details, bag: bag(), lang: "en" }, "walked_away");
    expect(result.ok && result.data.state).toBe("cancelled");
    expect(stockOf()).toEqual(before);
    expect(getState().bag.lines).toHaveLength(1);
    expect(getState().releases[0].reason).toBe("cancelled");
  });
  it("Timed out: expiry event, hold released, bag kept", () => {
    update((s) => ({ ...s, bag: bag() }));
    const result = placeOrder({ details, bag: bag(), lang: "en" }, "timed_out");
    expect(result.ok && result.data.state).toBe("expired");
    const s = getState();
    expect(s.stripeEvents[0].type).toBe("checkout.session.expired");
    expect(s.releases[0].reason).toBe("expired");
    expect(s.bag.lines).toHaveLength(1);
  });
  it("Paid after the hold ran out: order flagged, no negative stock, no refund", () => {
    update((s) => ({
      ...s,
      products: s.products.map((p) => ({ ...p, variants: p.variants.map((v) => (v.id === OTHER ? { ...v, stock: 3 } : v)) })),
    }));
    const start = attentionNumber();
    const result = placeOrder({ details, bag: { lines: [{ variantId: OTHER, quantity: 2 }], code: null }, lang: "en" }, "paid_after_hold");
    expect(result.ok && result.data.state).toBe("completed");
    const order = getState().orders[0];
    expect(order.stockConflict).toBe(true);
    expect(order.needsAttention).toBe(true);
    expect(order.refundedRappen).toBe(0);
    expect(order.refunds).toHaveLength(0);
    expect(order.items[0].shortfall).toBe(1);
    expect(stockOf(OTHER).stock).toBe(2);
    expect(stockOf(OTHER).reserved).toBe(0);
    expect(attentionNumber()).toBe(start + 1);
    expect(getState().releases[0].reason).toBe("expired");
  });
  it("records a shortfall instead of negative stock", () => {
    update((s) => ({
      ...s,
      products: s.products.map((p) => ({ ...p, variants: p.variants.map((v) => (v.id === OTHER ? { ...v, stock: 1 } : v)) })),
    }));
    const moves = getState().movements.length;
    placeOrder({ details, bag: { lines: [{ variantId: OTHER, quantity: 1 }], code: null }, lang: "en" }, "paid_after_hold");
    expect(getState().orders[0].items[0].shortfall).toBe(1);
    expect(stockOf(OTHER).stock).toBe(1);
    expect(getState().movements).toHaveLength(moves);
  });
  it("refuses a bad code before any hold", () => {
    const holds = getState().holds.length;
    const result = placeOrder({ details, bag: bag({ code: "SUMMER20" }), lang: "en" }, "paid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DISCOUNT_INVALID");
      expect(result.message).toBe("expired");
    }
    expect(getState().holds).toHaveLength(holds);
  });
  it("finds a known customer by email and creates a new one otherwise", () => {
    const known = getState().customers[0];
    placeOrder({ details: { ...details, email: known.email.toUpperCase() }, bag: bag(), lang: "en" }, "paid");
    expect(getState().orders[0].customerId).toBe(known.id);
    expect(getState().customers).toHaveLength(41);
    placeOrder({ details: { ...details, email: "anna.muster@example.com" }, bag: bag(), lang: "en" }, "paid");
    expect(getState().customers).toHaveLength(42);
    expect(getState().orders[0].orderNumber).toBe("AL-1152");
  });
  it("The Dashboard's new order takes the next number and leaves the visitor's bag alone", () => {
    update((s) => ({ ...s, bag: bag() }));
    const peek = nextOrderNumber(false);
    const result = simulateIncomingOrder();
    expect(result.ok && result.data.orderNumber).toBe(peek);
    expect(getState().orders[0].orderNumber).toBe(peek);
    expect(getState().bag.lines).toHaveLength(1);
    expect(nextOrderNumber(false)).toBe("AL-1152");
  });
  it("keeps public availability honest while holding", () => {
    update((s) => ({ ...s, products: s.products.map((p) => ({ ...p, variants: p.variants.map((v) => (v.id === OTHER ? { ...v, stock: 3 } : v)) })) }));
    expect(publicAvailable(stockOf(OTHER))).toBe(3);
    expect(reserve({ lines: [{ variantId: OTHER, quantity: 2 }], code: null }).ok).toBe(true);
    expect(publicAvailable(stockOf(OTHER))).toBe(1);
  });
});

function attentionNumber(): number {
  return getState().orders.filter((o) => o.needsAttention && !o.attentionResolvedAt).length;
}

describe("moveStock and the small flows", () => {
  it("moves stock with a chained history and refuses to go below zero", () => {
    const before = stockOf().stock;
    const moved = moveStock({ variantId: VARIANT, delta: -1, reason: "damaged", note: "Print flawed" });
    expect(moved).toEqual({ ok: true, data: { before, after: before - 1 } });
    const row = getState().movements[0];
    expect(row).toMatchObject({ delta: -1, before, after: before - 1, reason: "damaged", note: "Print flawed", actor: "Mara Keller" });
    const refused = moveStock({ variantId: VARIANT, delta: -10000, reason: "manual" });
    expect(refused.ok).toBe(false);
    expect(moveStock({ variantId: "nope", delta: 1, reason: "manual" }).ok).toBe(false);
  });
  it("logs under the current profile's name", () => {
    update((s) => ({ ...s, profile: "warehouse" }));
    logActivity({ area: "inventory", action: "stock.adjust", detail: "Counted" });
    expect(getState().activity[0]).toMatchObject({ actor: "Lea Brunner", action: "stock.adjust" });
    update((s) => ({ ...s, profile: "superUser" }));
    logActivity({ area: "access", action: "access.set", detail: "x" });
    expect(getState().activity[0].actor).toBe("superUser");
  });
  it("adds order events, notifications and Stripe events", () => {
    addOrderEvent("AL-1150", { type: "note_added", detail: "Hello" });
    const order = getState().orders.find((o) => o.orderNumber === "AL-1150")!;
    expect(order.events[order.events.length - 1]).toMatchObject({ type: "note_added", label: "Note added", detail: "Hello" });
    notify({ title: "New", href: "/desk/" });
    expect(getState().notifications[0]).toMatchObject({ title: "New", href: "/desk/", readAt: null });
    const event = pushStripeEvent({ type: "checkout.session.completed", status: "processed", orderNumber: null, sessionId: null, detail: "" });
    expect(event.id).toMatch(/^evt_demo_\d+$/);
    expect(getState().stripeEvents[0].mode).toBe("test");
  });
});

describe("emails", () => {
  const order = () => getState().orders.find((o) => o.orderNumber === "AL-1150")!;
  it("never reaches sent: queued, then rendered is the honest end", () => {
    const email = queueEmail({ template: "order_confirmation", orderNumber: "AL-1150", to: "x@example.com", locale: "en" });
    expect(email.status).toBe("queued");
    const html = renderEmail(email.id);
    expect(html).toContain("AL-1150");
    const row = getState().outbox.find((m) => m.id === email.id)!;
    expect(row.status).toBe("rendered");
    expect(JSON.stringify(getState().outbox)).not.toMatch(/"sent"/);
    expect(renderEmail("nope")).toBe("");
  });
  it("renders in the order's language with a system serif and the test banner", () => {
    const de = renderEmailParts({ ...order(), locale: "de" }, "order_confirmation");
    expect(de.html).toContain("Testbestellung – es wurde nichts belastet");
    expect(de.html).toContain("Georgia");
    expect(de.html).not.toContain("@font-face");
    expect(de.subject).toBe("Deine Bestellung AL-1150");
    const en = renderEmailParts({ ...order(), locale: "en" }, "order_confirmation");
    expect(en.html).toContain("Test order – nothing was charged");
    const shipped = getState().orders.find((o) => o.status === "shipped")!;
    const mail = renderEmailParts({ ...shipped, locale: "en" }, "shipping_notification");
    expect(mail.html).toContain("Beispielpost");
    expect(mail.html).toContain(shipped.trackingNumber!);
    expect(mail.subject).toContain("on its way");
  });
  it("escapes customer text", () => {
    const parts = renderEmailParts({ ...order(), shippingAddress: { ...order().shippingAddress, fullName: "<b>x</b>" } }, "order_confirmation");
    expect(parts.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(parts.html).not.toContain("<b>x</b>");
  });
  it("previews without changing a status", () => {
    const queued = getState().outbox.find((m) => m.status === "queued")!;
    expect(emailHtml(queued.id)).toContain("<!doctype html>");
    expect(getState().outbox.find((m) => m.id === queued.id)!.status).toBe("queued");
  });
});

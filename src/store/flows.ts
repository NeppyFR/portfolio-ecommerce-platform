import { CHECKOUT_DEFAULTS, FIRST_NEW_ORDER, ORDER_PREFIX, PHONE, checkoutSessionId, eventId } from "@/lib/brand";
import { effectivePrice, publicAvailable } from "@/lib/product-rules";
import { priceCart, type Quote, type QuoteLine } from "@/lib/pricing";
import { DEMO_NOW_MS, DEMO_TODAY, now } from "./clock";
import { getState, registerReset, update } from "./core";
import { renderEmailParts } from "./emails";
import type { ActionResult, Bag, CheckoutDetails, CheckoutOutcome, CheckoutResultState, Customer, EmailTemplate, Lang, NodeId, Notification, Order, OrderEvent, OrderEventType, OrderItem, OutboxEmail, Product, State, StockMoveReason, StripeEvent, Variant } from "./types";
import { orderEventLabel } from "./seed/orders";

/**
 * The shared flows. Screens and actions call these and never reimplement them.
 * Each one writes to the store; none reaches outside the browser.
 */

let nextNumber = FIRST_NEW_ORDER;
let nextId = 1;
registerReset(() => {
  nextNumber = FIRST_NEW_ORDER;
  nextId = 1;
});

const uid = (prefix: string) => `${prefix}_new_${nextId++}`;

const SYSTEM = "system";

/** The name that goes in logs for whoever is using the desk right now. */
export function actorName(s: State = getState()): string {
  if (s.profile === "superUser") return "superUser";
  return s.team.find((m) => m.profile === s.profile)?.name ?? SYSTEM;
}

/** Peeks when `consume` is false, so a toast can show whichever number comes next. */
export function nextOrderNumber(consume = true): string {
  const number = `${ORDER_PREFIX}${nextNumber}`;
  if (consume) nextNumber += 1;
  return number;
}

export type Located = { product: Product; variant: Variant };

export function findVariant(s: State, variantId: string): Located | null {
  for (const product of s.products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

const patchVariant = (s: State, variantId: string, fn: (v: Variant) => Variant): State => ({
  ...s,
  products: s.products.map((p) => (p.variants.some((v) => v.id === variantId) ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? fn(v) : v)) } : p)),
});

export function bagQuoteLines(s: State, bag: Bag): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const line of bag.lines) {
    const found = findVariant(s, line.variantId);
    if (found) lines.push({ variantId: line.variantId, productId: found.product.id, collectionIds: found.product.collectionIds, unitPriceRappen: effectivePrice(found.product, found.variant), quantity: line.quantity });
  }
  return lines;
}

/** Holds stock for a checkout, for 31 minutes. Refuses when a size no longer has enough. */
export function reserve(bag: Bag): ActionResult<{ holdId: string }> {
  const s = getState();
  if (bag.lines.length === 0) return { ok: false, code: "CART_INVALID", message: "The bag is empty." };
  for (const line of bag.lines) {
    const found = findVariant(s, line.variantId);
    if (!found) return { ok: false, code: "VARIANT_UNAVAILABLE", message: "An item in your bag is no longer available." };
    if (publicAvailable(found.variant) < line.quantity) return { ok: false, code: "OUT_OF_STOCK", message: `${found.product.nameEn}: only ${publicAvailable(found.variant)} left.` };
  }
  const at = now();
  const holdId = uid("hold");
  const ref = ((nextId * 2654435761) >>> 0).toString(16).padStart(8, "0");
  const units = bag.lines.reduce((sum, l) => sum + l.quantity, 0);
  const priced = priceCart(bagQuoteLines(s, bag), bag.code, { discounts: s.discounts, settings: s.settings, today: DEMO_TODAY });
  update((state) => {
    let next = state;
    for (const line of bag.lines) next = patchVariant(next, line.variantId, (v) => ({ ...v, reserved: v.reserved + line.quantity }));
    const n = nextNumber + nextId;
    return {
      ...next,
      holds: [{
        id: holdId, ref, sessionId: checkoutSessionId(n), status: "open", createdAt: at, expiresAt: new Date(Date.parse(at) + 31 * 60_000).toISOString(), overdue: false,
        units, totalRappen: priced.ok ? priced.quote.totalRappen : 0, lines: bag.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      }, ...next.holds],
    };
  });
  return { ok: true, data: { holdId } };
}

/** A paid hold turns into a sale: the units leave `reserved` and no release is filed. */
function settleHold(holdId: string): void {
  const hold = getState().holds.find((h) => h.id === holdId);
  if (!hold) return;
  update((state) => {
    let next = state;
    for (const line of hold.lines) next = patchVariant(next, line.variantId, (v) => ({ ...v, reserved: Math.max(0, v.reserved - line.quantity) }));
    return { ...next, holds: next.holds.filter((h) => h.id !== holdId) };
  });
}

/** Gives a hold's stock back and files it under released holds. Safe to call twice. */
export function release(holdId: string, reason: "expired" | "cancelled" | "failed" = "cancelled"): void {
  const hold = getState().holds.find((h) => h.id === holdId);
  if (!hold) return;
  const at = now();
  update((state) => {
    let next = state;
    for (const line of hold.lines) next = patchVariant(next, line.variantId, (v) => ({ ...v, reserved: Math.max(0, v.reserved - line.quantity) }));
    return {
      ...next,
      holds: next.holds.filter((h) => h.id !== holdId),
      releases: [{ id: uid("rel"), ref: hold.ref, releasedAt: at, expiredAt: hold.expiresAt, reason, units: hold.units, totalRappen: hold.totalRappen }, ...next.releases],
    };
  });
}

export function pushStripeEvent(event: Omit<StripeEvent, "id" | "createdAt" | "mode" | "env"> & { createdAt?: string }): StripeEvent {
  const s = getState();
  const row: StripeEvent = { mode: "test", env: "production", ...event, id: eventId(1500 + s.stripeEvents.length), createdAt: event.createdAt ?? now() };
  update((state) => ({ ...state, stripeEvents: [row, ...state.stripeEvents] }));
  return row;
}

/** Puts a mail in the outbox. Status starts at queued and never reaches sent. */
export function queueEmail(email: { template: EmailTemplate; orderNumber: string; to: string; locale: Lang; subject?: string }): OutboxEmail {
  const order = getState().orders.find((o) => o.orderNumber === email.orderNumber);
  const subject = email.subject ?? (order ? renderEmailParts(order, email.template).subject : email.template);
  const row: OutboxEmail = { id: uid("mail_out"), template: email.template, to: email.to, subject, status: "queued", orderNumber: email.orderNumber, locale: email.locale, createdAt: now(), renderedAt: null, error: null, provider: "dev", attempts: 0 };
  update((state) => ({ ...state, outbox: [row, ...state.outbox] }));
  return row;
}

/**
 * Renders a mail for the sandboxed preview and marks it rendered, the honest end of the road.
 * Returns the HTML, or an empty string when the mail or its order is gone.
 */
export function renderEmail(emailId: string): string {
  const s = getState();
  const email = s.outbox.find((m) => m.id === emailId);
  const order = email?.orderNumber ? s.orders.find((o) => o.orderNumber === email.orderNumber) : undefined;
  if (!email || !order) return "";
  const { html } = renderEmailParts(order, email.template);
  if (email.status === "queued" || email.status === "failed") {
    const at = now();
    update((state) => ({ ...state, outbox: state.outbox.map((m) => (m.id === emailId ? { ...m, status: "rendered", renderedAt: at, error: null, attempts: m.attempts + 1 } : m)) }));
  }
  return html;
}

/** Preview only: never changes a status. */
export function emailHtml(emailId: string): string {
  const s = getState();
  const email = s.outbox.find((m) => m.id === emailId);
  const order = email?.orderNumber ? s.orders.find((o) => o.orderNumber === email.orderNumber) : undefined;
  return email && order ? renderEmailParts(order, email.template).html : "";
}

export function moveStock(move: { variantId: string; delta: number; reason: StockMoveReason; note?: string; orderNumber?: string | null; actor?: string }): ActionResult<{ before: number; after: number }> {
  const s = getState();
  const found = findVariant(s, move.variantId);
  if (!found) return { ok: false, code: "not_found", message: "This size does not exist." };
  const before = found.variant.stock;
  const after = before + move.delta;
  if (after < 0) return { ok: false, code: "negative_stock", message: "Stock cannot go below zero." };
  const at = now();
  update((state) => ({
    ...patchVariant(state, move.variantId, (v) => ({ ...v, stock: after, updatedAt: at })),
    movements: [{ id: uid("mov"), createdAt: at, variantId: move.variantId, delta: move.delta, before, after, reason: move.reason, note: move.note ?? "", actor: move.actor ?? actorName(state), productName: found.product.nameEn, size: found.variant.size, orderNumber: move.orderNumber ?? null }, ...state.movements],
  }));
  return { ok: true, data: { before, after } };
}

export function logActivity(row: { area: string; action: string; detail: string; actor?: string }): void {
  const at = now();
  update((state) => ({ ...state, activity: [{ id: uid("act"), at, actor: row.actor ?? actorName(state), area: row.area, action: row.action, detail: row.detail }, ...state.activity] }));
}

export function notify(item: { title: string; href: string; kind?: Notification["kind"] }): void {
  const at = now();
  update((state) => ({ ...state, notifications: [{ id: uid("note"), at, kind: item.kind ?? "demo", title: item.title, href: item.href, readAt: null }, ...state.notifications] }));
}

export function addOrderEvent(orderNumber: string, event: { type: OrderEventType; label?: string; actor?: string; detail?: string; count?: number; service?: NodeId }): void {
  const at = now();
  update((state) => ({
    ...state,
    orders: state.orders.map((o) => {
      if (o.orderNumber !== orderNumber) return o;
      const row: OrderEvent = { id: uid("oe"), type: event.type, label: event.label ?? orderEventLabel(event.type), createdAt: at, actor: event.actor ?? actorName(state), ...(event.detail ? { detail: event.detail } : {}), ...(event.count ? { count: event.count } : {}), ...(event.service ? { service: event.service } : {}) };
      return { ...o, events: [...o.events, row] };
    }),
  }));
}

export type CheckoutInput = { details: CheckoutDetails; bag: Bag; lang: Lang };
export type WhatHappened = { key: "hold" | "webhook" | "order_written" | "stock_moved" | "email_rendered" | "not_sent" | "hold_released" | "session_expired"; service: NodeId };
export type PlacedOrder = { state: CheckoutResultState; orderNumber: string | null; steps: WhatHappened[]; diff: { orders: number; stock: number; emails: number } };

function findOrCreateCustomer(details: CheckoutDetails, lang: Lang, at: string): { customer: Customer; created: boolean } {
  const s = getState();
  const email = details.email.trim().toLowerCase();
  const existing = s.customers.find((c) => !c.erased && c.email === email);
  if (existing) return { customer: existing, created: false };
  const fullName = details.fullName.trim();
  const customer: Customer = {
    id: uid("cus"), fullName, email, phone: PHONE, locale: lang, createdAt: at, erased: false, erasedAt: null,
    addresses: [{ id: uid("adr"), fullName, line1: details.line1, line2: details.line2, postalCode: details.postalCode, city: details.city, countryCode: "CH", phone: PHONE, isDefault: true }],
    notes: [], waitlist: [],
  };
  return { customer, created: true };
}

type WriteOrder = { input: CheckoutInput; quote: Quote; number: string; conflict: boolean; sessionId: string };

function writeOrder({ input, quote, number, conflict, sessionId }: WriteOrder): Order {
  const s = getState();
  const at = now();
  const { customer, created } = findOrCreateCustomer(input.details, input.lang, at);
  const items: OrderItem[] = quote.lines.map((line, i) => {
    const found = findVariant(s, line.variantId) as Located;
    const short = Math.max(0, line.quantity - found.variant.stock);
    const shortfall = conflict ? Math.min(line.quantity, i === 0 ? Math.max(short, 1) : short) : 0;
    return {
      id: uid(`oi_${i + 1}`), productId: found.product.id, variantId: found.variant.id, name: found.product.nameEn, nameDe: found.product.nameDe, color: found.variant.color, size: found.variant.size, sku: found.variant.sku,
      art: found.product.art, tone: found.product.tone, quantity: line.quantity, unitPriceRappen: line.unitPriceRappen, lineTotalRappen: line.lineTotalRappen, discountRappen: line.discountRappen, restocked: 0, shortfall,
    };
  });
  const flagged = conflict;
  const placed: OrderEvent = { id: uid("oe"), type: "placed", label: orderEventLabel("placed"), createdAt: at, actor: SYSTEM, service: "app" };
  const paid: OrderEvent = { id: uid("oe"), type: "paid", label: orderEventLabel("paid"), createdAt: at, actor: SYSTEM, service: "payments", detail: "checkout.session.completed" };
  const events: OrderEvent[] = [placed, paid];
  if (flagged) {
    events.push({ id: uid("oe"), type: "stock_conflict", label: orderEventLabel("stock_conflict"), createdAt: at, actor: SYSTEM, service: "database", count: items.reduce((sum, i) => sum + i.shortfall, 0) });
    events.push({ id: uid("oe"), type: "needs_attention", label: orderEventLabel("needs_attention"), createdAt: at, actor: SYSTEM, service: "database", detail: "stock conflict" });
  }
  const order: Order = {
    id: uid("ord"), orderNumber: number, placedAt: at, customerId: customer.id, customerName: customer.fullName, email: customer.email, status: "paid", locale: input.lang,
    subtotalRappen: quote.subtotalRappen, discountRappen: quote.discountRappen, discountCode: quote.code, shippingRappen: quote.shippingRappen, totalRappen: quote.totalRappen, refundedRappen: 0,
    needsAttention: flagged, attentionReasons: flagged ? ["stock_conflict"] : [], attentionResolvedAt: null, stockConflict: flagged, customerErased: false,
    shippingAddress: { fullName: input.details.fullName.trim(), line1: input.details.line1, line2: input.details.line2, postalCode: input.details.postalCode, city: input.details.city, countryCode: "CH", phone: PHONE },
    paidAt: at, paymentMethod: "card", packedAt: null, shippedAt: null, deliveredAt: null, cancelledAt: null, cancelReason: null, trackingNumber: null, trackingCarrier: null, checkoutSessionId: sessionId,
    items, events, notes: [], refunds: [],
  };
  update((state) => ({
    ...state,
    customers: created ? [...state.customers, customer] : state.customers,
    orders: [order, ...state.orders],
    products: state.products.map((p) => ({ ...p, variants: p.variants.map((v) => {
      const item = items.find((i) => i.variantId === v.id);
      return item ? { ...v, ordered: v.ordered + item.quantity } : v;
    }) })),
  }));
  for (const item of items) {
    const delta = -(item.quantity - item.shortfall);
    if (delta !== 0) moveStock({ variantId: item.variantId, delta, reason: "sold", orderNumber: number, actor: SYSTEM });
  }
  return order;
}

function redeemCode(order: Order): void {
  if (!order.discountCode) return;
  const at = order.paidAt ?? now();
  update((state) => ({
    ...state,
    discounts: state.discounts.map((d) => {
      if (d.code !== order.discountCode) return d;
      const saved = order.discountRappen + (d.type === "free_shipping" ? state.settings.shippingRappen : 0);
      return { ...d, timesUsed: d.timesUsed + 1, redeemedRappen: d.redeemedRappen + saved, lastUsedAt: at };
    }),
  }));
}

function confirmEmail(order: Order): void {
  const email = queueEmail({ template: "order_confirmation", orderNumber: order.orderNumber, to: order.email, locale: order.locale });
  addOrderEvent(order.orderNumber, { type: "email_queued", detail: "Order confirmation", actor: SYSTEM, service: "mail" });
  renderEmail(email.id);
}

const clearBag = () => update((state) => ({ ...state, bag: { lines: [], code: null } }));

const fail = (code: string, message: string): ActionResult<PlacedOrder> => ({ ok: false, code, message });

/**
 * Plays out one checkout ending.
 * Paid: hold, webhook, order, stock, code, confirmation, activity.
 * Declined and walked away: hold, release, nothing else. Timed out: hold, expiry event, release.
 * Paid after the hold ran out: release first, then an order flagged with a stock conflict. While the
 * hold was gone someone else took a piece, so the first line is short by at least one. No negative
 * stock and no refund.
 */
export function placeOrder(checkout: CheckoutInput, outcome: CheckoutOutcome): ActionResult<PlacedOrder> {
  const s = getState();
  const priced = priceCart(bagQuoteLines(s, checkout.bag), checkout.bag.code, { discounts: s.discounts, settings: s.settings, today: DEMO_TODAY });
  if (!priced.ok) return fail(priced.code, priced.code === "DISCOUNT_INVALID" ? priced.reason : "This order cannot be priced.");

  const held = reserve(checkout.bag);
  if (!held.ok) return fail(held.code, held.message);
  const { holdId } = held.data;
  const nothing = { orders: 0, stock: 0, emails: 0 };
  const session = getState().holds.find((h) => h.id === holdId)?.sessionId ?? null;

  if (outcome === "declined") {
    release(holdId, "failed");
    return { ok: true, data: { state: "failed", orderNumber: null, steps: [{ key: "hold", service: "database" }, { key: "hold_released", service: "database" }], diff: nothing } };
  }
  if (outcome === "walked_away") {
    release(holdId, "cancelled");
    return { ok: true, data: { state: "cancelled", orderNumber: null, steps: [{ key: "hold", service: "database" }, { key: "hold_released", service: "database" }], diff: nothing } };
  }
  if (outcome === "timed_out") {
    pushStripeEvent({ type: "checkout.session.expired", status: "processed", orderNumber: null, sessionId: session, detail: "Session expired, hold released" });
    release(holdId, "expired");
    return { ok: true, data: { state: "expired", orderNumber: null, steps: [{ key: "hold", service: "database" }, { key: "session_expired", service: "payments" }, { key: "hold_released", service: "database" }], diff: nothing } };
  }

  const conflict = outcome === "paid_after_hold";
  if (conflict) release(holdId, "expired");
  const number = nextOrderNumber();
  pushStripeEvent({ type: "checkout.session.completed", status: "processed", orderNumber: number, sessionId: session, detail: "Order written" });
  if (!conflict) settleHold(holdId);
  const order = writeOrder({ input: checkout, quote: priced.quote, number, conflict, sessionId: session ?? checkoutSessionId(nextNumber) });
  redeemCode(order);
  confirmEmail(order);
  logActivity({ area: "orders", action: "order.paid", detail: `Payment received for ${number}`, actor: SYSTEM });
  clearBag();
  const units = order.items.reduce((sum, i) => sum + i.quantity - i.shortfall, 0);
  return {
    ok: true,
    data: {
      state: "completed",
      orderNumber: number,
      steps: [
        { key: "hold", service: "database" }, { key: "webhook", service: "payments" }, { key: "order_written", service: "database" },
        { key: "stock_moved", service: "database" }, { key: "email_rendered", service: "mail" }, { key: "not_sent", service: "mail" },
      ],
      diff: { orders: 1, stock: units, emails: 1 },
    },
  };
}

/**
 * The Dashboard's "new order" moment: one order placed by a fixed demo customer. It goes through the same
 * flow as the shop, so it takes the next number and moves real stock. Picks the first size with stock.
 */
export function simulateIncomingOrder(): ActionResult<PlacedOrder> {
  const s = getState();
  let variantId: string | null = null;
  for (const slug of ["logo-mug", "logo-notebook-cloud", "studio-mug"]) {
    const product = s.products.find((p) => p.slug === slug && p.status === "active");
    const variant = product?.variants.find((v) => v.isActive && publicAvailable(v) > 0);
    if (variant) {
      variantId = variant.id;
      break;
    }
  }
  if (!variantId) return fail("OUT_OF_STOCK", "Nothing is in stock.");
  const keep = s.bag;
  const result = placeOrder({ details: { ...CHECKOUT_DEFAULTS }, bag: { lines: [{ variantId, quantity: 1 }], code: null }, lang: "de" }, "paid");
  update((state) => ({ ...state, bag: keep }));
  return result;
}

/** Whether a hold has run 15 minutes past its expiry. */
export const isHoldOverdue = (expiresAt: string, nowMs: number = DEMO_NOW_MS): boolean => nowMs - Date.parse(expiresAt) > 15 * 60_000;

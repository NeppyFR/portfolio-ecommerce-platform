import { CARRIER, FIRST_SEEDED_ORDER, LAST_SEEDED_ORDER, ORDER_PREFIX, TEAM, checkoutSessionId } from "@/lib/brand";
import { addDays, eachDay, weekdayIndex } from "@/lib/dates";
import { effectivePrice } from "@/lib/product-rules";
import { applyDiscount, type QuoteLine } from "@/lib/pricing";
import { makeTracking } from "@/lib/tracking";
import { DEMO_NOW_MS, DEMO_TODAY } from "../clock";
import type { Address, AttentionReason, Customer, Discount, Hold, HoldRelease, NodeId, Order, OrderEvent, OrderEventType, OrderItem, OrderRefund, OrderStatus, Product, ReturnRecord, ReturnReason, ReturnStatus, Settings, StockMove, StockMoveReason, Variant } from "../types";
import { ERASED_CUSTOMER_ID, ERASED_NAME } from "./people";
import { plusMinutes, type Rng, zurich } from "./rng";

const LEA = TEAM.find((m) => m.profile === "warehouse")?.name ?? "";
const MARA = TEAM.find((m) => m.profile === "owner")?.name ?? "";
const JONAS = TEAM.find((m) => m.profile === "finance")?.name ?? "";
const SYSTEM = "system";

const EVENT_LABEL: Record<OrderEventType, string> = {
  placed: "Order placed", paid: "Payment received", packed: "Packed", unpacked: "Unpacked", shipped: "Shipped", tracking_updated: "Tracking updated", delivered: "Delivered", cancelled: "Cancelled",
  refund_recorded: "Refund recorded", restocked: "Restocked", stock_conflict: "Stock conflict", needs_attention: "Needs attention", attention_resolved: "Attention resolved", note_added: "Note added", email_queued: "Email queued",
  return_opened: "Return opened", return_received: "Return received", return_refunded: "Return refunded", return_closed: "Return closed",
};

export const orderEventLabel = (type: OrderEventType): string => EVENT_LABEL[type];

const number = (n: number) => `${ORDER_PREFIX}${n}`;

const PENDING = new Set([1149, 1145, 1136]);
const PAID = new Set([1150, 1148, 1147, 1146, 1144, 1143, 1142, 1141, 1140, 1139, 1138, 1137, 1135, 1134]);
const PACKED = new Set([1133, 1132, 1131, 1130, 1129, 1128, 1127, 1126, 1125]);
const CANCELLED = new Set([1121, 1098, 1067, 1033]);
const REFUNDED = new Set([1112, 1086, 1071, 1049, 1018]);
const ATTENTION: Record<number, AttentionReason> = { 1147: "stock_conflict", 1139: "amount_mismatch", 1128: "code_over_limit" };
const SHIPPED_COUNT = 31;

function statusFor(n: number, shippedLeft: { n: number }): OrderStatus {
  if (PENDING.has(n)) return "pending";
  if (PAID.has(n)) return "paid";
  if (PACKED.has(n)) return "packed";
  if (CANCELLED.has(n)) return "cancelled";
  if (REFUNDED.has(n)) return "refunded";
  if (shippedLeft.n > 0) {
    shippedLeft.n -= 1;
    return "shipped";
  }
  return "delivered";
}

/** 90 days back, a rising trend, more on weekends, six on the last morning. */
function orderDays(rng: Rng, total: number): string[] {
  const first = addDays(DEMO_TODAY, -89);
  const days = eachDay(first, addDays(DEMO_TODAY, -1));
  const weights = days.map((day, i) => (0.35 + 1.5 * (i / days.length)) * (weekdayIndex(day) >= 5 ? 1.6 : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const todayCount = 6;
  const budget = total - todayCount;
  const counts = weights.map((w) => Math.floor((w / sum) * budget));
  let left = budget - counts.reduce((a, b) => a + b, 0);
  const order = weights.map((w, i) => ({ i, w: (w / sum) * budget - counts[i] + rng.next() / 1000 })).sort((a, b) => b.w - a.w);
  for (let k = 0; left > 0; k += 1, left -= 1) counts[order[k % order.length].i] += 1;
  const out: string[] = [];
  days.forEach((day, i) => {
    for (let c = 0; c < counts[i]; c += 1) out.push(day);
  });
  for (let c = 0; c < todayCount; c += 1) out.push(DEMO_TODAY);
  return out;
}

/**
 * About one order in five carries a code. FRIENDS10 is used ten times before AL-1128,
 * which is the eleventh use and so the "code over limit" order.
 */
function codeForOrder(n: number, day: string, subtotal: number, byCode: Map<string, Discount>): string | null {
  if (n % 5 !== 3) return null;
  const k = (n - 1003) / 5;
  const wanted = n === 1128 ? "FRIENDS10" : n > 1128 ? ["LAUNCH15", "FREESHIP", "WELCOME10", "LAUNCH15"][(k - 26) % 4] : ["FRIENDS10", "LAUNCH15", "FRIENDS10", "WELCOME10", day <= "2026-11-30" ? "SUMMER20" : "FREESHIP"][k % 5];
  const discount = byCode.get(wanted) as Discount;
  return subtotal >= discount.minOrderRappen ? wanted : "LAUNCH15";
}

type Sellable = { product: Product; variant: Variant };

const APPAREL_WEIGHT: Record<string, number> = { hoodie: 3, tee: 4, pants: 2, cap: 2, beanie: 1, tote: 2, other: 0 };

function sellables(products: Product[], day: string): Sellable[] {
  const out: Sellable[] = [];
  for (const product of products) {
    if (product.status === "draft") continue;
    if (product.status === "archived" && day > "2026-11-02") continue;
    if (product.publishedAt && product.publishedAt.slice(0, 10) > day) continue;
    const weight = APPAREL_WEIGHT[product.category] ?? 1;
    for (const variant of product.variants) {
      for (let k = 0; k < weight; k += 1) out.push({ product, variant });
    }
  }
  return out;
}

function assignCustomers(rng: Rng, customers: Customer[], total: number): string[] {
  const people = customers.filter((c) => !c.erased);
  const repeat = rng.shuffle(people).slice(0, 12);
  const once = people.filter((c) => !repeat.includes(c));
  const ids = [...once.map((c) => c.id), ERASED_CUSTOMER_ID];
  for (const c of repeat) ids.push(c.id, c.id);
  while (ids.length < total) ids.push(rng.pick(repeat).id);
  return rng.shuffle(ids);
}

function makeEvent(id: string, type: OrderEventType, at: string, actor: string, service: NodeId, detail?: string, count?: number): OrderEvent {
  return { id, type, label: EVENT_LABEL[type], createdAt: at, actor, service, ...(detail ? { detail } : {}), ...(count ? { count } : {}) };
}

export type OrderBuild = {
  orders: Order[];
  returns: ReturnRecord[];
  movements: StockMove[];
  holds: Hold[];
  releases: HoldRelease[];
};

const CANCEL_REASONS = ["Customer asked to cancel", "Duplicate order", "Wrong size ordered, placed again", "Customer asked to cancel"];
const REFUND_REASONS = ["Returned within 30 days", "Arrived damaged", "Wrong item sent", "Goodwill after a late parcel", "Returned within 30 days"];

export function buildOrders(rng: Rng, products: Product[], customers: Customer[], discounts: Discount[], settings: Pick<Settings, "shippingRappen" | "freeShippingThresholdRappen">): OrderBuild {
  const total = LAST_SEEDED_ORDER - FIRST_SEEDED_ORDER + 1;
  const days = orderDays(rng, total);
  const customerIds = assignCustomers(rng, customers, total);
  const shippedLeft = { n: SHIPPED_COUNT };
  const byCode = new Map(discounts.map((d) => [d.code, d]));
  const statusByNumber = new Map<number, OrderStatus>();
  for (let n = LAST_SEEDED_ORDER; n >= FIRST_SEEDED_ORDER; n -= 1) statusByNumber.set(n, statusFor(n, shippedLeft));

  const orders: Order[] = [];
  const dayTimes = new Map<string, number>();
  const placedTimes = days.map((day) => {
    const seenToday = dayTimes.get(day) ?? 0;
    dayTimes.set(day, seenToday + 1);
    const hour = day === DEMO_TODAY ? 7 + seenToday : Math.min(23, 8 + seenToday * 2 + rng.int(0, 2));
    return zurich(day, hour, rng.int(1, 58));
  }).sort();

  for (let i = 0; i < total; i += 1) {
    const n = FIRST_SEEDED_ORDER + i;
    const status = statusByNumber.get(n) as OrderStatus;
    const day = days[i];
    const customer = customers.find((c) => c.id === customerIds[i]) as Customer;

    const placedAt = placedTimes[i];

    const pool = sellables(products, day);
    const lineCount = rng.chance(0.55) ? 1 : rng.chance(0.75) ? 2 : 3;
    const chosen = new Map<string, Sellable & { quantity: number }>();
    while (chosen.size < lineCount) {
      const pick = rng.pick(pool);
      if (!chosen.has(pick.variant.id)) chosen.set(pick.variant.id, { ...pick, quantity: rng.chance(0.85) ? 1 : 2 });
    }
    if (n === 1147) {
      const zip = products.find((p) => p.slug === "lagoon-zip-hoodie") as Product;
      chosen.clear();
      chosen.set(zip.variants[2].id, { product: zip, variant: zip.variants[2], quantity: 1 });
    }
    const lines: QuoteLine[] = [...chosen.values()].map((c) => ({ variantId: c.variant.id, productId: c.product.id, collectionIds: c.product.collectionIds, unitPriceRappen: effectivePrice(c.product, c.variant), quantity: c.quantity }));

    const subtotal = lines.reduce((sum, l) => sum + l.unitPriceRappen * l.quantity, 0);
    const code = codeForOrder(n, day, subtotal, byCode);
    const quote = applyDiscount(lines, code ? (byCode.get(code) as Discount) : null, settings);

    const items: OrderItem[] = quote.lines.map((line, k) => {
      const { product, variant } = chosen.get(line.variantId) as Sellable;
      return {
        id: `oi_${n}_${k + 1}`, productId: product.id, variantId: variant.id, name: product.nameEn, nameDe: product.nameDe, color: variant.color, size: variant.size, sku: variant.sku,
        garment: product.garment, tone: product.tone, quantity: line.quantity, unitPriceRappen: line.unitPriceRappen, lineTotalRappen: line.lineTotalRappen, discountRappen: line.discountRappen, restocked: 0, shortfall: 0,
      };
    });

    const erased = customer.erased;
    const address: Address = erased
      ? { fullName: ERASED_NAME, line1: "–", postalCode: "0000", city: "–", countryCode: "CH" }
      : { fullName: customer.fullName, line1: customer.addresses[0].line1, postalCode: customer.addresses[0].postalCode, city: customer.addresses[0].city, countryCode: "CH", phone: customer.phone };

    const paid = status !== "pending" && !(status === "cancelled" && (n === 1098 || n === 1033));
    const paidAt = paid ? plusMinutes(placedAt, rng.int(1, 4)) : null;
    const clock = (minutes: number) => {
      const at = plusMinutes(placedAt, minutes);
      return Date.parse(at) >= DEMO_NOW_MS ? plusMinutes(new Date(DEMO_NOW_MS).toISOString(), -rng.int(5, 90)) : at;
    };
    const reachedPacked = status === "packed" || status === "shipped" || status === "delivered" || status === "refunded";
    const reachedShipped = status === "shipped" || status === "delivered" || status === "refunded";
    const reachedDelivered = status === "delivered" || status === "refunded";

    const age = (DEMO_NOW_MS - Date.parse(placedAt)) / 60_000;
    const packedAt = reachedPacked ? clock(Math.min(rng.int(600, 1500), Math.max(30, age * 0.25))) : null;
    const shippedAt = reachedShipped ? clock(Math.min(rng.int(1500, 2900), Math.max(60, age * 0.5))) : null;
    const deliveredAt = reachedDelivered ? clock(Math.min(rng.int(4000, 6500), Math.max(120, age * 0.8))) : null;
    const cancelledAt = status === "cancelled" ? clock(rng.int(60, 600)) : null;

    const events: OrderEvent[] = [];
    const ev = (type: OrderEventType, at: string, actor: string, service: NodeId, detail?: string, count?: number) => events.push(makeEvent(`oe_${n}_${events.length + 1}`, type, at, actor, service, detail, count));
    ev("placed", placedAt, SYSTEM, "app");
    if (paidAt) {
      ev("paid", paidAt, SYSTEM, "payments", "checkout.session.completed");
      ev("email_queued", plusMinutes(paidAt, 1), SYSTEM, "mail", "Order confirmation");
    }
    const attention = ATTENTION[n];
    if (attention && paidAt) {
      if (attention === "stock_conflict") ev("stock_conflict", paidAt, SYSTEM, "database", undefined, 1);
      ev("needs_attention", paidAt, SYSTEM, "database", attention.replaceAll("_", " "));
      if (attention === "stock_conflict") items[0].shortfall = 1;
    }
    if (packedAt) ev("packed", packedAt, LEA, "app");
    const tracking = reachedShipped ? makeTracking(10_000_000 + n * 7919) : null;
    if (shippedAt) {
      ev("shipped", shippedAt, LEA, "app", tracking ?? undefined);
      ev("email_queued", plusMinutes(shippedAt, 1), SYSTEM, "mail", "Shipping notification");
    }
    if (deliveredAt) ev("delivered", deliveredAt, LEA, "app");
    if (cancelledAt) ev("cancelled", cancelledAt, MARA, "app", CANCEL_REASONS[orders.filter((o) => o.status === "cancelled").length]);

    const order: Order = {
      id: `ord_${n}`, orderNumber: number(n), placedAt, customerId: customer.id, customerName: erased ? ERASED_NAME : customer.fullName, email: customer.email, status, locale: customer.locale,
      subtotalRappen: quote.subtotalRappen, discountRappen: quote.discountRappen, discountCode: code, shippingRappen: quote.shippingRappen, totalRappen: quote.totalRappen, refundedRappen: 0,
      needsAttention: Boolean(attention), attentionReasons: attention ? [attention] : [], attentionResolvedAt: null, stockConflict: attention === "stock_conflict", customerErased: erased,
      shippingAddress: address, paidAt, paymentMethod: paidAt ? (rng.chance(0.62) ? "card" : "twint") : null, packedAt, shippedAt, deliveredAt, cancelledAt, cancelReason: status === "cancelled" ? CANCEL_REASONS[orders.filter((o) => o.status === "cancelled").length] : null,
      trackingNumber: tracking, trackingCarrier: tracking ? CARRIER.name : null, checkoutSessionId: paidAt ? checkoutSessionId(n) : null,
      items, events, notes: [], refunds: [],
    };
    orders.push(order);
  }

  const seeded = orders.find((o) => o.orderNumber === number(1147));
  if (seeded) seeded.notes.push({ id: "on_1", body: "Size M sold out while this one was paying. Asked the customer about L.", author: LEA, createdAt: plusMinutes(seeded.placedAt, 40) });
  const late = orders.find((o) => o.orderNumber === number(1042));
  if (late) late.notes.push({ id: "on_2", body: "Asked for the parcel to be left with a neighbour.", author: LEA, createdAt: plusMinutes(late.placedAt, 120) });

  const { returns } = addRefundsAndReturns(rng, orders);

  for (const d of discounts) {
    const used = orders.filter((o) => o.discountCode === d.code && o.paidAt);
    d.timesUsed = used.length;
    d.redeemedRappen = used.reduce((sum, o) => sum + o.discountRappen + (d.type === "free_shipping" ? settings.shippingRappen : 0), 0);
    d.lastUsedAt = used.length ? (used[used.length - 1].paidAt as string) : null;
  }

  const holds = buildHolds(products);
  const movements = buildMovements(rng, products, orders);
  applyOrderedCounts(products, orders);
  const releases = buildReleases(rng);
  return { orders: [...orders].reverse(), returns, movements, holds, releases };
}

function find(orders: Order[], n: number): Order {
  return orders.find((o) => o.orderNumber === number(n)) as Order;
}

/** Five refunded orders and four partial refunds make nine refunds of both types; eight returns cover all statuses. */
function addRefundsAndReturns(rng: Rng, orders: Order[]): { returns: ReturnRecord[] } {
  const delivered = orders.filter((o) => o.status === "delivered" && !o.customerErased);
  const partialReturnA = delivered[Math.floor(delivered.length * 0.3)];
  const partialReturnB = delivered[Math.floor(delivered.length * 0.55)];
  const partialOrderA = delivered[Math.floor(delivered.length * 0.42)];
  const partialOrderB = delivered[Math.floor(delivered.length * 0.8)];
  const requestedA = delivered[delivered.length - 1];
  const requestedB = delivered[delivered.length - 2];
  const receivedA = delivered[delivered.length - 3];
  const closedA = delivered[delivered.length - 4];

  const addRefund = (order: Order, amount: number, reason: string, actor: string, at: string, returnNo: string | null) => {
    const refund: OrderRefund = { id: `ref_${order.orderNumber}_${order.refunds.length + 1}`, reason, actor, createdAt: at, amountRappen: amount, returnNo };
    order.refunds.push(refund);
    order.refundedRappen += amount;
    order.events.push(makeEvent(`oe_${order.orderNumber}_r${order.refunds.length}`, "refund_recorded", at, actor, "database", reason));
  };

  const refunded = [...REFUNDED].map((n) => find(orders, n));
  refunded.forEach((order, i) => {
    const at = plusMinutes(order.deliveredAt ?? order.placedAt, rng.int(600, 2400));
    if (i < 3) addRefund(order, order.totalRappen, REFUND_REASONS[i], JONAS, at, null);
  });
  addRefund(partialOrderA, partialOrderA.items[0].unitPriceRappen - partialOrderA.items[0].discountRappen, REFUND_REASONS[3], JONAS, plusMinutes(partialOrderA.deliveredAt as string, 2000), null);
  addRefund(partialOrderB, 1500, "Goodwill for a faded print", MARA, plusMinutes(partialOrderB.deliveredAt as string, 1800), null);

  const plans: { no: number; order: Order; status: ReturnStatus; reason: ReturnReason; note: string; full: boolean }[] = [
    { no: 1, order: refunded[3], status: "refunded", reason: "size", note: "Wants a size larger next time.", full: true },
    { no: 2, order: refunded[4], status: "refunded", reason: "quality", note: "Seam opened after one wash.", full: true },
    { no: 3, order: partialReturnA, status: "refunded", reason: "changed_mind", note: "", full: false },
    { no: 4, order: partialReturnB, status: "refunded", reason: "damaged", note: "Parcel crushed in transit.", full: false },
    { no: 5, order: closedA, status: "closed", reason: "wrong_item", note: "Parcel never arrived back.", full: false },
    { no: 6, order: receivedA, status: "received", reason: "size", note: "Wants size L instead.", full: false },
    { no: 7, order: requestedA, status: "requested", reason: "size", note: "", full: false },
    { no: 8, order: requestedB, status: "requested", reason: "changed_mind", note: "", full: false },
  ];

  const returns: ReturnRecord[] = plans.map((plan) => {
    const { order } = plan;
    const returnNo = `R-${String(plan.no).padStart(4, "0")}`;
    const opened = plusMinutes(order.deliveredAt ?? order.placedAt, 200 + plan.no * 37);
    const items = plan.full ? order.items : [order.items[0]];
    const refundRappen = plan.status === "refunded" ? (plan.full ? order.totalRappen : order.items[0].unitPriceRappen - Math.floor(order.items[0].discountRappen / order.items[0].quantity)) : 0;
    const closedAt = plan.status === "refunded" || plan.status === "closed" ? plusMinutes(opened, 3000) : null;
    order.events.push(makeEvent(`oe_${order.orderNumber}_ret${plan.no}`, "return_opened", opened, LEA, "app", returnNo));
    if (plan.status !== "requested" && plan.status !== "closed") order.events.push(makeEvent(`oe_${order.orderNumber}_rcv${plan.no}`, "return_received", plusMinutes(opened, 1500), LEA, "app", returnNo));
    if (plan.status === "refunded") {
      addRefund(order, refundRappen, `Return ${returnNo}`, JONAS, closedAt as string, returnNo);
      for (const item of items) item.restocked = plan.reason === "damaged" || plan.reason === "quality" ? 0 : plan.full ? item.quantity : 1;
      order.events.push(makeEvent(`oe_${order.orderNumber}_rfd${plan.no}`, "return_refunded", closedAt as string, JONAS, "database", returnNo));
    }
    if (plan.status === "closed") order.events.push(makeEvent(`oe_${order.orderNumber}_cls${plan.no}`, "return_closed", closedAt as string, LEA, "app", returnNo));
    return {
      id: `ret_${plan.no}`, returnNo, orderNumber: order.orderNumber, customerName: order.customerName, label: returnNo, status: plan.status, reason: plan.reason, note: plan.note,
      closeNote: plan.status === "closed" ? plan.note : "", openedBy: LEA, createdAt: opened, closedAt, refundRappen,
      items: items.map((item) => ({ orderItemId: item.id, quantity: plan.full ? item.quantity : 1, restockQuantity: plan.status === "refunded" ? item.restocked : plan.status === "received" ? 1 : 0 })),
    };
  });
  for (const order of orders) order.events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { returns };
}

function buildHolds(products: Product[]): Hold[] {
  const variant = (slug: string, index: number) => (products.find((p) => p.slug === slug) as Product).variants[index];
  const make = (id: number, ref: string, created: string, status: Hold["status"], overdue: boolean, lines: { variant: Variant; product: string; quantity: number; price: number }[]): Hold => {
    for (const line of lines) line.variant.reserved += line.quantity;
    return {
      id: `hold_${id}`, ref, sessionId: checkoutSessionId(2000 + id), status, createdAt: created, expiresAt: plusMinutes(created, 31), overdue,
      units: lines.reduce((sum, l) => sum + l.quantity, 0), totalRappen: lines.reduce((sum, l) => sum + l.quantity * l.price, 0) + 700,
      lines: lines.map((l) => ({ variantId: l.variant.id, quantity: l.quantity })),
    };
  };
  return [
    make(1, "4f1c9a27", zurich(DEMO_TODAY, 13, 44), "open", false, [{ variant: variant("essential-hoodie-cobalt", 2), product: "essential-hoodie-cobalt", quantity: 1, price: 8900 }]),
    make(2, "a83e05d1", zurich(DEMO_TODAY, 13, 57), "processing", false, [{ variant: variant("logo-tee-cloud", 2), product: "logo-tee-cloud", quantity: 2, price: 3900 }, { variant: variant("canvas-tote-cloud", 0), product: "canvas-tote-cloud", quantity: 1, price: 2900 }]),
    make(3, "c27b6e90", zurich(DEMO_TODAY, 13, 5), "open", true, [{ variant: variant("track-pants-cobalt", 2), product: "track-pants-cobalt", quantity: 1, price: 9900 }]),
  ];
}

function buildReleases(rng: Rng): HoldRelease[] {
  const reasons: HoldRelease["reason"][] = ["expired", "cancelled", "expired", "failed", "expired", "cancelled"];
  return reasons.map((reason, i) => {
    const expiredAt = zurich(addDays(DEMO_TODAY, -i), 11 - (i % 3), 10 + i * 7);
    return { id: `rel_${i + 1}`, ref: rng.hex(8), releasedAt: plusMinutes(expiredAt, reason === "expired" ? 5 : -12), expiredAt, reason, units: rng.int(1, 3), totalRappen: rng.int(3, 15) * 1000 + 700 };
  });
}

function applyOrderedCounts(products: Product[], orders: Order[]) {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (!order.paidAt) continue;
    for (const item of order.items) counts.set(item.variantId, (counts.get(item.variantId) ?? 0) + item.quantity);
  }
  for (const product of products) {
    for (const variant of product.variants) variant.ordered = counts.get(variant.id) ?? 0;
  }
}

type RawMove = { at: string; variantId: string; delta: number; reason: StockMoveReason; note: string; actor: string; orderNumber: string | null };

/**
 * Exactly 400 moves whose chain per size ends on today's hand-set stock. The chain is walked back
 * from the end, and one opening "initial" move per size makes the first balance start at zero.
 */
function buildMovements(rng: Rng, products: Product[], orders: Order[]): StockMove[] {
  const TARGET = 400;
  const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
  const moves: RawMove[] = [];
  for (const order of orders) {
    if (!order.paidAt) continue;
    for (const item of order.items) {
      const shipped = item.quantity - item.shortfall;
      if (shipped > 0) moves.push({ at: order.paidAt, variantId: item.variantId, delta: -shipped, reason: "sold", note: "", actor: SYSTEM, orderNumber: order.orderNumber });
      if (order.status === "cancelled" && shipped > 0) moves.push({ at: order.cancelledAt as string, variantId: item.variantId, delta: shipped, reason: "back_from_cancellation", note: "", actor: MARA, orderNumber: order.orderNumber });
      if (item.restocked > 0) moves.push({ at: order.refunds[order.refunds.length - 1]?.createdAt ?? order.placedAt, variantId: item.variantId, delta: item.restocked, reason: "back_from_refund", note: "", actor: JONAS, orderNumber: order.orderNumber });
    }
  }
  const adjust = TARGET - moves.length - variantIds.length;
  const reasons: { reason: StockMoveReason; sign: number; note: string }[] = [
    { reason: "count_correction", sign: 1, note: "Found on the wrong shelf" },
    { reason: "sample_out", sign: -1, note: "Sent to a stylist" },
    { reason: "sample_back", sign: 1, note: "Back from the shoot" },
    { reason: "damaged", sign: -1, note: "Print flawed" },
    { reason: "delivery", sign: 1, note: "Top-up from the manufacturer" },
    { reason: "manual", sign: -1, note: "Taken for the showroom" },
  ];
  const actors = [LEA, LEA, MARA];
  for (let i = 0; i < adjust; i += 1) {
    const plan = reasons[i % reasons.length];
    const day = addDays(DEMO_TODAY, -rng.int(1, 85));
    moves.push({ at: zurich(day, rng.int(8, 17), rng.int(0, 59)), variantId: rng.pick(variantIds), delta: plan.sign, reason: plan.reason, note: plan.note, actor: rng.pick(actors), orderNumber: null });
  }
  if (moves.length + variantIds.length !== TARGET) throw new Error(`Seed: ${moves.length + variantIds.length} stock moves, wanted ${TARGET}`);

  const out: StockMove[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const chain = moves.filter((m) => m.variantId === variant.id).sort((a, b) => a.at.localeCompare(b.at));
      let lowest = 0;
      let running = 0;
      for (const move of chain) {
        running += move.delta;
        lowest = Math.min(lowest, running);
      }
      const opening = variant.stock - running;
      const initial = Math.max(opening, 0 - lowest);
      let balance = initial;
      const first = chain.length ? chain[0].at : zurich("2026-09-01", 10);
      const openedAt = plusMinutes(first < zurich("2026-10-01", 10) ? first : zurich("2026-10-01", 10), -60);
      const rows: StockMove[] = [{ id: "", createdAt: openedAt, variantId: variant.id, delta: initial, before: 0, after: initial, reason: "initial", note: "", actor: LEA, productName: product.nameEn, size: variant.size, orderNumber: null }];
      for (const move of chain) {
        const before = balance;
        balance += move.delta;
        rows.push({ id: "", createdAt: move.at, variantId: variant.id, delta: move.delta, before, after: balance, reason: move.reason, note: move.note, actor: move.actor, productName: product.nameEn, size: variant.size, orderNumber: move.orderNumber });
      }
      variant.stock = balance;
      out.push(...rows);
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((m, i) => ({ ...m, id: `mov_${out.length - i}` }));
}

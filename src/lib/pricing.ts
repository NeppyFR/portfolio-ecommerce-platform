/**
 * The one pricing authority. All money is integer Rappen.
 * total = subtotal − discount + shipping.
 */
import type { Discount, DiscountRejection, Rappen } from "@/store/types";
import { discountRejection } from "./discount-rules";

export const LINE_MAX_QTY = 10;
export const CART_MAX_UNITS = 30;
export const CART_MAX_LINES = 20;
export const CODE_MAX_LENGTH = 32;
export const MIN_TOTAL_RAPPEN = 50;

export type QuoteLine = { variantId: string; productId: string; collectionIds: string[]; unitPriceRappen: Rappen; quantity: number };
export type QuotedLine = QuoteLine & { lineTotalRappen: Rappen; discountRappen: Rappen };
export type ShippingRule = "standard" | "free_threshold" | "free_code";
export type ShippingSettings = { shippingRappen: Rappen; freeShippingThresholdRappen: Rappen };
export type Quote = {
  lines: QuotedLine[]; subtotalRappen: Rappen; discountRappen: Rappen; shippingRappen: Rappen; totalRappen: Rappen;
  shippingRule: ShippingRule; code: string | null; codeRejection: DiscountRejection | null;
};

export const normaliseCode = (code: string): string => code.trim().toUpperCase().slice(0, CODE_MAX_LENGTH);

/** Rounded up to 5 Rappen in the customer's favour, capped at the base. */
export function percentDiscount(base: Rappen, percent: number): Rappen {
  return Math.min(base, Math.ceil((base * percent) / 500) * 5);
}

/**
 * Spreads a discount over the eligible lines in proportion (floored).
 * The remainder lands on the largest line; ties go to the lowest id.
 */
export function allocate(lines: { id: string; amount: Rappen }[], discount: Rappen): Map<string, Rappen> {
  const out = new Map<string, Rappen>();
  const base = lines.reduce((sum, l) => sum + l.amount, 0);
  if (base <= 0 || discount <= 0) {
    for (const l of lines) out.set(l.id, 0);
    return out;
  }
  let given = 0;
  for (const l of lines) {
    const share = Math.floor((discount * l.amount) / base);
    out.set(l.id, share);
    given += share;
  }
  const largest = [...lines].sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  out.set(largest.id, (out.get(largest.id) ?? 0) + discount - given);
  return out;
}

export function isEligible(line: QuoteLine, discount: Discount): boolean {
  if (discount.scope === "all") return true;
  if (discount.scope === "products") return discount.productIds.includes(line.productId);
  return line.collectionIds.some((id) => discount.collectionIds.includes(id));
}

export function shippingFor(afterDiscount: Rappen, freeCode: boolean, settings: ShippingSettings): { rappen: Rappen; rule: ShippingRule } {
  if (freeCode) return { rappen: 0, rule: "free_code" };
  if (afterDiscount >= settings.freeShippingThresholdRappen) return { rappen: 0, rule: "free_threshold" };
  return { rappen: settings.shippingRappen, rule: "standard" };
}

/** Applies a discount that has already passed its checks. Also prices seeded history. */
export function applyDiscount(lines: QuoteLine[], discount: Discount | null, settings: ShippingSettings): Omit<Quote, "codeRejection"> {
  const priced = lines.map((l) => ({ ...l, lineTotalRappen: l.unitPriceRappen * l.quantity }));
  const subtotal = priced.reduce((sum, l) => sum + l.lineTotalRappen, 0);
  const eligible = discount ? priced.filter((l) => isEligible(l, discount)) : [];
  const base = eligible.reduce((sum, l) => sum + l.lineTotalRappen, 0);
  let amount = 0;
  if (discount?.type === "percent") amount = percentDiscount(base, discount.value);
  if (discount?.type === "fixed") amount = Math.min(discount.value, base);
  const shares = allocate(eligible.map((l) => ({ id: l.variantId, amount: l.lineTotalRappen })), amount);
  const shipping = shippingFor(subtotal - amount, discount?.type === "free_shipping", settings);
  return {
    lines: priced.map((l) => ({ ...l, discountRappen: shares.get(l.variantId) ?? 0 })),
    subtotalRappen: subtotal,
    discountRappen: amount,
    shippingRappen: shipping.rappen,
    totalRappen: subtotal - amount + shipping.rappen,
    shippingRule: shipping.rule,
    code: discount?.code ?? null,
  };
}

export type QuoteContext = { discounts: Discount[]; settings: ShippingSettings; today: string; openHoldsByCode?: Record<string, number> };

/** Lenient, for the bag: a bad code is reported and the cart is priced without it. */
export function quoteCart(lines: QuoteLine[], code: string | null, ctx: QuoteContext): Quote {
  const typed = code ? normaliseCode(code) : "";
  if (!typed) return { ...applyDiscount(lines, null, ctx.settings), codeRejection: null };
  const discount = ctx.discounts.find((d) => d.code === typed) ?? null;
  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceRappen * l.quantity, 0);
  const rejection = discountRejection(discount, {
    subtotalRappen: subtotal,
    lines,
    today: ctx.today,
    openHolds: ctx.openHoldsByCode?.[typed] ?? 0,
  });
  if (rejection || !discount) return { ...applyDiscount(lines, null, ctx.settings), codeRejection: rejection ?? "not_found" };
  return { ...applyDiscount(lines, discount, ctx.settings), codeRejection: null };
}

export type StrictPrice =
  | { ok: true; quote: Quote }
  | { ok: false; code: "DISCOUNT_INVALID"; reason: DiscountRejection }
  | { ok: false; code: "TOTAL_TOO_LOW" | "CART_INVALID" };

/** Strict, for the checkout: a bad code refuses, and so does a total below 50 Rappen. */
export function priceCart(lines: QuoteLine[], code: string | null, ctx: QuoteContext): StrictPrice {
  const units = lines.reduce((sum, l) => sum + l.quantity, 0);
  const badLine = lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > LINE_MAX_QTY);
  if (lines.length === 0 || lines.length > CART_MAX_LINES || units > CART_MAX_UNITS || badLine) return { ok: false, code: "CART_INVALID" };
  const quote = quoteCart(lines, code, ctx);
  if (quote.codeRejection) return { ok: false, code: "DISCOUNT_INVALID", reason: quote.codeRejection };
  if (quote.totalRappen < MIN_TOTAL_RAPPEN) return { ok: false, code: "TOTAL_TOO_LOW" };
  return { ok: true, quote };
}

import type { Discount, DiscountRejection, DiscountState, Rappen } from "@/store/types";

export const MAX_PERCENT = 90;
export const MAX_FIXED_RAPPEN = 1_000_000;
const ADMIN_CODE = /^[A-Z0-9-]{3,30}$/;

/** First match wins: disabled, scheduled, expired, used up, active. `endDay` is inclusive. */
export function discountState(d: Pick<Discount, "isEnabled" | "startDay" | "endDay" | "timesUsed" | "usageLimit">, today: string): DiscountState {
  if (!d.isEnabled) return "disabled";
  if (d.startDay && d.startDay > today) return "scheduled";
  if (d.endDay && d.endDay < today) return "expired";
  if (d.usageLimit !== null && d.timesUsed >= d.usageLimit) return "used_up";
  return "active";
}

type RejectionInput = {
  subtotalRappen: Rappen;
  lines: { productId: string; collectionIds: string[] }[];
  today: string;
  openHolds?: number;
};

/** Check order, first failure wins. The minimum is on the pre-discount subtotal of the whole cart. */
export function discountRejection(d: Discount | null | undefined, input: RejectionInput): DiscountRejection | null {
  if (!d) return "not_found";
  if (!d.isEnabled) return "disabled";
  if (d.startDay && d.startDay > input.today) return "scheduled";
  if (d.endDay && d.endDay < input.today) return "expired";
  if (d.usageLimit !== null && d.timesUsed + (input.openHolds ?? 0) >= d.usageLimit) return "used_up";
  if (input.subtotalRappen < d.minOrderRappen) return "min_order";
  if (d.scope === "products" && !input.lines.some((l) => d.productIds.includes(l.productId))) return "not_applicable";
  if (d.scope === "collections" && !input.lines.some((l) => l.collectionIds.some((c) => d.collectionIds.includes(c)))) return "not_applicable";
  return null;
}

export const DISCOUNT_MESSAGES: Record<DiscountRejection | "other", { en: string; de: string }> = {
  not_found: { en: "This discount code doesn't exist.", de: "Diesen Rabattcode gibt es nicht." },
  disabled: { en: "This discount code is no longer active.", de: "Dieser Rabattcode ist nicht mehr aktiv." },
  scheduled: { en: "This discount code isn't valid yet.", de: "Dieser Rabattcode gilt noch nicht." },
  expired: { en: "This discount code has expired.", de: "Dieser Rabattcode ist abgelaufen." },
  used_up: { en: "This discount code has been used up.", de: "Dieser Rabattcode ist aufgebraucht." },
  min_order: { en: "Your order doesn't reach the minimum for this code yet.", de: "Deine Bestellung erreicht den Mindestbetrag für diesen Code noch nicht." },
  not_applicable: { en: "This code doesn't apply to the items in your bag.", de: "Dieser Code gilt nicht für die Artikel in deinem Warenkorb." },
  other: { en: "This discount code can't be used.", de: "Dieser Rabattcode kann nicht verwendet werden." },
};

export const isValidCode = (code: string): boolean => ADMIN_CODE.test(code);

export type DiscountInputProblem = "code" | "percent" | "fixed" | "min_order" | "usage_limit" | "dates";

/** Plain validation for the editor. Returns the first problem, or null. */
export function discountInputProblem(input: { code: string; type: Discount["type"]; value: number; minOrderRappen: number; usageLimit: number | null; startDay: string | null; endDay: string | null }): DiscountInputProblem | null {
  if (!isValidCode(input.code)) return "code";
  if (input.type === "percent" && (!Number.isInteger(input.value) || input.value < 1 || input.value > MAX_PERCENT)) return "percent";
  if (input.type === "fixed" && (!Number.isInteger(input.value) || input.value < 1 || input.value > MAX_FIXED_RAPPEN)) return "fixed";
  if (!Number.isInteger(input.minOrderRappen) || input.minOrderRappen < 0) return "min_order";
  if (input.usageLimit !== null && (!Number.isInteger(input.usageLimit) || input.usageLimit < 1)) return "usage_limit";
  if (input.startDay && input.endDay && input.endDay < input.startDay) return "dates";
  return null;
}

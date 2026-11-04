import { addToBag, addedBy, itemCount, removeBagLine, setBagCode, setBagLine } from "@/lib/cart";
import { normaliseCode, quoteCart, type Quote, type QuoteLine } from "@/lib/pricing";
import { effectivePrice, isSoldOut, isVariantOnSale, publicAvailable } from "@/lib/product-rules";
import { DEMO_TODAY } from "../clock";
import { getState, update } from "../core";
import { findVariant } from "../flows";
import type { ActionResult, Bag, Product, State, Variant } from "../types";

export type BagProblem = "unavailable" | "soldOut" | "onlyLeft";
export type BagRow = { variantId: string; quantity: number; product: Product | null; variant: Variant | null; available: number; unitRappen: number; lineRappen: number | null; problem: BagProblem | null };
export type BagView = { rows: BagRow[]; quote: Quote; units: number; hasProblem: boolean };
type BagInputs = Pick<State, "bag" | "products" | "discounts" | "settings">;

/** The bag against the current catalogue. Sold-out and unavailable lines stay listed but are not priced. */
export function bagView(s: BagInputs): BagView {
  const lookup = new Map<string, { product: Product; variant: Variant }>();
  for (const product of s.products) for (const variant of product.variants) lookup.set(variant.id, { product, variant });
  const rows: BagRow[] = s.bag.lines.map((line) => {
    const found = lookup.get(line.variantId);
    if (!found || !isVariantOnSale(found.product, found.variant)) {
      return { variantId: line.variantId, quantity: line.quantity, product: found?.product ?? null, variant: found?.variant ?? null, available: 0, unitRappen: 0, lineRappen: null, problem: "unavailable" };
    }
    const unit = effectivePrice(found.product, found.variant);
    const available = publicAvailable(found.variant);
    if (isSoldOut(found.variant)) return { variantId: line.variantId, quantity: line.quantity, product: found.product, variant: found.variant, available: 0, unitRappen: unit, lineRappen: null, problem: "soldOut" };
    return { variantId: line.variantId, quantity: line.quantity, product: found.product, variant: found.variant, available, unitRappen: unit, lineRappen: unit * line.quantity, problem: line.quantity > available ? "onlyLeft" : null };
  });
  const priced: QuoteLine[] = rows.flatMap((r) => (r.product && r.lineRappen !== null ? [{ variantId: r.variantId, productId: r.product.id, collectionIds: r.product.collectionIds, unitPriceRappen: r.unitRappen, quantity: r.quantity }] : []));
  const quote = quoteCart(priced, s.bag.code, { discounts: s.discounts, settings: s.settings, today: DEMO_TODAY });
  return { rows, quote, units: itemCount(s.bag), hasProblem: rows.some((r) => r.problem !== null) };
}

const setBag = (fn: (bag: Bag) => Bag) => update((state) => ({ ...state, bag: fn(state.bag) }));

/** Adds one of a size. `added` is 0 when the size or the bag is already full, which is the "max" message. */
export function addOne(variantId: string): ActionResult<{ added: number }> {
  const s = getState();
  const found = findVariant(s, variantId);
  if (!found || !isVariantOnSale(found.product, found.variant)) return { ok: false, code: "VARIANT_UNAVAILABLE", message: "This size is not on sale." };
  const after = addToBag(s.bag, variantId, publicAvailable(found.variant));
  const added = addedBy(s.bag, after);
  if (added > 0) setBag(() => after);
  return { ok: true, data: { added } };
}

/** Clamped to the size's availability and the bag's limits; 0 removes the line. */
export function setQuantity(variantId: string, quantity: number): ActionResult<{ quantity: number }> {
  const s = getState();
  const found = findVariant(s, variantId);
  if (!found) {
    setBag((bag) => removeBagLine(bag, variantId));
    return { ok: true, data: { quantity: 0 } };
  }
  const after = setBagLine(s.bag, variantId, quantity, publicAvailable(found.variant));
  setBag(() => after);
  return { ok: true, data: { quantity: after.lines.find((l) => l.variantId === variantId)?.quantity ?? 0 } };
}

export function removeLine(variantId: string): void {
  setBag((bag) => removeBagLine(bag, variantId));
}

/** A refused code is reported and stays out of the bag, so the bag is priced without it. */
export function applyCode(code: string): ActionResult<{ code: string }> {
  const clean = normaliseCode(code);
  if (!clean) return { ok: false, code: "not_found", message: "not_found" };
  const s = getState();
  const { quote } = bagView({ ...s, bag: { ...s.bag, code: clean } });
  if (quote.codeRejection) {
    setBag((bag) => setBagCode(bag, null));
    return { ok: false, code: quote.codeRejection, message: quote.codeRejection };
  }
  setBag((bag) => setBagCode(bag, clean));
  return { ok: true, data: { code: clean } };
}

export function clearCode(): void {
  setBag((bag) => setBagCode(bag, null));
}

import { beforeEach, describe, expect, it } from "vitest";
import { addOne, applyCode, bagView, clearCode, removeLine, setQuantity } from "@/store/actions/bag";
import { checkForm, demoForm, endCheckout, firstProblem, isSwissMobile } from "@/store/actions/checkout";
import { getState, resetStore, update } from "@/store/core";
import { findVariant } from "@/store/flows";
import { stepsFor } from "@/shop/ResultPanel";

const productBySlug = (slug: string) => getState().products.find((p) => p.slug === slug)!;
const sizeOf = (slug: string, size: string) => productBySlug(slug).variants.find((v) => v.size === size)!;
const stockOf = (id: string) => findVariant(getState(), id)!.variant.stock;
const total = () => bagView(getState()).quote.totalRappen;

beforeEach(() => resetStore());

describe("bag", () => {
  it("adds, counts and removes a line", () => {
    const tee = sizeOf("logo-tee-cloud", "M");
    expect(addOne(tee.id)).toEqual({ ok: true, data: { added: 1 } });
    addOne(tee.id);
    expect(bagView(getState()).units).toBe(2);
    removeLine(tee.id);
    expect(getState().bag.lines).toHaveLength(0);
  });

  it("will not add a sold out size, and reports it as nothing added", () => {
    const zipM = sizeOf("lagoon-zip-hoodie", "M");
    expect(zipM.stock).toBe(0);
    const before = getState().bag;
    const result = addOne(zipM.id);
    expect(result.ok && result.data.added).toBe(0);
    expect(getState().bag).toBe(before);
  });

  it("clamps a quantity to what the size has and removes at zero", () => {
    const xs = sizeOf("lagoon-zip-hoodie", "XS");
    addOne(xs.id);
    const up = setQuantity(xs.id, 9);
    expect(up.ok && up.data.quantity).toBeLessThanOrEqual(xs.stock);
    setQuantity(xs.id, 0);
    expect(getState().bag.lines).toHaveLength(0);
  });

  it("prices a good code and keeps a refused one out of the bag", () => {
    addOne(sizeOf("lagoon-zip-hoodie", "XS").id);
    expect(applyCode("summer20").ok).toBe(false);
    expect(getState().bag.code).toBeNull();
    const before = total();
    expect(applyCode(" launch15 ").ok).toBe(true);
    expect(getState().bag.code).toBe("LAUNCH15");
    expect(total()).toBeLessThan(before);
    clearCode();
    expect(total()).toBe(before);
  });

  it("marks a line whose stock ran out meanwhile", () => {
    const xs = sizeOf("lagoon-zip-hoodie", "XS");
    addOne(xs.id);
    update((s) => ({ ...s, products: s.products.map((p) => ({ ...p, variants: p.variants.map((v) => (v.id === xs.id ? { ...v, stock: 0 } : v)) })) }));
    const view = bagView(getState());
    expect(view.rows[0].problem).toBe("soldOut");
    expect(view.hasProblem).toBe(true);
  });
});

describe("checkout form", () => {
  it("accepts the prefilled demo data", () => {
    expect(firstProblem(checkForm(demoForm()))).toBeNull();
  });

  it("takes a Swiss mobile or the fake number, not a landline", () => {
    expect(isSwissMobile("+41 00 000 00 00")).toBe(true);
    // Joined here, so the project holds no complete phone number outside the fake one.
    const tail = ["123", "45", "67"];
    expect(isSwissMobile(["079", ...tail].join(" "))).toBe(true);
    expect(isSwissMobile(["0041", "76", ...tail].join(" "))).toBe(true);
    expect(isSwissMobile(["044", ...tail].join(" "))).toBe(false);
  });

  it("reports the first problem in reading order", () => {
    const form = { ...demoForm(), email: "nope", postalCode: "0123" };
    expect(firstProblem(checkForm(form))).toEqual({ field: "email", problem: "emailInvalid" });
    expect(checkForm(form).postalCode).toBe("postalCode");
  });
});

describe("checkout outcomes", () => {
  const prepare = () => {
    const tee = sizeOf("logo-tee-cloud", "M");
    addOne(tee.id);
    return { tee, stock: stockOf(tee.id), orders: getState().orders.length, shown: total() };
  };

  it("Paid creates the order, moves stock and empties the bag", () => {
    const { tee, stock, orders, shown } = prepare();
    const outbox = getState().outbox.length;
    const result = endCheckout(demoForm(), "paid", "en", shown);
    expect(result.ok).toBe(true);
    expect(getState().orders.length).toBe(orders + 1);
    expect(stockOf(tee.id)).toBe(stock - 1);
    expect(getState().bag.lines).toHaveLength(0);
    expect(getState().outbox.length).toBe(outbox + 1);
    expect(getState().outbox.every((mail) => (mail.status as string) !== "sent")).toBe(true);
  });

  it.each(["declined", "walked_away", "timed_out"] as const)("%s changes no order and no stock and keeps the bag", (outcome) => {
    const { tee, stock, orders, shown } = prepare();
    const outbox = getState().outbox.length;
    const result = endCheckout(demoForm(), outcome, "en", shown);
    expect(result.ok).toBe(true);
    expect(getState().orders.length).toBe(orders);
    expect(stockOf(tee.id)).toBe(stock);
    expect(getState().bag.lines).toHaveLength(1);
    expect(getState().outbox.length).toBe(outbox);
  });

  it("Paid after the hold ran out flags a stock conflict and never goes negative", () => {
    const { tee, shown } = prepare();
    const orders = getState().orders.length;
    const result = endCheckout(demoForm(), "paid_after_hold", "en", shown);
    expect(result.ok).toBe(true);
    expect(getState().orders.length).toBe(orders + 1);
    const conflicts = getState().orders.filter((o) => o.stockConflict && o.items.some((i) => i.variantId === tee.id));
    expect(conflicts.length).toBeGreaterThan(0);
    expect(stockOf(tee.id)).toBeGreaterThanOrEqual(0);
  });

  it("refuses a total that moved since it was shown, an empty bag and a broken form", () => {
    const { shown } = prepare();
    expect(endCheckout(demoForm(), "paid", "en", shown + 100)).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect(endCheckout({ ...demoForm(), email: "" }, "paid", "en", shown)).toMatchObject({ ok: false, code: "FORM_INVALID" });
    resetStore();
    expect(endCheckout(demoForm(), "paid", "en", 0)).toMatchObject({ ok: false, code: "CART_INVALID" });
  });
});

describe("result story", () => {
  it("tells the hold, the webhook, the order, stock, the render and not sent for a paid order", () => {
    expect(stepsFor("completed", { stockConflict: false }).map((s) => s.key)).toEqual(["hold", "webhook", "order_written", "stock_moved", "email_rendered", "not_sent"]);
  });
  it("adds the conflict for a late payment", () => {
    expect(stepsFor("completed", { stockConflict: true }).map((s) => s.key)).toContain("conflict");
  });
  it("tells only the hold and its release for a decline", () => {
    expect(stepsFor("failed", null).map((s) => s.key)).toEqual(["hold", "hold_released"]);
    expect(stepsFor("unknown", null)).toEqual([]);
  });
});

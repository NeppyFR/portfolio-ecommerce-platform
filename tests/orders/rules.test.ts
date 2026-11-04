import { describe, expect, it } from "vitest";
import { code128CheckValue, code128Patterns, code128Values, encodeCode128, QUIET_MODULES } from "@/desk/commerce/orders/rules/code128";
import { colourLabel, fulfilmentState, orderActions, pageOf, shownName, paymentFee, paymentState, piecesOut, roadToBooks, suggestedTracking, trackingHint } from "@/desk/commerce/orders/rules/order-rules";
import { nextPackCode, packIsComplete, packLines, packMinus, packNeed, packPacked, packScan, type PackLine } from "@/desk/commerce/orders/rules/pack";
import { EMPTY_RECEIVE, MAX_PER_LINE, receiveAdd, receiveRemove, receiveStep, receiveTotal, receiveUndo } from "@/desk/commerce/orders/rules/receive";
import { isOpenReturn, nextReturnNo, piecesPaidRappen, refundAmountProblem, returnBlock, returnableByItem, suggestedRefund } from "@/desk/commerce/orders/rules/returns";
import { classifyScan, isGtin } from "@/desk/commerce/orders/rules/scan";
import { adjustDelta, adjustProblem, filterCounts, filterRows, incomingByVariant, inventoryRows, parseAmount, reasonRule, tileFor, toShipByVariant } from "@/desk/commerce/inventory/rules";
import { customerRows, hasOpenBusiness, repeatCount, searchCustomers } from "@/desk/commerce/customers/rules";
import { checkTracking } from "@/lib/tracking";
import { A4_PER_PAGE, MAX_IDS, MAX_LABELS, expandLabels, hasThinBarcode, labelsHref, moduleFor, paginate, parseLabelParams } from "@/print/label-rules";
import { getState } from "@/store/core";
import type { Order, OrderItem, ReturnRecord } from "@/store/types";

const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  id: "i1", productId: "p", variantId: "v", name: "Tee", nameDe: "Tee", color: "Cloud", size: "M", sku: "AL-TEE-CLD-M", garment: "tee", tone: "ice",
  quantity: 2, unitPriceRappen: 3900, lineTotalRappen: 7800, discountRappen: 0, restocked: 0, shortfall: 0, ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  ...getState().orders[0],
  status: "paid", paidAt: "2027-01-08T09:00:00.000Z", packedAt: null, shippedAt: null, deliveredAt: null, cancelledAt: null, needsAttention: false, attentionResolvedAt: null,
  totalRappen: 7800, refundedRappen: 0, customerErased: false, items: [item()], ...over,
});

describe("pageOf", () => {
  it("finds the page a row lands on", () => {
    expect(pageOf(0, 50)).toBe(1);
    expect(pageOf(49, 50)).toBe(1);
    expect(pageOf(50, 50)).toBe(2);
    expect(pageOf(149, 25)).toBe(6);
    expect(pageOf(-1, 25)).toBe(1);
  });
});

describe("code 128", () => {
  it("has 106 symbols of 11 modules plus a 13 module stop", () => {
    const patterns = code128Patterns();
    expect(patterns).toHaveLength(107);
    patterns.slice(0, 106).forEach((p) => expect([...p].reduce((sum, w) => sum + Number(w), 0)).toBe(11));
    expect([...patterns[106]].reduce((sum, w) => sum + Number(w), 0)).toBe(13);
    expect(patterns[33]).toBe("111323");
    expect(patterns[104]).toBe("211214");
  });

  it("works out the check value by hand-checked example", () => {
    const values = code128Values("PJJ123C") as number[];
    expect(values).toEqual([48, 42, 42, 17, 18, 19, 35]);
    expect(code128CheckValue(values)).toBe(55);
  });

  it("draws start, data, check and stop inside the quiet zones", () => {
    const code = encodeCode128("AL-1042");
    expect(code?.modules).toBe(QUIET_MODULES * 2 + 11 * (7 + 2) + 13);
    expect(code?.bars[0].x).toBe(QUIET_MODULES);
    const last = code!.bars.at(-1)!;
    expect(last.x + last.w).toBe(code!.modules - QUIET_MODULES);
  });

  it("refuses text it cannot encode", () => {
    expect(encodeCode128("")).toBeNull();
    expect(encodeCode128("Grösse")).toBeNull();
  });
});

describe("scan classify", () => {
  it("sorts every kind of code", () => {
    expect(classifyScan("al-1042")).toEqual({ kind: "order", number: "AL-1042" });
    expect(classifyScan(" 1042 ")).toEqual({ kind: "order", number: "AL-1042" });
    expect(classifyScan("AL-ZIP-LAG-M")).toEqual({ kind: "sku", sku: "AL-ZIP-LAG-M" });
    expect(classifyScan("bp123456785zz")).toEqual({ kind: "tracking", value: "BP123456785ZZ" });
    expect(classifyScan("4006381333931")).toEqual({ kind: "gtin", value: "4006381333931" });
    expect(classifyScan("hello").kind).toBe("unknown");
  });

  it("checks the GTIN digit", () => {
    expect(isGtin("4006381333931")).toBe(true);
    expect(isGtin("4006381333932")).toBe(false);
  });
});

describe("shown colours and tiles", () => {
  it("translates the stored colour for German and keeps names as they are", () => {
    expect(colourLabel("Cobalt", "de")).toBe("Kobalt");
    expect(colourLabel("Cobalt", "en")).toBe("Cobalt");
    expect(colourLabel("Lagoon", "de")).toBe("Lagoon");
    expect(colourLabel("Frost", "de")).toBe("Frost");
    expect(colourLabel(null, "de")).toBe("");
  });
  it("prints the erased placeholder in the viewer's language and leaves real names alone", () => {
    expect(shownName("Erased customer", "Gelöschte Person")).toBe("Gelöschte Person");
    expect(shownName("Noah Meier", "Gelöschte Person")).toBe("Noah Meier");
  });
  it("gives every tone a garment tile", () => {
    for (const tone of ["ice", "sky", "azure", "dusk", "lilac"] as const) expect(tileFor(tone)).toMatch(/^t-/);
  });
});

describe("order lifecycle", () => {
  it("offers the buttons of the notes' table", () => {
    expect(orderActions(order())).toEqual(["pack", "ship", "refund", "cancel"]);
    expect(orderActions(order({ status: "packed", packedAt: "2027-01-08T10:00:00.000Z" }))).toEqual(["unpack", "ship", "refund", "cancel"]);
    expect(orderActions(order({ status: "shipped", shippedAt: "2027-01-08T10:00:00.000Z" }))).toEqual(["deliver", "tracking", "refund"]);
    expect(orderActions(order({ status: "delivered", shippedAt: "2027-01-08T10:00:00.000Z", deliveredAt: "2027-01-08T10:00:00.000Z" }))).toEqual(["refund"]);
    expect(orderActions(order({ status: "pending", paidAt: null }))).toEqual(["cancel"]);
    expect(orderActions(order({ status: "cancelled", cancelledAt: "2027-01-08T10:00:00.000Z" }))).toEqual([]);
    expect(orderActions(order({ needsAttention: true }))).toContain("resolve");
    expect(orderActions(order({ needsAttention: true, attentionResolvedAt: "2027-01-08T10:00:00.000Z" }))).not.toContain("resolve");
  });

  it("reads payment and fulfilment from the dates", () => {
    expect(paymentState(order({ paidAt: null }))).toBe("pending");
    expect(paymentState(order({ refundedRappen: 100 }))).toBe("partially_refunded");
    expect(paymentState(order({ refundedRappen: 7800 }))).toBe("refunded");
    expect(fulfilmentState(order({ packedAt: "2027-01-08T10:00:00.000Z" }))).toBe("packed");
    expect(fulfilmentState(order({ status: "cancelled" }))).toBe("cancelled");
  });

  it("counts pieces out with the customer", () => {
    expect(piecesOut(item({ quantity: 3, shortfall: 1, restocked: 1 }))).toBe(1);
    expect(piecesOut(item({ quantity: 1, shortfall: 1, restocked: 1 }))).toBe(0);
  });

  it("walks the road to the books over working days", () => {
    expect(paymentFee(10000)).toBe(190);
    const friday = roadToBooks({ paidAt: "2027-01-08T09:00:00.000Z", totalRappen: 10000, refundedRappen: 0 }, "2027-01-08");
    expect(friday).toMatchObject({ fee: 190, net: 9810, bankDay: "2027-01-12", booked: false });
    expect(roadToBooks({ paidAt: "2027-01-08T09:00:00.000Z", totalRappen: 10000, refundedRappen: 0 }, "2027-01-12")?.booked).toBe(true);
    expect(roadToBooks({ paidAt: null, totalRappen: 10000, refundedRappen: 0 })).toBeNull();
  });

  it("suggests a tracking number that passes the check digit", () => {
    expect(checkTracking(suggestedTracking("AL-1042"))).toBe("ok");
  });

  it("warns about a bad number only for the demo carrier", () => {
    expect(trackingHint("", "Beispielpost", "Beispielpost")).toBeNull();
    expect(trackingHint("BP123456785ZZ", "Beispielpost", "Beispielpost")).toBe("ok");
    expect(trackingHint("BP123456786ZZ", "Beispielpost", "Beispielpost")).toBe("check_digit");
    expect(trackingHint("RR123456785DE", "Beispielpost", "Beispielpost")).toBe("other_carrier");
    expect(trackingHint("nonsense", "Beispielpost", "Beispielpost")).toBe("format");
    expect(trackingHint("nonsense", "Other carrier", "Beispielpost")).toBeNull();
  });
});

describe("pack by scanning", () => {
  const lines: PackLine[] = packLines({ items: [item({ id: "a", sku: "AL-TEE-CLD-M", quantity: 2 }), item({ id: "b", sku: "AL-CAP-COB-OS", quantity: 1, size: "ONE_SIZE" }), item({ id: "c", sku: "AL-TOTE-CLD-OS", quantity: 1, restocked: 1, size: "ONE_SIZE" })] });

  it("needs ordered less shortfall less restocked", () => {
    expect(packNeed(lines)).toBe(3);
    expect(lines.find((l) => l.itemId === "c")?.need).toBe(0);
  });

  it("counts a piece, refuses wrong and extra pieces, and completes", () => {
    let state = {};
    let step = packScan(lines, state, "AL-TEE-CLD-M", "AL-1042");
    expect(step.outcome.kind).toBe("counted");
    state = step.state;
    step = packScan(lines, state, "AL-ZIP-LAG-M", "AL-1042");
    expect(step.outcome).toEqual({ kind: "wrong", sku: "AL-ZIP-LAG-M" });
    expect(step.state).toBe(state);
    step = packScan(lines, state, "AL-TEE-CLD-M", "AL-1042");
    state = step.state;
    step = packScan(lines, state, "AL-TEE-CLD-M", "AL-1042");
    expect(step.outcome.kind).toBe("over");
    step = packScan(lines, state, "AL-CAP-COB-OS", "AL-1042");
    expect(step.outcome.kind).toBe("complete");
    expect(packIsComplete(lines, step.state)).toBe(true);
    expect(packPacked(lines, step.state)).toBe(3);
  });

  it("refuses a piece fully refunded before packing", () => {
    expect(packScan(lines, {}, "AL-TOTE-CLD-OS", "AL-1042").outcome.kind).toBe("wrong");
  });

  it("knows its own slip from another order's", () => {
    expect(packScan(lines, {}, "AL-1042", "AL-1042").outcome).toEqual({ kind: "this_order" });
    expect(packScan(lines, {}, "AL-1043", "AL-1042").outcome).toEqual({ kind: "other_order", number: "AL-1043" });
    expect(packScan(lines, {}, "???", "AL-1042").outcome).toEqual({ kind: "unknown", code: "???" });
  });

  it("takes a piece out and feeds the next code", () => {
    expect(packMinus({ a: 2 }, "a")).toEqual({ a: 1 });
    const same = { a: 0 };
    expect(packMinus(same, "a")).toBe(same);
    expect(nextPackCode(lines, {})).toBe("AL-TEE-CLD-M");
    expect(nextPackCode(lines, { a: 2 })).toBe("AL-CAP-COB-OS");
    expect(nextPackCode(lines, { a: 2, b: 1 })).toBe("AL-CAP-COB-OS");
  });
});

describe("receive delivery", () => {
  it("adds one per scan, newest size first", () => {
    const one = receiveAdd(EMPTY_RECEIVE, "A", "va");
    expect(one).toMatchObject({ result: "added", quantity: 1, total: 1 });
    const two = receiveAdd(one.state, "B", "vb");
    const three = receiveAdd(two.state, "A", "va");
    expect(three).toMatchObject({ quantity: 2, total: 3 });
    expect(three.state.lines.map((l) => l.sku)).toEqual(["B", "A"]);
  });

  it("stops at the limit and steps, removes and undoes", () => {
    const full = { lines: [{ sku: "A", variantId: "va", quantity: MAX_PER_LINE }], scans: [] };
    expect(receiveAdd(full, "A", "va").result).toBe("line_full");
    const s = receiveAdd(receiveAdd(EMPTY_RECEIVE, "A", "va").state, "B", "vb").state;
    expect(receiveTotal(receiveStep(s, "A", 1))).toBe(3);
    expect(receiveStep(s, "A", -1).lines.map((l) => l.sku)).toEqual(["B"]);
    expect(receiveRemove(s, "B").scans).toEqual(["A"]);
    expect(receiveUndo(s).lines.map((l) => l.sku)).toEqual(["A"]);
    expect(receiveUndo(EMPTY_RECEIVE)).toBe(EMPTY_RECEIVE);
  });
});

describe("return rules", () => {
  const ret = (over: Partial<ReturnRecord> = {}): ReturnRecord => ({ id: "r", returnNo: "R-0001", orderNumber: "AL-1", customerName: "x", label: "R-0001", status: "requested", reason: "size", note: "", closeNote: "", openedBy: "x", createdAt: "2027-01-01T00:00:00Z", closedAt: null, refundRappen: 0, items: [{ orderItemId: "i1", quantity: 1, restockQuantity: 0 }], ...over });

  it("numbers the next return", () => {
    expect(nextReturnNo([{ returnNo: "R-0008" }, { returnNo: "R-0002" }])).toBe("R-0009");
    expect(nextReturnNo([])).toBe("R-0001");
  });

  it("refunds a piece after its share of the discount, rounded down", () => {
    const line = item({ quantity: 3, unitPriceRappen: 3333, discountRappen: 100 });
    expect(piecesPaidRappen(line, 1)).toBe(Math.floor((3333 * 3 - 100) / 3));
    expect(piecesPaidRappen(line, 3)).toBe(3333 * 3 - 100);
  });

  it("suggests the pieces and never more than is still refundable", () => {
    expect(suggestedRefund(order(), ret())).toBe(3900);
    expect(suggestedRefund(order({ refundedRappen: 5000 }), ret({ items: [{ orderItemId: "i1", quantity: 2, restockQuantity: 0 }] }))).toBe(2800);
  });

  it("names the problem with an amount", () => {
    expect(refundAmountProblem(null, 100)).toBe("invalid");
    expect(refundAmountProblem(0, 100)).toBe("zero");
    expect(refundAmountProblem(101, 100)).toBe("too_much");
    expect(refundAmountProblem(100, 100)).toBeNull();
  });

  it("leaves closed returns out and restocked pieces counted once", () => {
    const base = { items: [item({ quantity: 3, restocked: 1 })] };
    expect(returnableByItem(base, [])).toEqual({ i1: 2 });
    expect(returnableByItem(base, [ret({ status: "closed", items: [{ orderItemId: "i1", quantity: 2, restockQuantity: 0 }] })])).toEqual({ i1: 2 });
    expect(returnableByItem(base, [ret({ status: "refunded", items: [{ orderItemId: "i1", quantity: 1, restockQuantity: 1 }] })])).toEqual({ i1: 2 });
    expect(returnableByItem(base, [ret({ status: "requested", items: [{ orderItemId: "i1", quantity: 2, restockQuantity: 0 }] })])).toEqual({ i1: 0 });
  });

  it("says why an order takes no return", () => {
    expect(returnBlock(order(), [])).toBe("not_shipped");
    expect(returnBlock(order({ status: "cancelled" }), [])).toBe("cancelled");
    expect(returnBlock(order({ status: "delivered", customerErased: true }), [])).toBe("erased");
    expect(returnBlock(order({ status: "delivered", refundedRappen: 7800 }), [])).toBe("refunded");
    expect(returnBlock(order({ status: "delivered" }), [ret({ items: [{ orderItemId: "i1", quantity: 2, restockQuantity: 0 }] })])).toBe("all_out");
    expect(returnBlock(order({ status: "shipped" }), [])).toBeNull();
    expect(isOpenReturn(ret({ status: "received" }))).toBe(true);
    expect(isOpenReturn(ret({ status: "closed" }))).toBe(false);
  });
});

describe("inventory rules", () => {
  it("applies the sign of the reason", () => {
    expect(adjustDelta("delivery", -3)).toBe(3);
    expect(adjustDelta("damaged", 3)).toBe(-3);
    expect(adjustDelta("manual", -3)).toBe(-3);
    expect(reasonRule("damaged").noteRequired).toBe(true);
    expect(reasonRule("sample_out").noteRequired).toBe(false);
  });

  it("names the problem", () => {
    expect(adjustProblem({ reason: "delivery", amount: null, note: "", onHand: 1 })).toBe("amount");
    expect(adjustProblem({ reason: "delivery", amount: 0, note: "", onHand: 1 })).toBe("amount");
    expect(adjustProblem({ reason: "damaged", amount: 1, note: " ", onHand: 1 })).toBe("note");
    expect(adjustProblem({ reason: "damaged", amount: 2, note: "torn", onHand: 1 })).toBe("below_zero");
    expect(adjustProblem({ reason: "manual", amount: -1, note: "x", onHand: 1 })).toBeNull();
  });

  it("reads an amount in every way it gets typed", () => {
    expect(parseAmount("3")).toBe(3);
    expect(parseAmount("+3")).toBe(3);
    expect(parseAmount("-3")).toBe(-3);
    expect(parseAmount("−3")).toBe(-3);
    expect(parseAmount("3.5")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("agrees with the shell on low and out, and counts what is owed", () => {
    const s = getState();
    const rows = inventoryRows(s);
    expect(rows.length).toBe(s.products.reduce((n, p) => n + p.variants.length, 0));
    const counts = filterCounts(rows);
    expect(counts.out).toBeGreaterThan(0);
    expect(counts.low).toBeGreaterThanOrEqual(counts.out);
    expect(filterRows(rows, "out", "").every((r) => r.onSale && r.state === "out")).toBe(true);
    expect(filterRows(rows, "all", "al-zip-lag").every((r) => r.sku.startsWith("AL-ZIP-LAG"))).toBe(true);
    expect([...incomingByVariant(s.purchaseOrders).values()].every((n) => n > 0)).toBe(true);
    expect([...toShipByVariant(s.orders).values()].every((n) => n > 0)).toBe(true);
  });
});

describe("customer rules", () => {
  it("gives the seed's 40 people, 12 of them back", () => {
    const s = getState();
    const rows = customerRows(s.customers, s.orders);
    expect(rows.filter((r) => !r.erased)).toHaveLength(40);
    expect(repeatCount(rows)).toBe(12);
    expect(rows.filter((r) => r.erased)).toHaveLength(1);
  });

  it("counts spent net of refunds and searches names and emails", () => {
    const s = getState();
    const rows = customerRows(s.customers, s.orders);
    const someone = rows.find((r) => r.orders > 1)!;
    const own = s.orders.filter((o) => o.customerId === someone.id && o.paidAt);
    expect(someone.spentRappen).toBe(own.reduce((sum, o) => sum + o.totalRappen - o.refundedRappen, 0));
    expect(searchCustomers(rows, someone.email.toUpperCase()).map((r) => r.id)).toEqual([someone.id]);
    expect(searchCustomers(rows, "")).toBe(rows);
  });

  it("holds an erase back while an order or return is open", () => {
    const orders = [order({ customerId: "c", status: "shipped", orderNumber: "AL-9" })];
    expect(hasOpenBusiness("c", orders, [])).toBe(true);
    const done = [order({ customerId: "c", status: "delivered", orderNumber: "AL-9" })];
    expect(hasOpenBusiness("c", done, [])).toBe(false);
    const ret = { id: "r", returnNo: "R-1", orderNumber: "AL-9", customerName: "x", label: "R-1", status: "received", reason: "size", note: "", closeNote: "", openedBy: "x", createdAt: "", closedAt: null, refundRappen: 0, items: [] } as ReturnRecord;
    expect(hasOpenBusiness("c", done, [ret])).toBe(true);
  });
});

describe("labels", () => {
  const products = getState().products;
  const ids = products[0].variants.map((v) => v.id);

  it("reads and clamps the query", () => {
    expect(parseLabelParams({ v: "a,b,a, ,c", copies: "3", layout: "roll" })).toEqual({ ids: ["a", "b", "c"], copies: 3, layout: "roll" });
    expect(parseLabelParams({ v: null, copies: "0", layout: "x" })).toEqual({ ids: [], copies: 1, layout: "a4" });
    expect(parseLabelParams({ v: "a", copies: "999", layout: null }).copies).toBe(100);
    expect(parseLabelParams({ v: Array.from({ length: 300 }, (_, i) => `v${i}`).join(","), copies: null, layout: null }).ids).toHaveLength(MAX_IDS);
  });

  it("expands copies, reports the missing and caps the batch", () => {
    const batch = expandLabels({ ids: [ids[0], "gone", ids[1]], copies: 2, layout: "a4" }, products);
    expect(batch.labels.map((l) => l.variantId)).toEqual([ids[0], ids[0], ids[1], ids[1]]);
    expect(batch).toMatchObject({ missing: 1, requested: 4, variants: 2 });
    const big = expandLabels({ ids, copies: 100, layout: "a4" }, products);
    expect(big.labels).toHaveLength(Math.min(MAX_LABELS, ids.length * 100));
  });

  it("pages 24 to a sheet", () => {
    const pages = paginate(Array.from({ length: 25 }, (_, i) => i), A4_PER_PAGE);
    expect(pages.map((p) => p.length)).toEqual([24, 1]);
  });

  it("thins the barcode only when the room runs out", () => {
    expect(moduleFor("AL-TEE-CLD-M", 64)).toBe(0.3);
    expect(moduleFor("AL-OVERSIZED-HOODIE-CLOUD-XL-EXTRA", 64)).toBeLessThan(0.25);
    expect(hasThinBarcode([{ sku: "AL-TEE-CLD-M" }], "a4")).toBe(false);
    expect(hasThinBarcode([{ sku: "AL-OVERSIZED-HOODIE-CLOUD-XL-EXTRA" }], "a4")).toBe(true);
  });

  it("builds the link the toolbar reads back", () => {
    const parsed = parseLabelParams({ ...Object.fromEntries(new URLSearchParams(labelsHref(["a b", "c"], 2, "roll").split("?")[1])), layout: "roll" } as never);
    expect(parsed.copies).toBe(2);
    expect(parsed.ids).toEqual(["a b", "c"]);
  });
});

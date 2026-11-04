import { beforeEach, describe, expect, it } from "vitest";
import { copyCode, createDiscount, discountProblem, duplicateDiscount, saveDiscount, toggleDiscount, type DiscountInput } from "@/store/actions/discounts";
import { addProductsToDrop, addToWaitlist, createDrop, markWaitlistTold, removeFromWaitlist, removeProductFromDrop, saveDrop, startDropChecklist, type DropInput } from "@/store/actions/drops";
import { createCampaign, deleteCampaign, saveCampaign, type CampaignInput } from "@/store/actions/marketing";
import { addPoLine, createPurchaseOrder, createSupplier, linkPoLedger, receivePurchaseOrder, removePoLine, savePurchaseOrder, saveSupplier, type PoInput } from "@/store/actions/production";
import { addVariant, archiveProduct, createCollection, createProduct, createTag, deleteProduct, deleteVariant, duplicateProduct, saveCollection, saveProduct, saveVariant, setCollectionShown, toggleVariant, unarchiveProduct } from "@/store/actions/products";
import { getState, resetStore } from "@/store/core";
import { findVariant } from "@/store/flows";

const discount = (over: Partial<DiscountInput> = {}): DiscountInput => ({ code: "SPRING15", type: "percent", value: 15, scope: "all", productIds: [], collectionIds: [], minOrderRappen: null, usageLimit: null, startDay: "2027-01-08", endDay: null, isEnabled: true, description: "", ...over });
const dropInput = (over: Partial<DropInput> = {}): DropInput => ({ name: "Stratus", season: "S5", status: "planned", launchOn: "2027-03-01", launchTime: "18:00", description: "", ...over });
const poInput = (over: Partial<PoInput> = {}): PoInput => ({ supplierId: "sup_lago", kind: "production", dropId: null, currency: "CHF", orderedOn: "2027-01-08", expectedOn: "2027-02-08", shippingMinor: 1000, notes: "", ...over });
const campaign = (over: Partial<CampaignInput> = {}): CampaignInput => ({ name: "Spring post", channel: "instagram", status: "draft", startsOn: null, endsOn: null, owner: null, discountId: null, productIds: [], notes: "", ...over });

const firstVariant = (slug: string): string => {
  const variant = getState().products.find((p) => p.slug === slug)?.variants[0];
  if (!variant) throw new Error(`seed: ${slug}`);
  return variant.id;
};
const capVariant = () => firstVariant("logo-cap-cobalt");
const teeVariant = () => firstVariant("logo-tee-cloud");

beforeEach(() => resetStore());

describe("discounts", () => {
  it("creates a code in capitals, newest first", () => {
    const result = createDiscount(discount({ code: "spring15" }));
    expect(result.ok && result.data.code).toBe("SPRING15");
    expect(getState().discounts[0].code).toBe("SPRING15");
  });
  it("names the wrong field", () => {
    expect(discountProblem(discount({ code: "x" }), null)).toBe("code");
    expect(discountProblem(discount({ value: 91 }), null)).toBe("percent");
    expect(discountProblem(discount({ type: "fixed", value: null }), null)).toBe("fixed");
    expect(discountProblem(discount({ code: "LAUNCH15" }), null)).toBe("code_taken");
    expect(discountProblem(discount({ scope: "products" }), null)).toBe("scope");
    expect(discountProblem(discount({ endDay: "2027-01-01" }), null)).toBe("dates");
    expect(discountProblem(discount({ usageLimit: Number.NaN }), null)).toBe("usage_limit");
    expect(discountProblem(discount({ minOrderRappen: Number.NaN }), null)).toBe("min_order");
    expect(discountProblem(discount({ type: "free_shipping", value: 0 }), null)).toBeNull();
  });
  it("keeps the code's own name when saving", () => {
    const own = getState().discounts.find((d) => d.code === "LAUNCH15");
    expect(own && discountProblem(discount({ code: "LAUNCH15" }), own.id)).toBeNull();
    expect(own && saveDiscount(own.id, discount({ code: "LAUNCH15", value: 20 })).ok).toBe(true);
    expect(getState().discounts.find((d) => d.code === "LAUNCH15")?.value).toBe(20);
  });
  it("toggles and duplicates switched off and unused", () => {
    const own = getState().discounts.find((d) => d.code === "LAUNCH15");
    if (!own) throw new Error("seed");
    const off = toggleDiscount(own.id);
    expect(off.ok && off.data.isEnabled).toBe(false);
    const copy = duplicateDiscount(own.id);
    expect(copy.ok && copy.data.code).toBe("LAUNCH15-COPY");
    const row = getState().discounts[0];
    expect([row.code, row.isEnabled, row.timesUsed, row.redeemedRappen, row.lastUsedAt]).toEqual(["LAUNCH15-COPY", false, 0, 0, null]);
    const second = duplicateDiscount(own.id);
    expect(second.ok && second.data.code).toBe("LAUNCH15-COPY2");
  });
  it("keeps a copy's name within the limit", () => {
    expect(copyCode("A".repeat(30), [])).toBe(`${"A".repeat(25)}-COPY`);
  });
});

describe("drops", () => {
  it("creates with a Zurich launch instant and saves changes", () => {
    const result = createDrop(dropInput());
    if (!result.ok) throw new Error(result.code);
    const row = getState().drops.find((d) => d.id === result.data.id);
    expect(row?.launchAt).toBe("2027-03-01T17:00:00.000Z");
    expect(saveDrop(result.data.id, dropInput({ launchTime: null })).ok).toBe(true);
    expect(getState().drops.find((d) => d.id === result.data.id)?.launchAt).toBeNull();
    expect(createDrop(dropInput({ name: "" })).ok).toBe(false);
  });
  it("lets a product join one drop only", () => {
    const created = createDrop(dropInput());
    if (!created.ok) throw new Error(created.code);
    const free = getState().products.find((p) => !getState().drops.some((d) => d.productIds.includes(p.id)));
    if (!free) throw new Error("seed");
    expect(addProductsToDrop(created.data.id, [free.id]).ok).toBe(true);
    const again = addProductsToDrop("drop_cirrus", [free.id]);
    expect(again.ok).toBe(false);
    expect(removeProductFromDrop(created.data.id, free.id).ok).toBe(true);
    expect(addProductsToDrop("drop_cirrus", [free.id]).ok).toBe(true);
  });
  it("starts the ten-item checklist once", () => {
    const created = createDrop(dropInput());
    if (!created.ok) throw new Error(created.code);
    const result = startDropChecklist(created.data.id, "de");
    if (!result.ok) throw new Error(result.code);
    const tasks = getState().tasks.filter((t) => t.listId === result.data.listId);
    expect(tasks).toHaveLength(10);
    expect(tasks[0].title).toBe("Muster freigegeben und Grössen geprüft");
    expect(tasks[0].dueOn).toBe("2027-03-01");
    expect(startDropChecklist(created.data.id, "de")).toMatchObject({ ok: false, code: "exists" });
  });
  it("adds to the waitlist, skips doubles, marks told once, removes", () => {
    const first = addToWaitlist("drop_cirrus", null, "a.b@example.com, M\nnot an address");
    expect(first.ok && first.data).toEqual({ added: 1, skipped: 0, invalid: ["not an address"] });
    const second = addToWaitlist("drop_cirrus", null, "A.B@example.com, M\nc.d@example.com");
    expect(second.ok && second.data).toEqual({ added: 1, skipped: 1, invalid: [] });
    const row = () => getState().drops.find((d) => d.id === "drop_cirrus");
    const ids = row()?.waitlist.map((w) => w.id) ?? [];
    const told = markWaitlistTold("drop_cirrus", ids);
    expect(told.ok && told.data.marked).toBe(2);
    expect(markWaitlistTold("drop_cirrus", ids).ok).toBe(false);
    expect(removeFromWaitlist("drop_cirrus", ids[0]).ok).toBe(true);
    expect(row()?.waitlist).toHaveLength(1);
    expect(addToWaitlist("drop_cirrus", null, " \n ").ok).toBe(false);
  });
});

describe("production", () => {
  it("adds suppliers and switches them off", () => {
    const created = createSupplier({ name: "Zwirn AG", contactName: "", email: "", phone: "", country: "CH", notes: "", isActive: true });
    if (!created.ok) throw new Error(created.code);
    expect(saveSupplier(created.data.id, { name: "Zwirn AG", contactName: "", email: "", phone: "", country: "CH", notes: "", isActive: false }).ok).toBe(true);
    expect(getState().suppliers.find((s) => s.id === created.data.id)?.isActive).toBe(false);
    expect(createSupplier({ name: "", contactName: "", email: "", phone: "", country: "", notes: "", isActive: true }).ok).toBe(false);
    expect(createSupplier({ name: "x", contactName: "", email: "nope", phone: "", country: "", notes: "", isActive: true })).toMatchObject({ code: "email" });
  });
  it("starts an order as the next draft, refuses a reversed date", () => {
    const result = createPurchaseOrder(poInput());
    expect(result.ok && result.data.number).toBe("PO-0009");
    expect(createPurchaseOrder(poInput({ expectedOn: "2027-01-01" }))).toMatchObject({ ok: false, code: "dates" });
    expect(getState().purchaseOrders[0].status).toBe("draft");
  });
  it("adds lines, refuses a double, removes", () => {
    const po = createPurchaseOrder(poInput());
    if (!po.ok) throw new Error(po.code);
    const capId = capVariant();
    const added = addPoLine(po.data.id, { variantId: capId, quantity: 10, unitCostMinor: 1200 });
    if (!added.ok) throw new Error(added.code);
    expect(addPoLine(po.data.id, { variantId: capId, quantity: 1, unitCostMinor: 1 })).toMatchObject({ code: "line_exists" });
    expect(addPoLine(po.data.id, { variantId: "nope", quantity: 1, unitCostMinor: 1 })).toMatchObject({ code: "size" });
    expect(addPoLine(po.data.id, { variantId: teeVariant(), quantity: Number.NaN, unitCostMinor: 1 })).toMatchObject({ code: "quantity" });
    expect(removePoLine(po.data.id, added.data.lineId).ok).toBe(true);
  });
  it("books stock once on receive, writes history, updates costs, then refuses", () => {
    const po = createPurchaseOrder(poInput());
    if (!po.ok) throw new Error(po.code);
    const variantId = capVariant();
    const before = findVariant(getState(), variantId)?.variant.stock ?? 0;
    addPoLine(po.data.id, { variantId, quantity: 10, unitCostMinor: 1200 });
    expect(receivePurchaseOrder(po.data.id, { updateCosts: true })).toMatchObject({ ok: true, data: { pieces: 10, skipped: [], costsUpdated: 1 } });
    const state = getState();
    const found = findVariant(state, variantId);
    expect(found?.variant.stock).toBe(before + 10);
    expect(found?.product.costRappen).toBe(1300);
    expect(state.movements[0]).toMatchObject({ reason: "delivery", delta: 10, note: "PO-0009" });
    const row = state.purchaseOrders.find((p) => p.id === po.data.id);
    expect(row?.status).toBe("received");
    expect(row?.lines[0].receivedQuantity).toBe(10);
    expect(receivePurchaseOrder(po.data.id, { updateCosts: false })).toMatchObject({ ok: false, code: "closed" });
    expect(findVariant(getState(), variantId)?.variant.stock).toBe(before + 10);
    expect(savePurchaseOrder(po.data.id, poInput())).toMatchObject({ ok: false, code: "closed" });
  });
  it("refuses to receive with no lines and to pick received by hand", () => {
    const po = createPurchaseOrder(poInput());
    if (!po.ok) throw new Error(po.code);
    expect(receivePurchaseOrder(po.data.id, { updateCosts: false })).toMatchObject({ code: "no_lines" });
    expect(savePurchaseOrder(po.data.id, poInput({ status: "received" }))).toMatchObject({ code: "status" });
  });
  it("links the ledger only on a received order", () => {
    const received = getState().purchaseOrders.find((p) => p.status === "received" && !p.financeEntryId);
    const entry = getState().ledger.find((e) => e.amountRappen < 0);
    if (!received || !entry) throw new Error("seed");
    expect(linkPoLedger(received.id, entry.id).ok).toBe(true);
    expect(getState().purchaseOrders.find((p) => p.id === received.id)?.financeEntryId).toBe(entry.id);
    expect(linkPoLedger(received.id, "nope")).toMatchObject({ code: "entry" });
    const open = getState().purchaseOrders.find((p) => p.status === "shipped");
    expect(open && linkPoLedger(open.id, entry.id)).toMatchObject({ code: "not_received" });
  });
});

describe("marketing", () => {
  it("plans, edits and deletes without touching the code or products", () => {
    const code = getState().discounts[0];
    const result = createCampaign(campaign({ discountId: code.id, productIds: ["prod_frost-scarf"] }));
    if (!result.ok) throw new Error(result.code);
    expect(saveCampaign(result.data.id, campaign({ name: "Renamed", status: "scheduled" })).ok).toBe(true);
    expect(getState().campaigns.find((c) => c.id === result.data.id)?.status).toBe("scheduled");
    expect(saveCampaign(result.data.id, campaign({ startsOn: "2027-02-01", endsOn: "2027-01-01" }))).toMatchObject({ code: "dates" });
    expect(deleteCampaign(result.data.id).ok).toBe(true);
    expect(getState().discounts[0]).toBe(code);
    expect(getState().products.some((p) => p.id === "prod_frost-scarf")).toBe(true);
    expect(createCampaign(campaign({ name: " " }))).toMatchObject({ code: "name" });
  });
});

describe("products", () => {
  const base = { nameEn: "Cloud Socks", nameDe: "Wolken-Socken", descriptionEn: "", descriptionDe: "", category: "other" as const, priceRappen: 1900, costRappen: null, garment: "tote" as const, tone: "ice" as const, printedName: false, collectionIds: [], tagIds: [] };
  it("creates a draft, adds a size, toggles it, deletes it, deletes the product", () => {
    const made = createProduct(base);
    if (!made.ok) throw new Error(made.code);
    const row = () => getState().products.find((p) => p.id === made.data.id);
    expect(row()?.status).toBe("draft");
    const size = addVariant(made.data.id, { size: "M", color: "Ice", sku: "AL-SOCK-ICE-M", priceOverrideRappen: null, threshold: null, openingStock: 5 });
    if (!size.ok) throw new Error(size.code);
    expect(row()?.variants[0].stock).toBe(5);
    const vid = row()?.variants[0].id as string;
    expect(toggleVariant(made.data.id, vid).ok).toBe(true);
    expect(row()?.variants[0].isActive).toBe(false);
    expect(saveVariant(made.data.id, vid, { size: "L", color: "Ice", sku: "AL-SOCK-ICE-L", priceOverrideRappen: 2100, threshold: 2 }).ok).toBe(true);
    expect(row()?.variants[0].sku).toBe("AL-SOCK-ICE-L");
    expect(deleteVariant(made.data.id, vid).ok).toBe(true);
    expect(row()?.variants).toHaveLength(0);
    expect(saveProduct(made.data.id, { ...base, nameEn: "Cloud Socks 2" }).ok).toBe(true);
    expect(deleteProduct(made.data.id).ok).toBe(true);
    expect(row()).toBeUndefined();
  });
  it("refuses bad input and to delete what has been ordered", () => {
    expect(createProduct({ ...base, nameEn: "" }).ok).toBe(false);
    expect(createProduct({ ...base, priceRappen: 50 }).ok).toBe(false);
    const sold = getState().products.find((p) => p.variants.some((v) => v.ordered > 0));
    if (!sold) throw new Error("seed");
    expect(deleteProduct(sold.id).ok).toBe(false);
    const variant = sold.variants.find((v) => v.ordered > 0);
    expect(variant && deleteVariant(sold.id, variant.id).ok).toBe(false);
  });
  it("archives, brings back as a draft, duplicates as a draft with -COPY SKUs and no stock", () => {
    const id = getState().products[0].id;
    expect(archiveProduct(id).ok).toBe(true);
    expect(getState().products[0].status).toBe("archived");
    expect(unarchiveProduct(id).ok).toBe(true);
    expect(getState().products[0].status).toBe("draft");
    const copy = duplicateProduct(id);
    if (!copy.ok) throw new Error(copy.code);
    const row = getState().products.find((p) => p.id === copy.data.id);
    expect(row?.status).toBe("draft");
    expect(row?.variants.every((v) => v.stock === 0 && v.sku.endsWith("-COPY"))).toBe(true);
  });
  it("makes and hides collections, and refuses a double tag", () => {
    const made = createCollection({ nameEn: "Winter", nameDe: "Winter", descriptionEn: "", descriptionDe: "" });
    if (!made.ok) throw new Error(made.code);
    expect(saveCollection(made.data.id, { nameEn: "Winter 27", nameDe: "Winter 27", descriptionEn: "", descriptionDe: "" }).ok).toBe(true);
    expect(setCollectionShown(made.data.id, false).ok).toBe(true);
    expect(getState().collections.find((c) => c.id === made.data.id)?.isActive).toBe(false);
    expect(createTag("wool").ok).toBe(true);
    expect(createTag("wool").ok).toBe(false);
  });
});

describe("reset", () => {
  it("clears everything these actions wrote", () => {
    const before = getState();
    createDiscount(discount());
    createDrop(dropInput());
    createCampaign(campaign());
    createPurchaseOrder(poInput());
    resetStore();
    const after = getState();
    expect(after.discounts.length).toBe(before.discounts.length);
    expect(after.drops.length).toBe(before.drops.length);
    expect(after.campaigns.length).toBe(before.campaigns.length);
    expect(after.purchaseOrders.length).toBe(before.purchaseOrders.length);
    const again = createPurchaseOrder(poInput());
    expect(again.ok && again.data.number).toBe("PO-0009");
  });
});

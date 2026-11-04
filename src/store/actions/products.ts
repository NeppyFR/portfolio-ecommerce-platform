import { hasOrders, reservedUnits, variantDeleteBlock, variantInputProblem } from "@/desk/commerce/products/rules";
import { productInputProblem, slugify, uniqueSlug } from "@/lib/product-rules";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity, moveStock } from "@/store/flows";
import type { ActionResult, Collection, GarmentTone, GarmentType, Product, ProductCategory, ProductStatus, ProductTag, Rappen, SizeCode, Variant } from "@/store/types";

let seq = 1;
registerReset(() => {
  seq = 1;
});
const uid = (prefix: string) => `${prefix}_b4_${seq++}`;

const fail = (code: string): { ok: false; code: string; message: string } => ({ ok: false, code, message: code });

export type ProductInput = {
  nameEn: string; nameDe: string; descriptionEn: string; descriptionDe: string; category: ProductCategory; priceRappen: Rappen | null; costRappen: Rappen | null;
  garment: GarmentType; tone: GarmentTone; printedName: boolean; collectionIds: string[]; tagIds: string[]; status?: ProductStatus;
};

function productProblem(input: ProductInput): string | null {
  const problem = productInputProblem({ nameEn: input.nameEn, nameDe: input.nameDe, priceRappen: input.priceRappen ?? -1 });
  if (problem) return problem;
  return input.costRappen !== null && input.costRappen < 0 ? "cost" : null;
}

/** A new product is always a draft: it reaches the shop only when someone sets it active. */
export function createProduct(input: ProductInput): ActionResult<{ id: string; slug: string }> {
  const problem = productProblem(input);
  if (problem) return fail(problem);
  const s = getState();
  const id = uid("prod");
  const slug = uniqueSlug(input.nameEn, s.products.map((p) => p.slug));
  const at = now();
  const product: Product = {
    id, slug, nameEn: input.nameEn.trim(), nameDe: input.nameDe.trim(), descriptionEn: input.descriptionEn.trim(), descriptionDe: input.descriptionDe.trim(),
    status: "draft", category: input.category, priceRappen: input.priceRappen as number, costRappen: input.costRappen, garment: input.garment, tone: input.tone, printedName: input.printedName,
    collectionIds: input.collectionIds, tagIds: input.tagIds, variants: [], createdAt: at, updatedAt: at, publishedAt: null,
  };
  update((state) => ({ ...state, products: [product, ...state.products] }));
  logActivity({ area: "products", action: "product_created", detail: product.nameEn });
  return { ok: true, data: { id, slug } };
}

export function saveProduct(id: string, input: ProductInput): ActionResult {
  const problem = productProblem(input);
  if (problem) return fail(problem);
  if (!getState().products.some((p) => p.id === id)) return fail("not_found");
  const at = now();
  update((state) => ({
    ...state,
    products: state.products.map((p) => {
      if (p.id !== id) return p;
      const status = input.status ?? p.status;
      return {
        ...p, nameEn: input.nameEn.trim(), nameDe: input.nameDe.trim(), descriptionEn: input.descriptionEn.trim(), descriptionDe: input.descriptionDe.trim(), category: input.category,
        priceRappen: input.priceRappen as number, costRappen: input.costRappen, garment: input.garment, tone: input.tone, printedName: input.printedName, collectionIds: input.collectionIds, tagIds: input.tagIds,
        status, updatedAt: at, publishedAt: p.publishedAt ?? (status === "active" ? at : null),
      };
    }),
  }));
  logActivity({ area: "products", action: "product_saved", detail: input.nameEn.trim() });
  return { ok: true, data: undefined };
}

/** A draft copy: same texts, price, cost, collections, tags and sizes, new SKUs ending in -COPY, stock 0. */
export function duplicateProduct(id: string): ActionResult<{ id: string }> {
  const s = getState();
  const source = s.products.find((p) => p.id === id);
  if (!source) return fail("not_found");
  const newId = uid("prod");
  const at = now();
  const takenSkus = new Set(s.products.flatMap((p) => p.variants.map((v) => v.sku)));
  const copySku = (sku: string) => {
    let candidate = `${sku}-COPY`;
    for (let n = 2; takenSkus.has(candidate); n += 1) candidate = `${sku}-COPY${n}`;
    takenSkus.add(candidate);
    return candidate;
  };
  const copy: Product = {
    ...source,
    id: newId,
    slug: uniqueSlug(`${source.slug}-copy`, s.products.map((p) => p.slug)),
    nameEn: `${source.nameEn} (copy)`,
    nameDe: `${source.nameDe} (Kopie)`,
    status: "draft",
    createdAt: at,
    updatedAt: at,
    publishedAt: null,
    variants: source.variants.map((v) => ({ ...v, id: uid("var"), productId: newId, sku: copySku(v.sku), stock: 0, reserved: 0, ordered: 0, updatedAt: at })),
  };
  update((state) => ({ ...state, products: [copy, ...state.products] }));
  logActivity({ area: "products", action: "product_duplicated", detail: source.nameEn });
  return { ok: true, data: { id: newId } };
}

function setStatus(id: string, status: ProductStatus): ActionResult {
  const product = getState().products.find((p) => p.id === id);
  if (!product) return fail("not_found");
  const at = now();
  update((state) => ({ ...state, products: state.products.map((p) => (p.id === id ? { ...p, status, updatedAt: at } : p)) }));
  logActivity({ area: "products", action: status === "archived" ? "product_archived" : "product_unarchived", detail: product.nameEn });
  return { ok: true, data: undefined };
}

export const archiveProduct = (id: string): ActionResult => setStatus(id, "archived");
export const unarchiveProduct = (id: string): ActionResult => setStatus(id, "draft");

/** Refused once ordered or while a size sits in an open checkout. Everything pointing at the product lets go of it. */
export function deleteProduct(id: string): ActionResult {
  const s = getState();
  const product = s.products.find((p) => p.id === id);
  if (!product) return fail("not_found");
  if (hasOrders(product, s.orders)) return fail("has_orders");
  if (reservedUnits(product) > 0) return fail("reserved");
  const variantIds = new Set(product.variants.map((v) => v.id));
  update((state) => ({
    ...state,
    products: state.products.filter((p) => p.id !== id),
    movements: state.movements.filter((m) => !variantIds.has(m.variantId)),
    drops: state.drops.map((d) => ({ ...d, productIds: d.productIds.filter((p) => p !== id), waitlist: d.waitlist.map((w) => (w.productId === id ? { ...w, productId: null } : w)) })),
    campaigns: state.campaigns.map((c) => ({ ...c, productIds: c.productIds.filter((p) => p !== id) })),
    discounts: state.discounts.map((d) => ({ ...d, productIds: d.productIds.filter((p) => p !== id) })),
    bag: { ...state.bag, lines: state.bag.lines.filter((l) => !variantIds.has(l.variantId)) },
  }));
  logActivity({ area: "products", action: "product_deleted", detail: product.nameEn });
  return { ok: true, data: undefined };
}

export type VariantInput = { size: SizeCode; color: string; sku: string; priceOverrideRappen: Rappen | null; threshold: number | null; openingStock?: number | null };

const allVariants = (): Variant[] => getState().products.flatMap((p) => p.variants);
const sameSlot = (v: Pick<Variant, "size" | "color">, input: VariantInput) => v.size === input.size && v.color.trim().toLowerCase() === input.color.trim().toLowerCase();

export function addVariant(productId: string, input: VariantInput): ActionResult<{ id: string }> {
  const product = getState().products.find((p) => p.id === productId);
  if (!product) return fail("not_found");
  const problem = variantInputProblem(input, allVariants(), null);
  if (problem) return fail(problem);
  if (product.variants.some((v) => sameSlot(v, input))) return fail("duplicate");
  const id = uid("var");
  const at = now();
  const variant: Variant = { id, productId, size: input.size, color: input.color.trim(), sku: input.sku.trim().toUpperCase(), priceOverrideRappen: input.priceOverrideRappen, threshold: input.threshold, isActive: true, stock: 0, reserved: 0, ordered: 0, updatedAt: at };
  update((state) => ({ ...state, products: state.products.map((p) => (p.id === productId ? { ...p, variants: [...p.variants, variant], updatedAt: at } : p)) }));
  if (input.openingStock) moveStock({ variantId: id, delta: input.openingStock, reason: "initial", note: "Opening stock" });
  logActivity({ area: "products", action: "variant_added", detail: variant.sku });
  return { ok: true, data: { id } };
}

/** Stock never changes here: that goes through Inventory, with a reason. */
export function saveVariant(productId: string, variantId: string, input: VariantInput): ActionResult {
  const product = getState().products.find((p) => p.id === productId);
  if (!product || !product.variants.some((v) => v.id === variantId)) return fail("not_found");
  const problem = variantInputProblem({ sku: input.sku, priceOverrideRappen: input.priceOverrideRappen, threshold: input.threshold }, allVariants(), variantId);
  if (problem) return fail(problem);
  if (product.variants.some((v) => v.id !== variantId && sameSlot(v, input))) return fail("duplicate");
  const at = now();
  update((state) => ({
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, updatedAt: at, variants: p.variants.map((v) => (v.id === variantId ? { ...v, size: input.size, color: input.color.trim(), sku: input.sku.trim().toUpperCase(), priceOverrideRappen: input.priceOverrideRappen, threshold: input.threshold, updatedAt: at } : v)) } : p)),
  }));
  logActivity({ area: "products", action: "variant_saved", detail: input.sku.trim().toUpperCase() });
  return { ok: true, data: undefined };
}

export function toggleVariant(productId: string, variantId: string): ActionResult<{ sku: string; isActive: boolean }> {
  const product = getState().products.find((p) => p.id === productId);
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!variant) return fail("not_found");
  const at = now();
  const isActive = !variant.isActive;
  update((state) => ({ ...state, products: state.products.map((p) => (p.id === productId ? { ...p, updatedAt: at, variants: p.variants.map((v) => (v.id === variantId ? { ...v, isActive, updatedAt: at } : v)) } : p)) }));
  logActivity({ area: "products", action: isActive ? "variant_on" : "variant_off", detail: variant.sku });
  return { ok: true, data: { sku: variant.sku, isActive } };
}

export function deleteVariant(productId: string, variantId: string): ActionResult {
  const product = getState().products.find((p) => p.id === productId);
  const variant = product?.variants.find((v) => v.id === variantId);
  if (!variant) return fail("not_found");
  const block = variantDeleteBlock(variant);
  if (block) return fail(block);
  update((state) => ({
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p)),
    movements: state.movements.filter((m) => m.variantId !== variantId),
    bag: { ...state.bag, lines: state.bag.lines.filter((l) => l.variantId !== variantId) },
  }));
  logActivity({ area: "products", action: "variant_deleted", detail: variant.sku });
  return { ok: true, data: undefined };
}

export type CollectionInput = { nameEn: string; nameDe: string; descriptionEn: string; descriptionDe: string };

const collectionProblem = (input: CollectionInput): string | null => (!input.nameEn.trim() || !input.nameDe.trim() || input.nameEn.length > 80 || input.nameDe.length > 80 ? "name" : null);

export function createCollection(input: CollectionInput): ActionResult<{ id: string; slug: string }> {
  const problem = collectionProblem(input);
  if (problem) return fail(problem);
  const s = getState();
  const slug = uniqueSlug(slugify(input.nameEn) || "collection", s.collections.map((c) => c.slug));
  const id = uid("col");
  const row: Collection = { id, slug, nameEn: input.nameEn.trim(), nameDe: input.nameDe.trim(), descriptionEn: input.descriptionEn.trim(), descriptionDe: input.descriptionDe.trim(), isActive: true, updatedAt: now() };
  update((state) => ({ ...state, collections: [...state.collections, row] }));
  logActivity({ area: "products", action: "collection_created", detail: row.nameEn });
  return { ok: true, data: { id, slug } };
}

/** The slug stays what it was, so links to the shop keep working. */
export function saveCollection(id: string, input: CollectionInput): ActionResult {
  const problem = collectionProblem(input);
  if (problem) return fail(problem);
  if (!getState().collections.some((c) => c.id === id)) return fail("not_found");
  const at = now();
  update((state) => ({ ...state, collections: state.collections.map((c) => (c.id === id ? { ...c, nameEn: input.nameEn.trim(), nameDe: input.nameDe.trim(), descriptionEn: input.descriptionEn.trim(), descriptionDe: input.descriptionDe.trim(), updatedAt: at } : c)) }));
  logActivity({ area: "products", action: "collection_saved", detail: input.nameEn.trim() });
  return { ok: true, data: undefined };
}

export function setCollectionShown(id: string, isActive: boolean): ActionResult {
  const row = getState().collections.find((c) => c.id === id);
  if (!row) return fail("not_found");
  const at = now();
  update((state) => ({ ...state, collections: state.collections.map((c) => (c.id === id ? { ...c, isActive, updatedAt: at } : c)) }));
  logActivity({ area: "products", action: isActive ? "collection_shown" : "collection_hidden", detail: row.nameEn });
  return { ok: true, data: undefined };
}

export function createTag(label: string): ActionResult<ProductTag> {
  const clean = label.trim().toLowerCase();
  if (!clean || clean.length > 30) return fail("label");
  if (getState().tags.some((t) => t.label === clean)) return fail("taken");
  const tag: ProductTag = { id: uid("tag"), label: clean };
  update((state) => ({ ...state, tags: [...state.tags, tag] }));
  logActivity({ area: "products", action: "tag_created", detail: clean });
  return { ok: true, data: tag };
}

import { SKU_PREFIX } from "@/lib/brand";
import { coloursOf, skuFor } from "@/lib/product-rules";
import type { Collection, ArtTone, ProductArtType, Order, Product, ProductCategory, ProductStatus, SizeCode, Variant } from "@/store/types";

export const PRODUCT_CATEGORIES: ProductCategory[] = ["drinkware", "lighting", "audio", "plants", "desk", "travel", "other"];
export const ART_TYPES: ProductArtType[] = ["mug", "bottle", "lamp", "notebook", "candle", "planter", "speaker", "pouch"];
export const ART_TONES: ArtTone[] = ["ice", "sky", "azure", "dusk", "lilac"];

const TYPE_CODE: Record<ProductArtType, string> = { mug: "MUG", bottle: "BTL", lamp: "LAMP", notebook: "NOTE", candle: "CNDL", planter: "PLNT", speaker: "SPK", pouch: "POUCH" };
const TONE_CODE: Record<ArtTone, string> = { ice: "ICE", sky: "SKY", azure: "AZU", dusk: "DUS", lilac: "LIL" };

/** The next SKU for a variant: the shared stem of the product's SKUs, or one built from its drawing and tone. */
export function suggestSku(product: Pick<Product, "art" | "tone" | "variants">, size: SizeCode): string {
  const main = coloursOf(product.variants)[0];
  const first = product.variants.find((v) => v.color === main);
  const suffix = size === "ONE_SIZE" ? "OS" : size;
  if (first) {
    const stem = first.sku.slice(0, first.sku.lastIndexOf("-"));
    if (stem.startsWith(SKU_PREFIX)) return `${stem}-${suffix}`;
  }
  return skuFor(TYPE_CODE[product.art], TONE_CODE[product.tone], size);
}

export const totalStock = (product: Pick<Product, "variants">): number => product.variants.reduce((sum, v) => sum + v.stock, 0);
export const reservedUnits = (product: Pick<Product, "variants">): number => product.variants.reduce((sum, v) => sum + v.reserved, 0);

/** A product stays for the order history once any variant was sold. */
export function hasOrders(product: Pick<Product, "id" | "variants">, orders: Pick<Order, "items">[]): boolean {
  return product.variants.some((v) => v.ordered > 0) || orders.some((o) => o.items.some((i) => i.productId === product.id));
}

export type VariantDeleteBlock = "ordered" | "reserved";

export function variantDeleteBlock(variant: Pick<Variant, "ordered" | "reserved">): VariantDeleteBlock | null {
  if (variant.ordered > 0) return "ordered";
  return variant.reserved > 0 ? "reserved" : null;
}

export type ProductSort = "name" | "price" | "newest" | "stock";
export const PRODUCT_SORTS: ProductSort[] = ["name", "price", "newest", "stock"];

export type ProductFilter = { q: string; collection: string; tag: string };

function matchesText(product: Product, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [product.nameEn, product.nameDe, product.slug].some((text) => text.toLowerCase().includes(needle));
}

export function filterProducts(products: Product[], filter: ProductFilter): Product[] {
  return products.filter((p) => matchesText(p, filter.q) && (!filter.collection || p.collectionIds.includes(filter.collection)) && (!filter.tag || p.tagIds.includes(filter.tag)));
}

export function sortProducts(products: Product[], sort: ProductSort, lang: "en" | "de"): Product[] {
  const name = (p: Product) => (lang === "de" ? p.nameDe : p.nameEn);
  const copy = products.slice();
  if (sort === "price") return copy.sort((a, b) => a.priceRappen - b.priceRappen || name(a).localeCompare(name(b)));
  if (sort === "newest") return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || name(a).localeCompare(name(b)));
  if (sort === "stock") return copy.sort((a, b) => totalStock(a) - totalStock(b) || name(a).localeCompare(name(b)));
  return copy.sort((a, b) => name(a).localeCompare(name(b)));
}

export function productCounts(products: Pick<Product, "status">[]): Record<ProductStatus | "all", number> {
  return {
    active: products.filter((p) => p.status === "active").length,
    draft: products.filter((p) => p.status === "draft").length,
    archived: products.filter((p) => p.status === "archived").length,
    all: products.length,
  };
}

export const collectionProductCount = (collection: Pick<Collection, "id">, products: Pick<Product, "collectionIds">[]): number => products.filter((p) => p.collectionIds.includes(collection.id)).length;

export type VariantInputProblem = "sku" | "sku_taken" | "duplicate" | "price" | "threshold" | "stock";

export function variantInputProblem(input: { sku: string; priceOverrideRappen: number | null; threshold: number | null; openingStock?: number | null }, others: Pick<Variant, "id" | "sku">[], ownId: string | null): VariantInputProblem | null {
  const sku = input.sku.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(sku)) return "sku";
  if (others.some((v) => v.id !== ownId && v.sku === sku)) return "sku_taken";
  if (input.priceOverrideRappen !== null && (!Number.isInteger(input.priceOverrideRappen) || input.priceOverrideRappen < 100)) return "price";
  if (input.threshold !== null && (!Number.isInteger(input.threshold) || input.threshold < 0)) return "threshold";
  if (input.openingStock !== undefined && (input.openingStock === null || !Number.isInteger(input.openingStock) || input.openingStock < 0 || input.openingStock > 1000)) return "stock";
  return null;
}

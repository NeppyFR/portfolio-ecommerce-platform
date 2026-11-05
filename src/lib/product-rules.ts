import type { ArtTone, Lang, Product, Rappen, SizeCode, Variant } from "@/store/types";
import { SKU_PREFIX } from "./brand";

export const SIZES: SizeCode[] = ["S", "M", "L", "XL", "ONE_SIZE"];
export const SIZE_RANGE: SizeCode[] = ["S", "M", "L", "XL"];
export const PUBLIC_STOCK_CAP = 10;

const ONE_SIZE_LABEL: Record<Lang, string> = { en: "One size", de: "Einheitsgrösse" };

export const sizeLabel = (size: SizeCode, lang: Lang): string => (size === "ONE_SIZE" ? ONE_SIZE_LABEL[lang] : size);

/** Fixed size order, then colour, then SKU. */
export function compareVariants(a: Pick<Variant, "size" | "color" | "sku">, b: Pick<Variant, "size" | "color" | "sku">): number {
  return SIZES.indexOf(a.size) - SIZES.indexOf(b.size) || a.color.localeCompare(b.color) || a.sku.localeCompare(b.sku);
}

/** Lower case, accents folded, everything else a hyphen. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(text) || "product";
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

const SIZE_SKU: Record<SizeCode, string> = { S: "S", M: "M", L: "L", XL: "XL", ONE_SIZE: "OS" };

/** `AL-` + type + tone + size, e.g. `AL-SPK-LAG-M`, `AL-NOTE-CLD-OS`. */
export const skuFor = (type: string, tone: string, size: SizeCode): string => `${SKU_PREFIX}${type}-${tone}-${SIZE_SKU[size]}`;

export const effectivePrice = (product: Pick<Product, "priceRappen">, variant: Pick<Variant, "priceOverrideRappen">): Rappen => variant.priceOverrideRappen ?? product.priceRappen;

/** What the public may see: stock minus holds, clamped to 0 to 10. */
export const publicAvailable = (v: Pick<Variant, "stock" | "reserved">): number => Math.min(PUBLIC_STOCK_CAP, Math.max(0, v.stock - v.reserved));

export const isSoldOut = (v: Pick<Variant, "stock" | "reserved">): boolean => v.stock - v.reserved <= 0;

/** Every colour a product comes in, the one most of its sizes share first. */
export function coloursOf(variants: Pick<Variant, "color">[]): string[] {
  const count = new Map<string, number>();
  for (const v of variants) count.set(v.color, (count.get(v.color) ?? 0) + 1);
  return [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
}

const COLOUR_TONE: Record<string, ArtTone> = { Cobalt: "dusk", Lagoon: "azure", Cloud: "ice", Ice: "sky", Lilac: "lilac", Frost: "lilac" };

/** The tone to draw a variant in: a second colour shows as itself, the main one as the product was drawn. */
export function toneForColour(product: { tone: ArtTone; variants: Pick<Variant, "color">[] }, color: string | null | undefined): ArtTone {
  if (!color || color === coloursOf(product.variants)[0]) return product.tone;
  return COLOUR_TONE[color] ?? product.tone;
}

export const isVariantOnSale = (product: Pick<Product, "status">, v: Pick<Variant, "isActive">): boolean => product.status === "active" && v.isActive;

export const saleVariants = (product: Product): Variant[] => (product.status === "active" ? product.variants.filter((v) => v.isActive) : []).slice().sort(compareVariants);

/** Lowest price among sizes on sale, and whether prices vary (`from`). */
export function priceRange(product: Product): { lowestRappen: Rappen; varies: boolean } {
  const prices = saleVariants(product).map((v) => effectivePrice(product, v));
  if (prices.length === 0) return { lowestRappen: product.priceRappen, varies: false };
  const lowest = Math.min(...prices);
  return { lowestRappen: lowest, varies: prices.some((p) => p !== lowest) };
}

export const isProductSoldOut = (product: Product): boolean => saleVariants(product).every(isSoldOut);

export type VariantStockState = "ok" | "low" | "out";

/** available ≤ 0 is out; available ≤ threshold (own, else the shop default) is low; otherwise ok. */
export function variantStockState(v: Pick<Variant, "stock" | "reserved" | "threshold">, lowStockDefault: number): VariantStockState {
  const available = v.stock - v.reserved;
  if (available <= 0) return "out";
  return available <= (v.threshold ?? lowStockDefault) ? "low" : "ok";
}

export type ProductInputProblem = "name" | "price";

export function productInputProblem(input: { nameEn: string; nameDe: string; priceRappen: number }): ProductInputProblem | null {
  if (!input.nameEn.trim() || !input.nameDe.trim() || input.nameEn.length > 120 || input.nameDe.length > 120) return "name";
  if (!Number.isInteger(input.priceRappen) || input.priceRappen < 100) return "price";
  return null;
}

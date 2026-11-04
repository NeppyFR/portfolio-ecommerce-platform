import { encodeCode128 } from "@/desk/commerce/orders/rules/code128";
import { effectivePrice } from "@/lib/product-rules";
import type { Product, Rappen, SizeCode, Variant } from "@/store/types";

export type LabelLayout = "a4" | "roll";

export const MAX_LABELS = 500;
export const MAX_IDS = 200;
export const MAX_COPIES = 100;
export const A4_PER_PAGE = 24;

/** Widths in millimetres that a barcode may take on each label. */
export const BAR_ROOM: Record<LabelLayout, number> = { a4: 64, roll: 56 };
export const BAR_HEIGHT: Record<LabelLayout, number> = { a4: 12, roll: 10 };
export const MODULE_WANTED = 0.3;
/** Below this a scanner starts to struggle, and the screen says so. */
export const MODULE_THIN = 0.25;

export function labelsHref(variantIds: string[], copies = 1, layout: LabelLayout = "a4"): string {
  return `/print/labels/?v=${variantIds.slice(0, MAX_IDS).map(encodeURIComponent).join(",")}&copies=${copies}&layout=${layout}`;
}

export type LabelParams = { ids: string[]; copies: number; layout: LabelLayout };

export function parseLabelParams(q: { v: string | null; copies: string | null; layout: string | null }): LabelParams {
  const ids = [...new Set((q.v ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
  const n = Number(q.copies);
  const copies = Number.isInteger(n) ? Math.min(MAX_COPIES, Math.max(1, n)) : 1;
  return { ids, copies, layout: q.layout === "roll" ? "roll" : "a4" };
}

export type LabelData = { key: string; variantId: string; nameEn: string; nameDe: string; size: SizeCode; color: string; priceRappen: Rappen; sku: string };

export type LabelBatch = { labels: LabelData[]; missing: number; requested: number; variants: number };

/** One label per copy per size, in the order asked for, capped so a page never runs away. */
export function expandLabels(params: LabelParams, products: Pick<Product, "id" | "nameEn" | "nameDe" | "priceRappen" | "variants">[]): LabelBatch {
  const index = new Map<string, { product: (typeof products)[number]; variant: Variant }>();
  for (const product of products) for (const variant of product.variants) index.set(variant.id, { product, variant });
  const found = params.ids.flatMap((id) => {
    const hit = index.get(id);
    return hit ? [hit] : [];
  });
  const labels: LabelData[] = [];
  outer: for (const { product, variant } of found) {
    for (let copy = 0; copy < params.copies; copy += 1) {
      if (labels.length >= MAX_LABELS) break outer;
      labels.push({ key: `${variant.id}:${copy}`, variantId: variant.id, nameEn: product.nameEn, nameDe: product.nameDe, size: variant.size, color: variant.color, priceRappen: effectivePrice(product, variant), sku: variant.sku });
    }
  }
  return { labels, missing: params.ids.length - found.length, requested: found.length * params.copies, variants: found.length };
}

export function paginate<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}

/** The module width that fits the room, never wider than wanted. Zero when the text cannot be encoded. */
export function moduleFor(text: string, roomMm: number, wanted: number = MODULE_WANTED): number {
  const code = encodeCode128(text);
  return code ? Math.min(wanted, roomMm / code.modules) : 0;
}

export const hasThinBarcode = (labels: Pick<LabelData, "sku">[], layout: LabelLayout): boolean => labels.some((l) => moduleFor(l.sku, BAR_ROOM[layout]) < MODULE_THIN);

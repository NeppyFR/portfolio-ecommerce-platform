import { APPAREL_SIZES, skuFor } from "@/lib/product-rules";
import { COLLECTION_TITLES, HIDDEN_COLLECTION_HANDLE, PRODUCT_TITLES } from "@/lib/routes";
import type { Collection, GarmentTone, GarmentType, Product, ProductCategory, ProductStatus, ProductTag, SizeCode, Variant } from "../types";
import { zurich } from "./rng";

type Row = {
  slug: string; nameDe: string; descEn: string; descDe: string; status: ProductStatus; category: ProductCategory; garment: GarmentType; tone: GarmentTone;
  price: number; cost: number | null; color: string; skuType: string; skuTone: string; printed?: boolean; collections: string[]; tags: string[];
  sizes: SizeCode[]; stock: number[]; overrides?: Partial<Record<SizeCode, number>>; created: string;
};

const OS: SizeCode[] = ["ONE_SIZE"];

const ROWS: Row[] = [
  { slug: "essential-hoodie-cobalt", nameDe: "Essential Hoodie, Kobalt", descEn: "Heavy brushed fleece in deep cobalt. The one you keep reaching for.", descDe: "Schwerer, angerauter Fleece in tiefem Kobalt. Der, nach dem du immer wieder greifst.", status: "active", category: "hoodie", garment: "hoodie", tone: "dusk", price: 8900, cost: 3400, color: "Cobalt", skuType: "HOOD", skuTone: "COB", collections: ["essentials"], tags: ["bestseller", "fleece"], sizes: APPAREL_SIZES, stock: [6, 14, 22, 18, 9], created: "2026-06-02" },
  { slug: "lagoon-zip-hoodie", nameDe: "Lagoon Zip-Hoodie", descEn: "A full zip in washed lagoon blue, cut a little longer in the back.", descDe: "Durchgehender Zipper in gewaschenem Lagunenblau, hinten etwas länger geschnitten.", status: "active", category: "hoodie", garment: "zip", tone: "azure", price: 11900, cost: 4800, color: "Lagoon", skuType: "ZIP", skuTone: "LAG", collections: ["lagoon"], tags: ["drop", "fleece"], sizes: APPAREL_SIZES, stock: [1, 7, 0, 11, 5], overrides: { XL: 12400 }, created: "2026-09-14" },
  { slug: "oversized-hoodie-cloud", nameDe: "Oversized Hoodie, Wolke", descEn: "Dropped shoulders and a deep hood, in a soft cloud white. Still in sampling.", descDe: "Überschnittene Schultern und eine tiefe Kapuze, in weichem Wolkenweiss. Noch in der Musterung.", status: "draft", category: "hoodie", garment: "hoodie", tone: "ice", price: 13900, cost: 5600, color: "Cloud", skuType: "OVER", skuTone: "CLD", collections: [], tags: ["sample"], sizes: APPAREL_SIZES, stock: [4, 4, 6, 6, 4], created: "2026-12-03" },
  { slug: "logo-tee-cloud", nameDe: "Logo-Tee, Wolke", descEn: "Midweight cotton with the name printed small across the chest.", descDe: "Mittelschwere Baumwolle, der Name klein auf der Brust gedruckt.", status: "active", category: "tee", garment: "tee", tone: "ice", price: 3900, cost: 1200, color: "Cloud", skuType: "TEE", skuTone: "CLD", printed: true, collections: ["essentials"], tags: ["bestseller", "cotton"], sizes: APPAREL_SIZES, stock: [12, 26, 30, 24, 10], created: "2026-06-02" },
  { slug: "logo-tee-cobalt", nameDe: "Logo-Tee, Kobalt", descEn: "The same tee in cobalt. It softens with every wash.", descDe: "Dasselbe Tee in Kobalt. Wird mit jeder Wäsche weicher.", status: "active", category: "tee", garment: "tee", tone: "dusk", price: 3900, cost: 1200, color: "Cobalt", skuType: "TEE", skuTone: "COB", collections: ["essentials"], tags: ["cotton"], sizes: APPAREL_SIZES, stock: [8, 19, 28, 21, 7], created: "2026-06-02" },
  { slug: "heavyweight-tee-lilac", nameDe: "Heavyweight-Tee, Flieder", descEn: "A boxy, heavy cotton tee in pale lilac, made for the Lagoon drop.", descDe: "Ein kastiges, schweres Baumwoll-Tee in hellem Flieder, gemacht für den Lagoon-Drop.", status: "active", category: "tee", garment: "tee", tone: "lilac", price: 4900, cost: 1700, color: "Lilac", skuType: "HVYT", skuTone: "LIL", collections: ["lagoon"], tags: ["drop", "cotton"], sizes: APPAREL_SIZES, stock: [5, 9, 13, 2, 6], created: "2026-09-14" },
  { slug: "relaxed-cargo-pants", nameDe: "Relaxed Cargo-Hose, Eis", descEn: "Roomy cargo pants in ice blue twill, with six pockets that stay flat.", descDe: "Weite Cargo-Hose aus eisblauem Twill, mit sechs Taschen, die flach bleiben.", status: "active", category: "pants", garment: "cargo", tone: "sky", price: 12900, cost: 5100, color: "Ice", skuType: "CARGO", skuTone: "ICE", collections: [], tags: ["twill"], sizes: APPAREL_SIZES, stock: [4, 8, 12, 10, 4], created: "2026-07-20" },
  { slug: "track-pants-cobalt", nameDe: "Track Pants, Kobalt", descEn: "Tapered track pants in cobalt with a soft elastic waist.", descDe: "Schmal zulaufende Track Pants in Kobalt mit weichem Gummibund.", status: "active", category: "pants", garment: "pants", tone: "dusk", price: 9900, cost: 3900, color: "Cobalt", skuType: "TRACK", skuTone: "COB", collections: ["essentials"], tags: ["fleece"], sizes: APPAREL_SIZES, stock: [5, 11, 16, 13, 6], created: "2026-06-02" },
  { slug: "logo-cap-cobalt", nameDe: "Logo-Cap, Kobalt", descEn: "Six-panel cap in cobalt cotton, adjustable at the back.", descDe: "Six-Panel-Cap aus Kobalt-Baumwolle, hinten verstellbar.", status: "active", category: "cap", garment: "cap", tone: "dusk", price: 3900, cost: 1100, color: "Cobalt", skuType: "CAP", skuTone: "COB", collections: ["accessories"], tags: ["cotton"], sizes: OS, stock: [18], created: "2026-06-02" },
  { slug: "washed-cap-lagoon", nameDe: "Washed Cap, Lagoon", descEn: "Garment-washed cap in lagoon blue. Every one fades a little differently.", descDe: "Stückgewaschene Cap in Lagunenblau. Jede verblasst ein wenig anders.", status: "active", category: "cap", garment: "cap", tone: "sky", price: 4400, cost: 1400, color: "Lagoon", skuType: "CAP", skuTone: "LAG", collections: ["accessories", "lagoon"], tags: ["drop"], sizes: OS, stock: [15], created: "2026-09-14" },
  { slug: "rib-beanie-frost", nameDe: "Rippstrick-Beanie, Frost", descEn: "A close rib-knit beanie in frost lilac, from the first drop.", descDe: "Eine eng gerippte Strick-Beanie in Frost-Flieder, aus dem ersten Drop.", status: "active", category: "beanie", garment: "beanie", tone: "lilac", price: 3400, cost: 900, color: "Frost", skuType: "BEAN", skuTone: "FRO", collections: ["accessories"], tags: ["knit"], sizes: OS, stock: [0], created: "2026-06-30" },
  { slug: "canvas-tote-cloud", nameDe: "Canvas-Tasche, Wolke", descEn: "Heavy canvas tote with long handles and the name printed on one side.", descDe: "Schwere Canvas-Tasche mit langen Henkeln und dem Namen auf einer Seite.", status: "active", category: "tote", garment: "tote", tone: "ice", price: 2900, cost: 800, color: "Cloud", skuType: "TOTE", skuTone: "CLD", printed: true, collections: ["accessories"], tags: ["cotton"], sizes: OS, stock: [24], created: "2026-06-02" },
  { slug: "frost-scarf", nameDe: "Frost-Schal", descEn: "A soft knit scarf from the Frost drop, no longer in the shop.", descDe: "Ein weicher Strickschal aus dem Frost-Drop, nicht mehr im Shop.", status: "archived", category: "other", garment: "tote", tone: "lilac", price: 4500, cost: null, color: "Frost", skuType: "SCARF", skuTone: "FRO", collections: [HIDDEN_COLLECTION_HANDLE], tags: ["knit"], sizes: OS, stock: [6], created: "2026-06-30" },
];

const tagId = (label: string) => `tag_${label}`;
const collectionId = (handle: string) => `col_${handle}`;
const productId = (slug: string) => `prod_${slug}`;
const variantId = (slug: string, size: SizeCode) => `var_${slug}_${size.toLowerCase()}`;

export const TAG_LABELS = ["bestseller", "drop", "fleece", "cotton", "knit"];

export function createTags(): ProductTag[] {
  return TAG_LABELS.map((label) => ({ id: tagId(label), label }));
}

const COLLECTION_TEXT: Record<string, { de: string; descEn: string; descDe: string }> = {
  essentials: { de: "Essentials", descEn: "Everyday basics.", descDe: "Basics für jeden Tag." },
  lagoon: { de: "Lagoon", descEn: "The live drop, in lagoon blue and pale lilac.", descDe: "Der laufende Drop, in Lagunenblau und hellem Flieder." },
  accessories: { de: "Accessoires", descEn: "Caps, beanies and bags.", descDe: "Caps, Beanies und Taschen." },
  [HIDDEN_COLLECTION_HANDLE]: { de: "Frost-Archiv", descEn: "Pieces from the first drop, kept out of the shop's menus.", descDe: "Stücke aus dem ersten Drop, ausserhalb der Shop-Menüs." },
};

export function createCollections(): Collection[] {
  return Object.keys(COLLECTION_TITLES).map((handle) => ({
    id: collectionId(handle),
    slug: handle,
    nameEn: COLLECTION_TITLES[handle],
    nameDe: COLLECTION_TEXT[handle].de,
    descriptionEn: COLLECTION_TEXT[handle].descEn,
    descriptionDe: COLLECTION_TEXT[handle].descDe,
    isActive: handle !== HIDDEN_COLLECTION_HANDLE,
    updatedAt: zurich("2026-12-01", 10),
  }));
}

export function createProducts(): Product[] {
  return ROWS.map((row) => {
    const id = productId(row.slug);
    const stamp = zurich(row.created, 10);
    const variants: Variant[] = row.sizes.map((size, i) => ({
      id: variantId(row.slug, size),
      productId: id,
      size,
      color: row.color,
      sku: skuFor(row.skuType, row.skuTone, size),
      priceOverrideRappen: row.overrides?.[size] ?? null,
      threshold: null,
      isActive: true,
      stock: row.stock[i],
      reserved: 0,
      ordered: 0,
      updatedAt: stamp,
    }));
    return {
      id,
      slug: row.slug,
      nameEn: PRODUCT_TITLES[row.slug],
      nameDe: row.nameDe,
      descriptionEn: row.descEn,
      descriptionDe: row.descDe,
      status: row.status,
      category: row.category,
      priceRappen: row.price,
      costRappen: row.cost,
      garment: row.garment,
      tone: row.tone,
      printedName: row.printed ?? false,
      collectionIds: row.collections.map(collectionId),
      tagIds: row.tags.filter((t) => TAG_LABELS.includes(t)).map(tagId),
      variants,
      createdAt: stamp,
      updatedAt: stamp,
      publishedAt: row.status === "draft" ? null : stamp,
    };
  });
}

export { collectionId, productId, tagId, variantId };

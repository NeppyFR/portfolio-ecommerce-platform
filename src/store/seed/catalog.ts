import { SIZE_RANGE, skuFor } from "@/lib/product-rules";
import { COLLECTION_TITLES, HIDDEN_COLLECTION_HANDLE, PRODUCT_TITLES } from "@/lib/routes";
import type { ArtTone, Collection, Product, ProductArtType, ProductCategory, ProductStatus, ProductTag, SizeCode, Variant } from "../types";
import { zurich } from "./rng";

/** A small run in a second colour, sold in one size next to the range. Its stock is the first number in `stock`. */
type SecondRun = { color: string; skuTone: string };

type Row = {
  slug: string; nameDe: string; descEn: string; descDe: string; status: ProductStatus; category: ProductCategory; art: ProductArtType; tone: ArtTone;
  price: number; cost: number | null; color: string; skuType: string; skuTone: string; second?: SecondRun; printed?: boolean; collections: string[]; tags: string[];
  sizes: SizeCode[]; stock: number[]; overrides?: Partial<Record<SizeCode, number>>; created: string;
};

const OS: SizeCode[] = ["ONE_SIZE"];
const SECOND_RUN_SIZE: SizeCode = "S";

const ROWS: Row[] = [
  { slug: "desk-lamp", nameDe: "Schreibtischlampe", descEn: "A steady, warm light with a shade you can tilt. The one you keep reaching for.", descDe: "Ruhiges, warmes Licht mit einem neigbaren Schirm. Die, nach der du immer wieder greifst.", status: "active", category: "lighting", art: "lamp", tone: "dusk", price: 8900, cost: 3400, color: "Cobalt", skuType: "LAMP", skuTone: "COB", second: { color: "Frost", skuTone: "FRO" }, collections: ["essentials"], tags: ["bestseller", "metal"], sizes: SIZE_RANGE, stock: [6, 14, 22, 18, 9], created: "2026-06-02" },
  { slug: "lagoon-speaker", nameDe: "Lagoon-Lautsprecher", descEn: "A small speaker in glazed lagoon blue, with more bass than it looks.", descDe: "Kleiner Lautsprecher in glasiertem Lagunenblau, mit mehr Bass, als man ihm ansieht.", status: "active", category: "audio", art: "speaker", tone: "azure", price: 11900, cost: 4800, color: "Lagoon", skuType: "SPK", skuTone: "LAG", second: { color: "Ice", skuTone: "ICE" }, collections: ["lagoon"], tags: ["drop", "metal"], sizes: SIZE_RANGE, stock: [1, 7, 0, 11, 5], overrides: { XL: 12400 }, created: "2026-09-14" },
  { slug: "tall-lamp", nameDe: "Hohe Lampe", descEn: "A tall reading lamp with a deep shade, in a soft cloud white. Still in sampling.", descDe: "Hohe Leselampe mit tiefem Schirm, in weichem Wolkenweiss. Noch in der Musterung.", status: "draft", category: "lighting", art: "lamp", tone: "ice", price: 13900, cost: 5600, color: "Cloud", skuType: "TALL", skuTone: "CLD", second: { color: "Lilac", skuTone: "LIL" }, collections: [], tags: ["sample"], sizes: SIZE_RANGE, stock: [0, 1, 1, 0, 0], created: "2026-12-03" },
  { slug: "logo-mug", nameDe: "Logo-Tasse", descEn: "Thick-walled stoneware with the name printed small on the side.", descDe: "Dickwandiges Steinzeug, der Name klein auf der Seite gedruckt.", status: "active", category: "drinkware", art: "mug", tone: "ice", price: 3900, cost: 1200, color: "Cloud", skuType: "MUG", skuTone: "CLD", second: { color: "Ice", skuTone: "ICE" }, printed: true, collections: ["essentials"], tags: ["bestseller", "recycled"], sizes: SIZE_RANGE, stock: [12, 26, 30, 24, 10], created: "2026-06-02" },
  { slug: "studio-mug", nameDe: "Studio-Tasse", descEn: "A plain mug in cobalt glaze. It gets better with every coffee.", descDe: "Schlichte Tasse mit Kobaltglasur. Wird mit jedem Kaffee besser.", status: "active", category: "drinkware", art: "mug", tone: "dusk", price: 3900, cost: 1200, color: "Cobalt", skuType: "MUG", skuTone: "COB", second: { color: "Lilac", skuTone: "LIL" }, collections: ["essentials"], tags: ["recycled"], sizes: SIZE_RANGE, stock: [8, 19, 28, 21, 7], created: "2026-06-02" },
  { slug: "trail-bottle", nameDe: "Trail-Flasche", descEn: "A light steel bottle in pale lilac, made for the Lagoon drop.", descDe: "Leichte Stahlflasche in hellem Flieder, gemacht für den Lagoon-Drop.", status: "active", category: "drinkware", art: "bottle", tone: "lilac", price: 4900, cost: 1700, color: "Lilac", skuType: "BTL", skuTone: "LIL", second: { color: "Cloud", skuTone: "CLD" }, collections: ["lagoon"], tags: ["drop", "recycled"], sizes: SIZE_RANGE, stock: [5, 9, 13, 2, 6], created: "2026-09-14" },
  { slug: "stoneware-planter", nameDe: "Steinzeug-Topf", descEn: "A roomy planter in ice blue stoneware, with a drain tray that stays out of sight.", descDe: "Grosser Pflanztopf aus eisblauem Steinzeug, mit einem Untersetzer, den man nicht sieht.", status: "active", category: "plants", art: "planter", tone: "sky", price: 12900, cost: 5100, color: "Ice", skuType: "PLNT", skuTone: "ICE", second: { color: "Cloud", skuTone: "CLD" }, collections: [], tags: ["stoneware"], sizes: SIZE_RANGE, stock: [4, 8, 12, 10, 4], created: "2026-07-20" },
  { slug: "shelf-speaker", nameDe: "Regal-Lautsprecher", descEn: "A compact speaker in cobalt that sits on a shelf and fills the room.", descDe: "Kompakter Lautsprecher in Kobalt, steht im Regal und füllt den Raum.", status: "active", category: "audio", art: "speaker", tone: "dusk", price: 9900, cost: 3900, color: "Cobalt", skuType: "SHELF", skuTone: "COB", second: { color: "Lagoon", skuTone: "LAG" }, collections: ["essentials"], tags: ["metal"], sizes: SIZE_RANGE, stock: [5, 11, 16, 13, 6], created: "2026-06-02" },
  { slug: "travel-pouch-cobalt", nameDe: "Reise-Etui, Kobalt", descEn: "A flat zip pouch in cobalt for cables and chargers, with a wrist loop.", descDe: "Flaches Etui mit Reissverschluss in Kobalt, für Kabel und Ladegeräte, mit Handschlaufe.", status: "active", category: "travel", art: "pouch", tone: "dusk", price: 3900, cost: 1100, color: "Cobalt", skuType: "POUCH", skuTone: "COB", collections: ["desk-and-travel"], tags: ["recycled"], sizes: OS, stock: [18], created: "2026-06-02" },
  { slug: "zip-pouch-lagoon", nameDe: "Zip-Etui, Lagoon", descEn: "A water-resistant pouch in lagoon blue. Every one takes on its own patina.", descDe: "Wasserabweisendes Etui in Lagunenblau. Jedes bekommt mit der Zeit seine eigene Patina.", status: "active", category: "travel", art: "pouch", tone: "sky", price: 4400, cost: 1400, color: "Lagoon", skuType: "POUCH", skuTone: "LAG", collections: ["desk-and-travel", "lagoon"], tags: ["drop"], sizes: OS, stock: [15], created: "2026-09-14" },
  { slug: "frost-candle", nameDe: "Frost-Kerze", descEn: "A slow soy candle in frost lilac, from the first drop.", descDe: "Langsam brennende Sojakerze in Frost-Flieder, aus dem ersten Drop.", status: "active", category: "lighting", art: "candle", tone: "lilac", price: 3400, cost: 900, color: "Frost", skuType: "CNDL", skuTone: "FRO", collections: ["desk-and-travel"], tags: ["wax"], sizes: OS, stock: [0], created: "2026-06-30" },
  { slug: "logo-notebook-cloud", nameDe: "Logo-Notizbuch, Wolke", descEn: "A hard-cover notebook with thick paper and the name printed on the cover.", descDe: "Notizbuch mit festem Einband, dickem Papier und dem Namen auf dem Umschlag.", status: "active", category: "desk", art: "notebook", tone: "ice", price: 2900, cost: 800, color: "Cloud", skuType: "NOTE", skuTone: "CLD", printed: true, collections: ["desk-and-travel"], tags: ["recycled"], sizes: OS, stock: [24], created: "2026-06-02" },
  { slug: "frost-candle-trio", nameDe: "Frost-Kerzentrio", descEn: "Three small candles from the Frost drop, no longer in the shop.", descDe: "Drei kleine Kerzen aus dem Frost-Drop, nicht mehr im Shop.", status: "archived", category: "other", art: "candle", tone: "lilac", price: 4500, cost: null, color: "Frost", skuType: "TRIO", skuTone: "FRO", collections: [HIDDEN_COLLECTION_HANDLE], tags: ["wax"], sizes: OS, stock: [6], created: "2026-06-30" },
];

const tagId = (label: string) => `tag_${label}`;
const collectionId = (handle: string) => `col_${handle}`;
const productId = (slug: string) => `prod_${slug}`;
/** The second-run colour only joins the id when it is a second run, so the range keeps short ids. */
const variantId = (slug: string, size: SizeCode, secondColor?: string) => `var_${slug}_${size.toLowerCase()}${secondColor ? `_${secondColor.toLowerCase()}` : ""}`;

export const TAG_LABELS = ["bestseller", "drop", "metal", "recycled", "wax"];

export function createTags(): ProductTag[] {
  return TAG_LABELS.map((label) => ({ id: tagId(label), label }));
}

const COLLECTION_TEXT: Record<string, { de: string; descEn: string; descDe: string }> = {
  essentials: { de: "Essentials", descEn: "Things you use every day.", descDe: "Dinge für jeden Tag." },
  lagoon: { de: "Lagoon", descEn: "The live drop, in lagoon blue and pale lilac.", descDe: "Der laufende Drop, in Lagunenblau und hellem Flieder." },
  "desk-and-travel": { de: "Schreibtisch und Reise", descEn: "Pouches, candles and notebooks.", descDe: "Etuis, Kerzen und Notizbücher." },
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
    const slots = [
      ...(row.second ? [{ size: SECOND_RUN_SIZE, color: row.second.color, skuTone: row.second.skuTone, second: row.second.color }] : []),
      ...row.sizes.map((size) => ({ size, color: row.color, skuTone: row.skuTone, second: undefined })),
    ];
    const variants: Variant[] = slots.map((slot, i) => ({
      id: variantId(row.slug, slot.size, slot.second),
      productId: id,
      size: slot.size,
      color: slot.color,
      sku: skuFor(row.skuType, slot.skuTone, slot.size),
      priceOverrideRappen: row.overrides?.[slot.size] ?? null,
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
      art: row.art,
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

import { PHONE, TEAM, customerEmail } from "@/lib/brand";
import type { Campaign, Discount, DiscountScope, DiscountType, Drop, Person, Product, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, SizeCode, Supplier, WaitlistEntry } from "../types";
import { productId, variantId } from "./catalog";
import { type Rng, zurich } from "./rng";

type DiscountRow = { code: string; type: DiscountType; value: number; min: number; limit: number | null; start: string | null; end: string | null; on: boolean; description: string; reason: string; scope?: DiscountScope };

const DISCOUNT_ROWS: DiscountRow[] = [
  { code: "LAUNCH15", type: "percent", value: 15, min: 0, limit: null, start: "2026-09-14", end: null, on: true, description: "Launch of the Lagoon drop", reason: "launch" },
  { code: "WELCOME10", type: "fixed", value: 1000, min: 6000, limit: null, start: "2026-07-01", end: null, on: true, description: "First order, CHF 10 off from CHF 60", reason: "welcome" },
  { code: "FREESHIP", type: "free_shipping", value: 0, min: 5000, limit: null, start: "2026-08-01", end: null, on: true, description: "Free shipping from CHF 50", reason: "shipping" },
  { code: "SUMMER20", type: "percent", value: 20, min: 0, limit: null, start: "2026-07-01", end: "2026-11-30", on: true, description: "End of summer sale", reason: "sale" },
  { code: "FRIENDS10", type: "percent", value: 10, min: 0, limit: 10, start: "2026-08-15", end: null, on: true, description: "Friends of the studio, ten uses", reason: "friends" },
  { code: "AUTUMN25", type: "percent", value: 25, min: 0, limit: 100, start: "2027-02-01", end: "2027-02-28", on: true, description: "Planned stock clearance", reason: "sale" },
  { code: "STAFF30", type: "percent", value: 30, min: 0, limit: null, start: "2026-07-01", end: null, on: false, description: "Team purchases, switched off for now", reason: "staff" },
];

export function createDiscounts(): Discount[] {
  return DISCOUNT_ROWS.map((row, i) => ({
    id: `dis_${i + 1}`,
    code: row.code,
    type: row.type,
    value: row.value,
    scope: row.scope ?? "all",
    productIds: [],
    collectionIds: [],
    minOrderRappen: row.min,
    usageLimit: row.limit,
    startDay: row.start,
    endDay: row.end,
    isEnabled: row.on,
    description: row.description,
    reason: row.reason,
    timesUsed: 0,
    redeemedRappen: 0,
    lastUsedAt: null,
    updatedAt: zurich(row.start && row.start < "2026-12-15" ? row.start : "2026-12-15", 9),
  }));
}

const WAIT_NAMES = ["Sina Ott", "Malik Arnold", "Eva Zeller", "Robin Stucki", "Mona Kern", "Cyril Weber", "Ida Lang", "Joel Frey", "Tessa Maurer", "Nils Huber", "Olivia Aebersold", "Sven Gut", "Maya Rohner", "Leon Bosshard", "Jana Studer"];

function waitlist(rng: Rng, count: number, productIds: (string | null)[], sizes: (SizeCode | null)[], toldShare: number, start: number): WaitlistEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const name = WAIT_NAMES[(start + i) % WAIT_NAMES.length];
    const [first, last] = name.split(" ");
    const told = rng.chance(toldShare);
    return {
      id: `wl_${start + i + 1}`,
      email: customerEmail(first, last),
      name,
      productId: rng.pick(productIds),
      size: rng.pick(sizes),
      notifiedAt: told ? zurich("2026-12-18", 10, rng.int(0, 59)) : null,
    };
  });
}

export function createDrops(rng: Rng): Drop[] {
  const frost = ["rib-beanie-frost", "frost-scarf"].map(productId);
  const lagoon = ["lagoon-zip-hoodie", "heavyweight-tee-lilac", "washed-cap-lagoon"].map(productId);
  const aurora = [productId("oversized-hoodie-cloud")];
  return [
    { id: "drop_frost", name: "Frost", season: "S1", status: "archived", launchOn: "2026-07-03", launchAt: zurich("2026-07-03", 18), description: "The first drop: knitwear in frost lilac, made in a small run.", productIds: frost, waitlist: waitlist(rng, 4, [frost[0]], [null], 1, 0), updatedAt: zurich("2026-11-02", 9) },
    { id: "drop_lagoon", name: "Lagoon", season: "S2", status: "live", launchOn: "2026-09-18", launchAt: zurich("2026-09-18", 18), description: "Washed blues and pale lilac for the end of summer.", productIds: lagoon, waitlist: waitlist(rng, 12, [lagoon[0], lagoon[1]], ["XS", "M", "L"], 0.25, 4), updatedAt: zurich("2026-12-10", 15) },
    { id: "drop_aurora", name: "Aurora", season: "S3", status: "planned", launchOn: "2027-01-17", launchAt: zurich("2027-01-17", 18), description: "An oversized hoodie in cloud white and a first colour run for spring.", productIds: aurora, waitlist: waitlist(rng, 14, [aurora[0], null], ["M", "L", null], 0, 16), updatedAt: zurich("2027-01-05", 11) },
    { id: "drop_cirrus", name: "Cirrus", season: "S4", status: "planned", launchOn: null, launchAt: null, description: "Lightweight layers. The idea is set; the date is not.", productIds: [], waitlist: [], updatedAt: zurich("2026-12-20", 14) },
  ];
}

export function createSuppliers(): Supplier[] {
  const row = (id: string, name: string, contact: string, domain: string, country: string, notes: string, isActive = true): Supplier => ({
    id, name, contactName: contact, email: `orders@${domain}.example.com`, phone: PHONE, country, notes, isActive,
  });
  return [
    row("sup_lago", "Tessuti Lago", "Giulia Conti", "tessuti-lago", "IT", "Fleece and twill. Proforma first, 30 percent deposit."),
    row("sup_knit", "Knit Studio", "Ana Pereira", "knit-studio", "PT", "Samples and knitwear. Two weeks for a lab dip."),
    row("sup_pack", "Pack and Print", "Tom Vogt", "pack-and-print", "CH", "Boxes, tissue and swing tags."),
    row("sup_nord", "Studio Nord", "Elin Berg", "studio-nord", "DE", "Screen printing for the name on tees and totes."),
    row("sup_alt", "Filati Sud", "Marta Rizzo", "filati-sud", "IT", "Used for the first knit run. Not in use any more.", false),
  ];
}

type PoRow = { n: number; kind: "production" | "sample"; status: PurchaseOrderStatus; currency: string; supplier: string; drop: string | null; ordered: string | null; expected: string | null; received: string | null; notes: string; ship: number; ledger?: string; lines: [string, SizeCode, number, number, number][] };

const PO_ROWS: PoRow[] = [
  { n: 1, kind: "production", status: "received", currency: "EUR", supplier: "sup_alt", drop: "drop_frost", ordered: "2026-05-04", expected: "2026-06-15", received: "2026-06-18", notes: "First knit run.", ship: 8500, ledger: "led_po_1", lines: [["rib-beanie-frost", "ONE_SIZE", 40, 820, 40], ["frost-scarf", "ONE_SIZE", 20, 1400, 20]] },
  { n: 2, kind: "production", status: "received", currency: "EUR", supplier: "sup_lago", drop: "drop_lagoon", ordered: "2026-07-06", expected: "2026-08-24", received: "2026-08-27", notes: "Zip hoodies for Lagoon.", ship: 14000, ledger: "led_po_2", lines: [["lagoon-zip-hoodie", "S", 20, 4300, 20], ["lagoon-zip-hoodie", "M", 30, 4300, 30], ["lagoon-zip-hoodie", "L", 25, 4300, 25]] },
  { n: 3, kind: "sample", status: "ordered", currency: "CHF", supplier: "sup_knit", drop: "drop_aurora", ordered: "2026-12-28", expected: "2027-01-15", received: null, notes: "Fit samples, third round.", ship: 1800, lines: [["oversized-hoodie-cloud", "M", 2, 8500, 0]] },
  { n: 4, kind: "production", status: "received", currency: "CHF", supplier: "sup_nord", drop: null, ordered: "2026-10-20", expected: "2026-11-20", received: "2026-11-24", notes: "Restock of the logo tees. The invoice still needs booking.", ship: 0, lines: [["logo-tee-cloud", "M", 30, 1150, 30], ["logo-tee-cobalt", "M", 30, 1150, 30]] },
  { n: 5, kind: "production", status: "in_production", currency: "EUR", supplier: "sup_lago", drop: "drop_aurora", ordered: "2026-12-07", expected: "2027-01-14", received: null, notes: "Aurora hoodies. Three days before launch is tight.", ship: 12000, lines: [["oversized-hoodie-cloud", "S", 25, 5100, 0], ["oversized-hoodie-cloud", "M", 40, 5100, 0], ["oversized-hoodie-cloud", "L", 35, 5100, 0]] },
  { n: 6, kind: "production", status: "shipped", currency: "CHF", supplier: "sup_lago", drop: "drop_lagoon", ordered: "2026-11-23", expected: "2027-01-12", received: null, notes: "Second run of the zip hoodie, sizes that sold out first.", ship: 9500, lines: [["lagoon-zip-hoodie", "XS", 15, 4700, 0], ["lagoon-zip-hoodie", "M", 25, 4700, 0]] },
  { n: 7, kind: "production", status: "draft", currency: "EUR", supplier: "sup_knit", drop: "drop_cirrus", ordered: null, expected: null, received: null, notes: "Knit tops, waiting for the sample.", ship: 0, lines: [["rib-beanie-frost", "ONE_SIZE", 50, 780, 0]] },
  { n: 8, kind: "production", status: "cancelled", currency: "CHF", supplier: "sup_pack", drop: null, ordered: "2026-09-02", expected: "2026-09-30", received: null, notes: "Tote run dropped after the price came in too high.", ship: 0, lines: [["canvas-tote-cloud", "ONE_SIZE", 100, 790, 0]] },
];

export function createPurchaseOrders(products: Product[]): PurchaseOrder[] {
  const variantOf = (slug: string, size: SizeCode) => {
    const product = products.find((p) => p.slug === slug);
    const variant = product?.variants.find((v) => v.id === variantId(slug, size));
    if (!product || !variant) throw new Error(`Seed: no variant ${slug} ${size}`);
    return { product, variant };
  };
  return PO_ROWS.map((row) => {
    const lines: PurchaseOrderLine[] = row.lines.map(([slug, size, quantity, unit, received], i) => {
      const { product, variant } = variantOf(slug, size);
      return { id: `pol_${row.n}_${i + 1}`, variantId: variant.id, productName: product.nameEn, size, sku: variant.sku, quantity, unitCostMinor: unit, receivedQuantity: received };
    });
    return {
      id: `po_${row.n}`,
      number: `PO-${String(row.n).padStart(4, "0")}`,
      kind: row.kind,
      status: row.status,
      currency: row.currency,
      supplierId: row.supplier,
      dropId: row.drop,
      orderedOn: row.ordered,
      expectedOn: row.expected,
      receivedAt: row.received ? zurich(row.received, 11) : null,
      notes: row.notes,
      financeEntryId: row.ledger ?? null,
      shippingMinor: row.ship,
      lines,
    };
  });
}

export function createCampaigns(discounts: Discount[]): Campaign[] {
  const code = (c: string) => discounts.find((d) => d.code === c)?.id ?? null;
  const owner = (p: Person) => TEAM.find((m) => m.profile === p)?.profile ?? null;
  const row = (id: number, name: string, channel: Campaign["channel"], status: Campaign["status"], startsOn: string | null, endsOn: string | null, products: string[], discountId: string | null, who: Person | null, notes: string): Campaign => ({
    id: `cam_${id}`, name, channel, status, startsOn, endsOn, productIds: products.map(productId), discountId, owner: who, notes, updatedAt: zurich("2027-01-04", 10),
  });
  return [
    row(1, "Aurora teaser posts", "instagram", "scheduled", "2027-01-11", "2027-01-16", ["oversized-hoodie-cloud"], null, owner("studio"), "Three posts, one reel. Plain cloud backdrop."),
    row(2, "Aurora launch mail", "newsletter", "scheduled", "2027-01-17", "2027-01-17", ["oversized-hoodie-cloud"], null, owner("owner"), "Goes out by hand at 18:00. Waitlist first."),
    row(3, "Lagoon restock note", "website", "scheduled", "2027-01-06", "2027-01-20", ["lagoon-zip-hoodie"], null, owner("warehouse"), "Short banner while the second run arrives."),
    row(4, "Studio sample sale", "in_person", "draft", null, null, ["frost-scarf"], null, owner("owner"), "One Saturday in spring, leftovers and samples."),
    row(5, "Short fit videos", "tiktok", "draft", "2027-02-01", null, ["track-pants-cobalt", "relaxed-cargo-pants"], null, null, "Idea: one person, three sizes."),
    row(6, "Lagoon launch", "instagram", "completed", "2026-09-14", "2026-09-20", ["lagoon-zip-hoodie", "heavyweight-tee-lilac", "washed-cap-lagoon"], code("LAUNCH15"), owner("studio"), "Code ran with the launch."),
    row(7, "End of summer sale", "other", "completed", "2026-11-16", "2026-11-30", [], code("SUMMER20"), owner("finance"), "Mail, site banner and stories."),
  ];
}

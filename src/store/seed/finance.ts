import { addMonths } from "@/lib/dates";
import { VAT_REDUCED_BP, VAT_STANDARD_BP, VAT_ZERO_BP, vatIncluded } from "@/lib/vat";
import { DEMO_MONTH } from "../clock";
import type { Account, Cost, CostBooking, EntrySource, FxRate, LedgerCategory, LedgerEntry, Order, Person, PlanMeter, PricePlan, Product, Rappen, Receipt, ReportGroup, StockCount, StockCountLine, StockMove } from "../types";
import { plusMinutes, type Rng, zurich } from "./rng";

const STAMP = zurich("2026-01-05", 9);
const PRICE_SOURCE = "public price page, as of 28.10.2026";
const PRICE_SOURCE_CAP = "public price page, as of 29.10.2026";

export function createAccounts(): Account[] {
  return [
    { id: "acc_bank", name: "Bank", kind: "bank", openingRappen: 150000, openingOn: "2026-01-01", isActive: true, updatedAt: STAMP },
    { id: "acc_stripe", name: "Stripe", kind: "stripe", openingRappen: 0, openingOn: "2026-01-01", isActive: true, updatedAt: STAMP },
    { id: "acc_cash", name: "Cash", kind: "cash", openingRappen: 20000, openingOn: "2026-01-01", isActive: true, updatedAt: STAMP },
    { id: "acc_old", name: "Old savings", kind: "bank", openingRappen: 35000, openingOn: "2026-01-01", isActive: false, updatedAt: STAMP },
  ];
}

const CATEGORY_ROWS: [string, string, string, LedgerCategory["kind"], ReportGroup | null][] = [
  ["shop-sales", "Shop sales", "Shop-Verkäufe", "income", null],
  ["other-income", "Other income", "Andere Einnahmen", "income", null],
  ["production-samples", "Production & samples", "Produktion & Muster", "expense", "production"],
  ["packaging-shipping", "Packaging & shipping", "Verpackung & Versand", "expense", "shipping"],
  ["software-hosting", "Software & hosting", "Software & Hosting", "expense", "administration"],
  ["payment-fees", "Payment fees", "Zahlungsgebühren", "expense", "administration"],
  ["marketing", "Marketing", "Marketing", "expense", "other"],
  ["legal-admin", "Legal & admin", "Recht & Administration", "expense", "administration"],
  ["taxes-duties", "Taxes & duties", "Steuern & Zölle", "expense", "administration"],
  ["equipment", "Equipment", "Ausrüstung", "expense", "equipment"],
  ["partner-deposit", "Partner deposit", "Einlage Partner", "transfer", null],
  ["partner-withdrawal", "Partner withdrawal", "Bezug Partner", "transfer", null],
  ["vat-settlement", "VAT settlement", "MWST-Abrechnung", "transfer", null],
  ["other", "Other", "Anderes", "expense", "other"],
];

export function createCategories(): LedgerCategory[] {
  return CATEGORY_ROWS.map(([slug, nameEn, nameDe, kind, group]) => ({ id: `cat_${slug}`, slug, nameEn, nameDe, kind, group, isActive: true }));
}

const meter = (key: string, labelEn: string, labelDe: string, unit: string, included: number, per: number, priceMicro: number | null, hardLimit: boolean, main: boolean, stops: number[]): PlanMeter => ({ key, labelEn, labelDe, unit, included, per, priceMicro, hardLimit, main, stops, defaultValue: 0 });

const DISK: [string, string] = ["Database disk (GB)", "Datenbank-Speicher (GB)"];
const FILES: [string, string] = ["File storage (GB)", "Dateispeicher (GB)"];
const EGRESS: [string, string] = ["Egress (GB)", "Ausgehender Verkehr (GB)"];
const CACHED: [string, string] = ["Cached egress (GB)", "Ausgehender Verkehr aus dem Cache (GB)"];
const MAU: [string, string] = ["Monthly active users", "Monatlich aktive Nutzer"];
const EMAILS: [string, string] = ["Emails a month", "E-Mails pro Monat"];

const proMeters = (capped: boolean): PlanMeter[] => [
  meter("disk_gb", ...DISK, "gb", 8, 1, capped ? null : 125000, capped, true, [0, 1, 2, 4, 8, 16, 32, 64]),
  meter("storage_gb", ...FILES, "gb", 100, 1, capped ? null : 21300, capped, false, [0, 1, 5, 10, 50, 100, 200, 500]),
  meter("egress_gb", ...EGRESS, "gb", 250, 1, capped ? null : 90000, capped, false, [0, 5, 10, 50, 100, 250, 500, 1000]),
  meter("cached_egress_gb", ...CACHED, "gb", 250, 1, capped ? null : 30000, capped, false, [0, 5, 10, 50, 100, 250, 500, 1000]),
  meter("mau", ...MAU, "mau", 100000, 1, capped ? null : 3250, capped, false, [0, 100, 1000, 10000, 100000, 200000, 500000]),
];

/** Public list prices. The demo's choice among them is invented. */
export function createPricePlans(): PricePlan[] {
  const plan = (key: string, service: PricePlan["service"], label: string, sort: number, baseMinor: number, seatMinor: number | null, creditMinor: number, meters: PlanMeter[], note: string, source = PRICE_SOURCE, asOf = "2026-10-28"): PricePlan => ({
    id: `plan_${key}`, key, service, label, sort, currency: "USD", baseMinor, seatMinor, creditMinor, meters, note, source, asOf, isActive: true,
  });
  return [
    plan("r2-standard", "r2", "R2 Standard", 10, 0, null, 0, [
      meter("storage_gb", "Stored data (GB)", "Gespeicherte Daten (GB)", "gb", 10, 1, 15000, false, true, [0, 10, 100, 1000]),
      meter("class_a", "Class A operations", "Klasse-A-Operationen", "ops", 1_000_000, 1_000_000, 4_500_000, false, false, [0, 1_000_000, 10_000_000]),
      meter("class_b", "Class B operations", "Klasse-B-Operationen", "ops", 10_000_000, 1_000_000, 360_000, false, false, [0, 10_000_000, 100_000_000]),
    ], "Free tier per account, shared with the backups bucket. Egress is free."),
    plan("supabase-free", "supabase", "Supabase Free", 20, 0, null, 0, [
      meter("disk_gb", ...DISK, "gb", 0.5, 1, null, true, true, [0, 0.1, 0.25, 0.5, 1, 2]),
      meter("storage_gb", ...FILES, "gb", 1, 1, null, true, false, [0, 0.25, 0.5, 1, 2, 5]),
      meter("egress_gb", ...EGRESS, "gb", 5, 1, null, true, false, [0, 1, 2, 5, 10, 20]),
      meter("cached_egress_gb", ...CACHED, "gb", 5, 1, null, true, false, [0, 1, 2, 5, 10, 20]),
      meter("mau", ...MAU, "mau", 50000, 1, null, true, false, [0, 100, 1000, 10000, 50000, 100000]),
    ], "Pauses after 1 week without activity; no backups; 2 active projects."),
    plan("supabase-pro-cap", "supabase", "Supabase Pro (spend cap on)", 25, 2500, null, 0, proMeters(true), "Spend cap on, the provider's default: usage above the quota is restricted, not billed.", PRICE_SOURCE_CAP, "2026-10-29"),
    plan("supabase-pro", "supabase", "Supabase Pro (spend cap off)", 30, 2500, null, 0, proMeters(false), "Spend cap off: usage above the quota is billed at these prices. Includes a USD 10 compute credit, which covers one Micro instance."),
    plan("vercel-hobby", "vercel", "Vercel Hobby", 40, 0, null, 0, [], "Personal, non-commercial use only: not allowed for the shop."),
    plan("vercel-pro", "vercel", "Vercel Pro", 50, 0, 2000, 2000, [
      meter("data_transfer_gb", "Data transfer (GB)", "Datenübertragung (GB)", "gb", 1000, 1, 150000, false, false, [0, 1, 10, 50, 100, 500, 1000, 2000, 5000]),
      meter("cdn_requests", "CDN requests", "CDN-Anfragen", "requests", 10_000_000, 1_000_000, 2_000_000, false, false, [0, 100_000, 1_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000]),
    ], "USD 20 per paid seat; viewers are free. Includes a USD 20 usage credit. Functions, Active CPU and memory are not modelled (their included amounts are not in the price data)."),
    plan("resend-free", "resend", "Resend Free", 60, 0, null, 0, [meter("emails", ...EMAILS, "emails", 3000, 1000, null, true, true, [0, 100, 500, 1000, 2000, 3000, 5000, 10000])], "100 emails a day, 3 domains, no overage: a drop day with more than 100 orders holds back confirmations."),
    plan("resend-pro-50k", "resend", "Resend Pro 50k", 70, 2000, null, 0, [meter("emails", ...EMAILS, "emails", 50000, 1000, 900_000, false, true, [0, 1000, 5000, 10000, 25000, 50000, 75000, 100000, 200000])], "Overage USD 0.90 per 1,000 emails."),
    plan("resend-pro-100k", "resend", "Resend Pro 100k", 80, 3500, null, 0, [meter("emails", ...EMAILS, "emails", 100000, 1000, 900_000, false, true, [0, 1000, 10000, 50000, 100000, 150000, 200000, 500000])], "Overage USD 0.90 per 1,000 emails."),
  ];
}

export function createFxRates(): FxRate[] {
  return [
    { currency: "USD", chfPpm: 800_000, asOf: "2026-12-01", source: "public rate table", note: "Checked by hand" },
    { currency: "EUR", chfPpm: 940_000, asOf: null, source: "", note: "Placeholder, not checked" },
  ];
}

type CostRow = { id: string; label: string; vendor: string; service: Cost["service"]; billing: Cost["billing"]; expected: number; currency: string; plan: string | null; usage: Record<string, number>; note: string; starts: string | null };

const COST_ROWS: CostRow[] = [
  { id: "cost_app", label: "App host", vendor: "Vercel Inc.", service: "vercel", billing: "monthly", expected: 2000, currency: "USD", plan: "plan_vercel-pro", usage: { seats: 1 }, note: "One paid seat.", starts: "2026-01-01" },
  { id: "cost_db", label: "Database", vendor: "Supabase Inc.", service: "supabase", billing: "monthly", expected: 2500, currency: "USD", plan: "plan_supabase-pro-cap", usage: {}, note: "Spend cap on.", starts: "2026-01-01" },
  { id: "cost_files", label: "File storage", vendor: "Cloudflare Inc.", service: "r2", billing: "monthly", expected: 200, currency: "USD", plan: "plan_r2-standard", usage: { storage_gb: 140 }, note: "Files and backups; drifts a little.", starts: "2026-01-01" },
  { id: "cost_mail", label: "Mail sender", vendor: "Resend Inc.", service: "resend", billing: "monthly", expected: 2000, currency: "USD", plan: "plan_resend-pro-50k", usage: { emails: 4000 }, note: "Pro plan, far below the quota.", starts: "2026-01-01" },
  { id: "cost_assistant", label: "Inbox assistant", vendor: "Anthropic", service: "claude", billing: "monthly", expected: 2000, currency: "USD", plan: null, usage: {}, note: "Sorts the support mail once an hour.", starts: "2026-01-01" },
  { id: "cost_dns", label: "DNS", vendor: "Cloudflare Inc.", service: "cloudflare", billing: "monthly", expected: 0, currency: "USD", plan: null, usage: {}, note: "Free plan.", starts: "2026-01-01" },
  { id: "cost_code", label: "Code host", vendor: "GitHub Inc.", service: "github", billing: "monthly", expected: 0, currency: "USD", plan: null, usage: {}, note: "Free plan.", starts: "2026-01-01" },
  { id: "cost_domain", label: "Domain", vendor: "Example registrar", service: "domain", billing: "yearly", expected: 2400, currency: "CHF", plan: null, usage: {}, note: "Renews every March.", starts: "2026-03-15" },
];

const SOFTWARE = "cat_software-hosting";

export function createCosts(): Cost[] {
  return COST_ROWS.map((row) => ({
    id: row.id, label: row.label, vendor: row.vendor, service: row.service, billing: row.billing, expectedMinor: row.expected, currency: row.currency,
    startsOn: row.starts, endsOn: null, categoryId: SOFTWARE, accountId: "acc_bank", note: row.note, state: "active", isEstimate: row.plan !== null || row.expected === 0, planId: row.plan, usage: row.usage, updatedAt: STAMP,
  }));
}

type EntryInput = { amount: Rappen; title: string; on: string; description?: string; counterparty?: string; category: string | null; account: string | null; drop?: string | null; originalMinor?: number | null; currency?: string | null; source?: EntrySource; ref?: string | null; receipts?: string[]; by?: Person; id?: string; vat?: number };

function entry(input: EntryInput, index: number, rng: Rng): LedgerEntry {
  const created = zurich(input.on, 17, rng.int(0, 59));
  const receipts: Receipt[] = (input.receipts ?? []).map((name, i) => ({ id: `rc_${index}_${i + 1}`, name, sizeBytes: rng.int(60, 620) * 1000 }));
  return {
    id: input.id ?? `led_${index}`,
    amountRappen: input.amount,
    title: input.title,
    occurredOn: input.on,
    description: input.description ?? "",
    counterparty: input.counterparty ?? "",
    categoryId: input.category,
    accountId: input.account,
    dropId: input.drop ?? null,
    originalAmountMinor: input.originalMinor ?? null,
    originalCurrency: input.currency ?? null,
    vatRateBp: input.vat ?? null,
    vatRappen: input.vat === undefined ? null : vatIncluded(input.amount, input.vat),
    source: input.source ?? "manual",
    externalRef: input.ref ?? null,
    receipts,
    createdBy: input.by ?? "finance",
    createdAt: created,
    updatedAt: created,
  };
}

function monthlyGross(orders: Order[], month: string): Rappen {
  return orders.filter((o) => o.paidAt && o.paidAt.slice(0, 7) === month).reduce((sum, o) => sum + o.totalRappen - o.refundedRappen, 0);
}

const MANUAL: EntryInput[] = [
  { amount: 500000, title: "Studio lead's starting deposit", on: "2026-01-03", category: "cat_partner-deposit", account: "acc_bank", counterparty: "Mara Keller", by: "owner" },
  { amount: -82000, title: "Sample run, first knit tests", on: "2026-02-10", category: "cat_production-samples", account: "acc_bank", counterparty: "Filati Sud", drop: "drop_frost", receipts: ["sample-run-knit.pdf"] },
  { amount: -46000, title: "Label and swing tag design", on: "2026-02-24", category: "cat_production-samples", account: "acc_bank", counterparty: "Studio Nord" },
  { amount: -38500, title: "Terms of sale, legal check", on: "2026-03-09", category: "cat_legal-admin", account: "acc_bank", counterparty: "Example notary", receipts: ["terms-legal-check.pdf"] },
  { amount: -72000, title: "Shelving and a label printer", on: "2026-03-20", category: "cat_equipment", account: "acc_bank", counterparty: "Example supplies", receipts: ["shelving-printer.pdf"] },
  { amount: -68000, title: "Frost production deposit", on: "2026-05-04", category: "cat_production-samples", account: "acc_bank", counterparty: "Filati Sud", drop: "drop_frost", originalMinor: 72300, currency: "EUR" },
  { amount: -94000, title: "Frost production final", on: "2026-06-18", category: "cat_production-samples", account: "acc_bank", counterparty: "Filati Sud", drop: "drop_frost", originalMinor: 100000, currency: "EUR", id: "led_po_1", source: "production", receipts: ["po-0001-invoice.pdf"] },
  { amount: -21500, title: "Mailing boxes, first batch", on: "2026-06-22", category: "cat_packaging-shipping", account: "acc_bank", counterparty: "Pack and Print" },
  { amount: -34000, title: "Launch shoot, Frost", on: "2026-06-26", category: "cat_marketing", account: "acc_bank", drop: "drop_frost", counterparty: "Example photographer" },
  { amount: -900, title: "Parcel tape", on: "2026-07-02", category: null, account: "acc_cash", description: "Paid in cash, category still open." },
  { amount: 260000, title: "Second deposit for Lagoon", on: "2026-07-01", category: "cat_partner-deposit", account: "acc_bank", counterparty: "Mara Keller", by: "owner" },
  { amount: -191000, title: "Lagoon production deposit", on: "2026-07-06", category: "cat_production-samples", account: "acc_bank", counterparty: "Tessuti Lago", drop: "drop_lagoon", originalMinor: 203200, currency: "EUR", receipts: ["lagoon-deposit.pdf"] },
  { amount: -309000, title: "Lagoon production final", on: "2026-08-27", category: "cat_production-samples", account: "acc_bank", counterparty: "Tessuti Lago", drop: "drop_lagoon", originalMinor: 328700, currency: "EUR", id: "led_po_2", source: "production", receipts: ["po-0002-invoice.pdf"] },
  { amount: -28800, title: "Mailing boxes, second batch", on: "2026-09-01", category: "cat_packaging-shipping", account: "acc_bank", counterparty: "Pack and Print" },
  { amount: -52000, title: "Lagoon lookbook shoot", on: "2026-09-08", category: "cat_marketing", account: "acc_bank", drop: "drop_lagoon", counterparty: "Example photographer", receipts: ["lagoon-shoot.pdf"], vat: VAT_STANDARD_BP },
  { amount: -14900, title: "Customs on the Lagoon delivery", on: "2026-09-02", category: "cat_taxes-duties", account: "acc_bank", counterparty: "Customs", drop: "drop_lagoon", receipts: ["customs-lagoon.pdf"] },
  { amount: -12000, title: "Trade register fee", on: "2026-09-15", category: "cat_legal-admin", account: "acc_bank", counterparty: "Example registry" },
  { amount: 18500, title: "Sold leftover fabric", on: "2026-09-21", category: "cat_other-income", account: "acc_cash", counterparty: "Studio Nord", vat: VAT_STANDARD_BP },
  { amount: -60000, title: "Partner withdrawal, October", on: "2026-10-05", category: "cat_partner-withdrawal", account: "acc_bank", counterparty: "Nico Steiner" },
  { amount: -19900, title: "Scanner and label rolls", on: "2026-10-12", category: "cat_equipment", account: "acc_bank", counterparty: "Example supplies" },
  { amount: -8800, title: "Fit samples, Aurora", on: "2026-10-14", category: "cat_production-samples", account: "acc_bank", counterparty: "Knit Studio", drop: "drop_aurora" },
  { amount: -35900, title: "Tissue paper and stickers", on: "2026-11-05", category: "cat_packaging-shipping", account: "acc_bank", counterparty: "Pack and Print", vat: VAT_STANDARD_BP },
  { amount: -24500, title: "End of summer sale ads", on: "2026-11-16", category: "cat_marketing", account: "acc_stripe", counterparty: "Example ad network", vat: VAT_STANDARD_BP },
  { amount: -17200, title: "Fit samples, second round", on: "2026-11-27", category: "cat_production-samples", account: "acc_bank", counterparty: "Knit Studio", drop: "drop_aurora", receipts: ["fit-samples-2.pdf"], vat: VAT_ZERO_BP },
  { amount: -9800, title: "Insurance, half year", on: "2026-12-01", category: "cat_legal-admin", account: "acc_bank", counterparty: "Example insurer", vat: VAT_ZERO_BP },
  { amount: -41000, title: "Aurora production deposit", on: "2026-12-07", category: "cat_production-samples", account: "acc_bank", counterparty: "Tessuti Lago", drop: "drop_aurora", originalMinor: 43600, currency: "EUR", receipts: ["aurora-deposit.pdf"] },
  { amount: -13400, title: "Parcel surcharge, peak season", on: "2026-12-30", category: "cat_packaging-shipping", account: "acc_bank", counterparty: "Beispielpost", vat: VAT_STANDARD_BP },
  { amount: -6500, title: "Coffee for the stock count", on: "2027-01-04", category: "cat_other", account: "acc_cash", vat: VAT_REDUCED_BP },
  { amount: -11900, title: "Mailing boxes, top-up", on: "2027-01-06", category: "cat_packaging-shipping", account: "acc_bank", counterparty: "Pack and Print" },
];

export type FinanceBuild = { entries: LedgerEntry[]; bookings: CostBooking[] };

/** 120 entries: running-cost bookings, monthly payouts and fees, and manual rows across a year. */
export function buildLedger(rng: Rng, orders: Order[]): FinanceBuild {
  const inputs: EntryInput[] = [...MANUAL];
  const bookings: CostBooking[] = [];

  const paying = COST_ROWS.filter((c) => c.expected > 0 && c.billing === "monthly");
  for (let m = 0; m < 12; m += 1) {
    const month = addMonths("2026-01", m);
    for (const cost of paying) {
      const original = cost.id === "cost_files" ? cost.expected + rng.int(-40, 60) : cost.expected;
      const charged = Math.round((original * (790_000 + rng.int(0, 25_000))) / 1_000_000);
      const on = `${month}-${String(4 + (paying.indexOf(cost) % 5)).padStart(2, "0")}`;
      const entryId = `led_rec_${cost.id}_${month}`;
      inputs.push({ id: entryId, amount: -charged, title: `${cost.label} · ${month}`, on, counterparty: cost.vendor, category: SOFTWARE, account: "acc_bank", originalMinor: original, currency: cost.currency, source: "recurring", ref: `recurring:${cost.id}:${month}` });
      bookings.push({ id: `bk_${cost.id}_${month}`, costId: cost.id, month, amountRappen: charged, originalMinor: original, currency: cost.currency, occurredOn: on, entryId });
    }
  }
  for (const cost of paying) {
    if (cost.id === "cost_assistant") continue;
    const charged = Math.round((cost.expected * 802_000) / 1_000_000);
    const on = `${DEMO_MONTH}-05`;
    const entryId = `led_rec_${cost.id}_${DEMO_MONTH}`;
    inputs.push({ id: entryId, amount: -charged, title: `${cost.label} · ${DEMO_MONTH}`, on, counterparty: cost.vendor, category: SOFTWARE, account: "acc_bank", originalMinor: cost.expected, currency: cost.currency, source: "recurring", ref: `recurring:${cost.id}:${DEMO_MONTH}` });
    bookings.push({ id: `bk_${cost.id}_${DEMO_MONTH}`, costId: cost.id, month: DEMO_MONTH, amountRappen: charged, originalMinor: cost.expected, currency: cost.currency, occurredOn: on, entryId });
  }
  inputs.push({ id: "led_rec_cost_domain_2026-03", amount: -2400, title: "Domain · 2026-03", on: "2026-03-15", counterparty: "Example registrar", category: SOFTWARE, account: "acc_bank", source: "recurring", ref: "recurring:cost_domain:2026-03", receipts: ["domain-renewal.pdf"] });
  bookings.push({ id: "bk_cost_domain_2026-03", costId: "cost_domain", month: "2026-03", amountRappen: 2400, originalMinor: 2400, currency: "CHF", occurredOn: "2026-03-15", entryId: "led_rec_cost_domain_2026-03" });

  const payoutMonths = ["2026-10", "2026-11", "2026-12"];
  for (const month of payoutMonths) {
    const net = monthlyGross(orders, month);
    const fee = Math.round(net * 0.029) + 30 * orders.filter((o) => o.paidAt && o.paidAt.slice(0, 7) === month).length;
    const on = `${addMonths(month, 1)}-02`;
    inputs.push({ amount: net - fee, title: `Payout ${month}`, on, description: "Net of fees and refunds.", counterparty: "Stripe", category: "cat_shop-sales", account: "acc_bank", source: "payout", ref: `payout:${month}`, receipts: month === "2026-12" ? ["payout-2026-12.pdf"] : [] });
    inputs.push({ amount: -Math.round(fee * 0.1), title: `Fee adjustment ${month}`, on, counterparty: "Stripe", category: "cat_payment-fees", account: "acc_stripe" });
  }
  for (const [month, amount] of [["2026-07", 86000], ["2026-08", 112000], ["2026-09", 241000]] as [string, number][]) {
    inputs.push({ amount, title: `Payout ${month}`, on: `${addMonths(month, 1)}-02`, description: "Net of fees and refunds.", counterparty: "Stripe", category: "cat_shop-sales", account: "acc_bank", source: "payout", ref: `payout:${month}` });
  }

  const sorted = inputs.sort((a, b) => a.on.localeCompare(b.on));
  const fillersNeeded = 120 - sorted.length;
  for (let i = 0; i < fillersNeeded; i += 1) {
    const month = addMonths("2026-06", i % 7);
    sorted.push({ amount: -rng.int(8, 60) * 100, title: `Counter postage, small parcels ${i + 1}`, on: `${month}-${String(10 + (i % 18)).padStart(2, "0")}`, category: "cat_packaging-shipping", account: "acc_cash", counterparty: "Beispielpost" });
  }
  if (sorted.length !== 120) throw new Error(`Seed: ${sorted.length} ledger entries, wanted 120`);
  sorted.sort((a, b) => a.on.localeCompare(b.on));
  return { entries: sorted.map((input, i) => entry(input, i + 1, rng)), bookings };
}

/** Year-end sums need the stock at the cutoff, so these lines read the seeded movement chain. */
export function createStockCounts(products: Product[], movements: StockMove[], orders: Order[]): StockCount[] {
  const cutoff = zurich("2027-01-01", 0);
  const stockAtCutoff = (variantId: string, current: number) => current - movements.filter((m) => m.variantId === variantId && m.createdAt >= cutoff).reduce((sum, m) => sum + m.delta, 0);
  const toShip = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "paid" && order.status !== "packed") continue;
    for (const item of order.items) toShip.set(item.variantId, (toShip.get(item.variantId) ?? 0) + item.quantity - item.shortfall);
  }
  const variants = products.filter((p) => p.status !== "draft").flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));

  const draftLines: StockCountLine[] = variants.map(({ product, variant }, i) => {
    const system = stockAtCutoff(variant.id, variant.stock);
    const counted = i % 5 === 4 ? null : Math.max(0, system + (toShip.get(variant.id) ?? 0) + (i % 11 === 3 ? 1 : i % 13 === 5 ? -1 : 0));
    return {
      id: `scl_2026_${i + 1}`, variantId: variant.id, productName: product.nameEn, size: variant.size, color: variant.color, sku: variant.sku, systemQty: system, counted,
      toShip: counted === null ? 0 : toShip.get(variant.id) ?? 0, stockAtCount: counted === null ? null : variant.stock, productCostRappen: product.costRappen, typedCostRappen: product.costRappen === null ? 1600 : null, sizeDeleted: false,
    };
  });
  const belowZero = draftLines.find((line) => line.counted !== null && line.systemQty > 0);
  if (belowZero) Object.assign(belowZero, { counted: 0, toShip: 1, stockAtCount: belowZero.systemQty });
  draftLines.push({ id: "scl_2026_gone", variantId: null, productName: "Frost Scarf", size: "ONE_SIZE", color: "Ash", sku: "AL-SCARF-ASH-OS", systemQty: 2, counted: 2, toShip: 0, stockAtCount: 2, productCostRappen: null, typedCostRappen: null, sizeDeleted: true });

  const confirmedLines: StockCountLine[] = variants.filter(({ product }) => product.publishedAt !== null && product.publishedAt < zurich("2026-07-01", 0)).map(({ product, variant }, i) => {
    const counted = 10 + ((i * 7) % 24);
    return {
      id: `scl_2025_${i + 1}`, variantId: variant.id, productName: product.nameEn, size: variant.size, color: variant.color, sku: variant.sku, systemQty: counted, counted,
      toShip: 0, stockAtCount: counted, productCostRappen: product.costRappen, typedCostRappen: product.costRappen === null ? 1500 : null, sizeDeleted: false,
    };
  });

  return [
    { id: "count_2026", year: 2026, status: "draft", startedOn: "2027-01-04", startedBy: "finance", confirmedAt: null, confirmedBy: null, lines: draftLines },
    { id: "count_2025", year: 2025, status: "confirmed", startedOn: "2026-01-03", startedBy: "finance", confirmedAt: plusMinutes(zurich("2026-01-09", 16), 0), confirmedBy: "owner", lines: confirmedLines },
  ];
}

import { describe, expect, it } from "vitest";
import {
  awaitsBooking, campaignInputProblem, campaignTiming, compareDrops, comparePoNewest, countdown, dropInputProblem, incomingByVariant, landedCostPerPiece, landedUnitCost, launchMs, matchesPoFilter, nextLaunch,
  nextPoNumber, parseWaitlist, percent, poInputProblem, poTotals, seesDropMoney, seesDropNumbers, seesWaitlistAddresses, sellThrough, suggestSku, takesCostPrices, toReceive, upcomingCount, variantDeleteBlock, variantInputProblem, zurichInstant, zurichWallClock,
} from "@/desk/commerce/products/rules";
import { chfShort, inventoryCsv, marginPercent, orderItemsCsv, ordersCsv, rangeText, roundDelta, summaryCsv, type CsvWords } from "@/desk/growth/analytics/rules";
import { DEMO_NOW_MS } from "@/store/clock";
import { getState } from "@/store/core";
import type { Drop, PurchaseOrder, PurchaseOrderLine } from "@/store/types";

const line = (over: Partial<PurchaseOrderLine>): PurchaseOrderLine => ({ id: "l", variantId: "v", productName: "P", size: "M", sku: "AL-X-M", quantity: 10, unitCostMinor: 1000, receivedQuantity: 0, ...over });

describe("sell-through and percent", () => {
  it("is sold over sold plus what is available", () => {
    expect(sellThrough(62, 38)).toBeCloseTo(0.62);
    expect(percent(sellThrough(62, 38))).toBe("62 %");
  });
  it("treats negative availability as zero and shows a dash when both are empty", () => {
    expect(sellThrough(6, -3)).toBe(1);
    expect(sellThrough(0, 0)).toBeNull();
    expect(percent(null)).toBe("–");
  });
});

describe("countdown", () => {
  it("counts whole days, hours and minutes to the launch", () => {
    const launch = Date.parse("2027-01-17T18:00:00+01:00");
    expect(countdown(DEMO_NOW_MS, launch)).toEqual({ past: false, days: 9, hours: 3, minutes: 58 });
  });
  it("says past once the launch has gone by", () => {
    const launch = Date.parse("2027-01-08T13:00:00+01:00");
    expect(countdown(DEMO_NOW_MS, launch)).toEqual({ past: true, days: 0, hours: 1, minutes: 2 });
  });
});

describe("Zurich wall clock", () => {
  it("reads and builds winter and summer times", () => {
    expect(zurichWallClock("2027-01-17T17:00:00.000Z")).toEqual({ day: "2027-01-17", time: "18:00" });
    expect(zurichInstant("2027-01-17", "18:00")).toBe("2027-01-17T17:00:00.000Z");
    expect(zurichInstant("2026-07-03", "18:00")).toBe("2026-07-03T16:00:00.000Z");
  });
  it("lands right on the day the clocks change", () => {
    expect(zurichInstant("2027-03-28", "18:00")).toBe("2027-03-28T16:00:00.000Z");
    expect(zurichInstant("2026-10-25", "18:00")).toBe("2026-10-25T17:00:00.000Z");
  });
});

describe("waitlist parser", () => {
  it("splits on comma, semicolon or tab and lower-cases addresses", () => {
    const { entries, invalid } = parseWaitlist("ANNA.MUSTER@example.com\nben.test@example.com, m\ncara.probe@example.com;XL;Cara Probe\ndan.wil@example.com\tone size\tDan Wil");
    expect(invalid).toEqual([]);
    expect(entries).toEqual([
      { email: "anna.muster@example.com", size: null, name: "" },
      { email: "ben.test@example.com", size: "M", name: "" },
      { email: "cara.probe@example.com", size: "XL", name: "Cara Probe" },
      { email: "dan.wil@example.com", size: "ONE_SIZE", name: "Dan Wil" },
    ]);
  });
  it("counts a line twice once, and hands back what it cannot read", () => {
    const { entries, invalid } = parseWaitlist("a.b@example.com\na.b@example.com\n\nnot an address\nc.d@example.com, GIANT");
    expect(entries).toHaveLength(1);
    expect(invalid).toEqual(["not an address", "c.d@example.com, GIANT"]);
  });
});

describe("drop rules", () => {
  it("validates the form", () => {
    expect(dropInputProblem({ name: " ", launchOn: null, launchTime: null })).toBe("name");
    expect(dropInputProblem({ name: "Aurora", launchOn: null, launchTime: "18:00" })).toBe("time");
    expect(dropInputProblem({ name: "Aurora", launchOn: "2027-01-17", launchTime: "6pm" })).toBe("time_format");
    expect(dropInputProblem({ name: "Aurora", launchOn: "2027-01-17", launchTime: "18:00" })).toBeNull();
  });
  it("sorts no date first, then the latest launch, ties by name", () => {
    const names = (["2026-01-01", null, "2027-01-01", "2027-01-01"] as (string | null)[]).map((launchOn, i) => ({ launchOn, name: ["D", "C", "B", "A"][i] })).sort(compareDrops).map((d) => d.name);
    expect(names).toEqual(["C", "A", "B", "D"]);
  });
  it("finds the nearest planned launch still ahead", () => {
    const row = (id: string, status: Drop["status"], launchOn: string | null, launchAt: string | null) => ({ id, name: id, season: "", status, launchOn, launchAt, description: "", productIds: [], waitlist: [], updatedAt: "" }) as Drop;
    const drops = [row("past", "planned", "2026-01-01", null), row("far", "planned", "2027-06-01", null), row("near", "planned", "2027-01-20", "2027-01-20T17:00:00.000Z"), row("live", "live", "2027-01-10", null), row("none", "planned", null, null)];
    expect(nextLaunch(drops, DEMO_NOW_MS)?.id).toBe("near");
    expect(launchMs({ launchAt: null, launchOn: null })).toBeNull();
  });
  it("names the seeded launch", () => {
    expect(nextLaunch(getState().drops, DEMO_NOW_MS)?.name).toBe("Aurora");
  });
  it("hides numbers and addresses by profile", () => {
    expect(seesDropMoney("owner", [])).toBe(true);
    expect(seesDropMoney("finance", [])).toBe(true);
    expect(seesDropMoney("studio", [])).toBe(false);
    expect(seesDropMoney("warehouse", [])).toBe(false);
    expect(seesDropNumbers("owner", [])).toBe(true);
    expect(seesDropNumbers("studio", [])).toBe(false);
    expect(seesDropNumbers("warehouse", [])).toBe(false);
    expect(seesWaitlistAddresses("owner")).toBe(true);
    expect(seesWaitlistAddresses("studio")).toBe(false);
  });
});

describe("production rules", () => {
  it("adds goods and shipping", () => {
    const totals = poTotals([line({ quantity: 10, unitCostMinor: 1000, receivedQuantity: 4 }), line({ quantity: 5, unitCostMinor: 2000 })], 3000);
    expect(totals).toEqual({ goodsMinor: 20000, shippingMinor: 3000, totalMinor: 23000, units: 15, receivedUnits: 4 });
  });
  it("spreads shipping over the pieces", () => {
    expect(landedUnitCost(1000, 15, 3000)).toBe(1200);
    expect(landedCostPerPiece(poTotals([line({ quantity: 10, unitCostMinor: 1000 })], 500))).toBe(1050);
    expect(landedCostPerPiece(poTotals([], 500))).toBeNull();
  });
  it("numbers from the highest so far", () => {
    expect(nextPoNumber([{ number: "PO-0003" }, { number: "PO-0008" }])).toBe("PO-0009");
    expect(nextPoNumber([])).toBe("PO-0001");
  });
  it("takes cost prices only from production orders in CHF", () => {
    expect(takesCostPrices({ kind: "production", currency: "CHF" })).toBe(true);
    expect(takesCostPrices({ kind: "sample", currency: "CHF" })).toBe(false);
    expect(takesCostPrices({ kind: "production", currency: "EUR" })).toBe(false);
  });
  it("books the outstanding pieces and skips deleted sizes", () => {
    const lines = [line({ variantId: "a", quantity: 10, receivedQuantity: 3 }), line({ variantId: "gone", sku: "AL-GONE-M", quantity: 5 }), line({ variantId: "b", quantity: 2, receivedQuantity: 2 })];
    expect(toReceive(lines, (id) => id !== "gone")).toEqual({ pieces: 7, skipped: ["AL-GONE-M"] });
  });
  it("feeds Inventory's incoming only from open orders", () => {
    const po = (status: PurchaseOrder["status"], lines: PurchaseOrderLine[]) => ({ status, lines }) as PurchaseOrder;
    const incoming = incomingByVariant([po("shipped", [line({ variantId: "a", quantity: 10, receivedQuantity: 4 })]), po("ordered", [line({ variantId: "a", quantity: 1 })]), po("draft", [line({ variantId: "b" })]), po("received", [line({ variantId: "c" })])]);
    expect([...incoming]).toEqual([["a", 7]]);
  });
  it("marks a received, unlinked order with a cost as not booked yet", () => {
    const base: Pick<PurchaseOrder, "status" | "financeEntryId" | "lines" | "shippingMinor"> = { status: "received", financeEntryId: null, lines: [line({})], shippingMinor: 0 };
    expect(awaitsBooking(base)).toBe(true);
    expect(awaitsBooking({ ...base, financeEntryId: "x" })).toBe(false);
    expect(awaitsBooking({ ...base, status: "shipped" })).toBe(false);
    expect(awaitsBooking({ ...base, lines: [] })).toBe(false);
  });
  it("validates the order form and filters and sorts the list", () => {
    expect(poInputProblem({ supplierId: "", orderedOn: null, expectedOn: null, shippingMinor: 0 })).toBe("supplier");
    expect(poInputProblem({ supplierId: "s", orderedOn: "2027-01-08", expectedOn: "2027-01-01", shippingMinor: 0 })).toBe("dates");
    expect(poInputProblem({ supplierId: "s", orderedOn: null, expectedOn: null, shippingMinor: Number.NaN })).toBe("shipping");
    expect(matchesPoFilter("in_production", "open")).toBe(true);
    expect(matchesPoFilter("draft", "open")).toBe(false);
    expect(matchesPoFilter("draft", "draft")).toBe(true);
    expect(matchesPoFilter("cancelled", "all")).toBe(true);
    expect([{ number: "PO-0001" }, { number: "PO-0003" }].sort(comparePoNewest)[0].number).toBe("PO-0003");
  });
});

describe("campaign rules", () => {
  it("reads timing inclusive at both ends", () => {
    expect(campaignTiming(null, null, "2027-01-08")).toBe("undated");
    expect(campaignTiming("2027-01-09", null, "2027-01-08")).toBe("upcoming");
    expect(campaignTiming("2027-01-08", "2027-01-08", "2027-01-08")).toBe("running");
    expect(campaignTiming(null, "2027-01-07", "2027-01-08")).toBe("past");
    expect(campaignTiming(null, "2027-01-08", "2027-01-08")).toBe("running");
  });
  it("counts upcoming as everything not completed", () => {
    expect(upcomingCount([{ status: "draft" }, { status: "scheduled" }, { status: "completed" }])).toBe(2);
  });
  it("refuses a reversed date range", () => {
    expect(campaignInputProblem({ name: "x", startsOn: "2027-02-01", endsOn: "2027-01-01", notes: "" })).toBe("dates");
    expect(campaignInputProblem({ name: " ", startsOn: null, endsOn: null, notes: "" })).toBe("name");
    expect(campaignInputProblem({ name: "x", startsOn: null, endsOn: null, notes: "y".repeat(2001) })).toBe("notes");
  });
});

describe("catalogue rules", () => {
  it("suggests a SKU from the product's own stem", () => {
    const [product] = getState().products.filter((p) => p.slug === "lagoon-speaker");
    expect(suggestSku(product, "ONE_SIZE")).toBe("AL-SPK-LAG-OS");
    expect(suggestSku({ art: "notebook", tone: "ice", variants: [] }, "ONE_SIZE")).toBe("AL-NOTE-ICE-OS");
  });
  it("blocks deleting a size that sold or sits in a checkout", () => {
    expect(variantDeleteBlock({ ordered: 1, reserved: 0 })).toBe("ordered");
    expect(variantDeleteBlock({ ordered: 0, reserved: 1 })).toBe("reserved");
    expect(variantDeleteBlock({ ordered: 0, reserved: 0 })).toBeNull();
  });
  it("names the wrong field on a size", () => {
    expect(variantInputProblem({ sku: "a b", priceOverrideRappen: null, threshold: null }, [], null)).toBe("sku");
    expect(variantInputProblem({ sku: "AL-X", priceOverrideRappen: null, threshold: null }, [{ id: "1", sku: "AL-X" }], null)).toBe("sku_taken");
    expect(variantInputProblem({ sku: "AL-X", priceOverrideRappen: 50, threshold: null }, [], null)).toBe("price");
    expect(variantInputProblem({ sku: "AL-X", priceOverrideRappen: null, threshold: -1 }, [], null)).toBe("threshold");
    expect(variantInputProblem({ sku: "AL-X", priceOverrideRappen: null, threshold: null, openingStock: 1001 }, [], null)).toBe("stock");
  });
});

describe("analytics helpers and CSV", () => {
  const words = new Proxy({}, { get: (_, key) => String(key) }) as CsvWords;
  const range = { from: "2026-12-01", to: "2026-12-31" };

  it("rounds and shortens", () => {
    expect(roundDelta(12.345)).toBe(12.3);
    expect(roundDelta(null)).toBeNull();
    expect(marginPercent(2500, 10000)).toBe(25);
    expect(marginPercent(0, 0)).toBeNull();
    expect(chfShort(128400)).toBe("1'284");
    expect(chfShort(1250000)).toBe("12.5k");
    expect(rangeText(range)).toBe("01.12.2026 – 31.12.2026");
  });
  it("writes Swiss Excel CSV with a totals row", () => {
    const csv = summaryCsv(getState().orders, range, words);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = csv.trimEnd().split("\r\n");
    expect(rows).toHaveLength(1 + 31 + 1);
    expect(rows[0]).toContain('"day";"orders";"revenue"');
    expect(rows[rows.length - 1].startsWith('"total";')).toBe(true);
    expect(csv).toMatch(/"\d+\.\d{2}"/);
  });
  it("has one row per paid order and per line, and guards formula cells", () => {
    const state = getState();
    const orders = ordersCsv(state.orders, range, words).trimEnd().split("\r\n");
    const items = orderItemsCsv(state.orders, state.products, range, words, (c) => c).trimEnd().split("\r\n");
    expect(orders.length).toBeGreaterThan(1);
    expect(items.length).toBeGreaterThanOrEqual(orders.length);
  });
  it("lists every size with its units sold in the range", () => {
    const state = getState();
    const rows = inventoryCsv(state.orders, state.products, range, words).trimEnd().split("\r\n");
    expect(rows).toHaveLength(1 + state.products.reduce((sum, p) => sum + p.variants.length, 0));
  });
});

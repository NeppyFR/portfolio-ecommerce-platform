import { beforeEach, describe, expect, it } from "vitest";
import { getState, resetStore } from "@/store/core";
import { addReceipts, bookCost, confirmCount, costProblem, createEntry, deleteEntry, discardCount, reopenCount, saveAccount, saveCategory, saveCountLines, savePlanDraft, saveRate, setVatEnabled, startCount, unbookCost } from "@/store/actions/finance";
import { DEMO_MONTH, DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { monthlyRunningCost } from "@/store/selectors";
import { filterEntries, moneyInOut, NO_FILTER, openingTotal, readEntryDraft, runningBalances, suggestedVat, takesVat, type EntryDraft, bookBalance, accountBalance, notOnAccount } from "@/desk/finance/rules/ledger";
import { scenarioUsage, planSliders as planSlidersOf, includedStopIndex as includedStop, activationStartsOn, cashOnHand, clampSlider, evaluatePlan, formatMicro, formatQuantity, formatRate, freeTierLeft, includedStopIndex, lastBillRate, lastTwelve, measureStorage, normaliseDraft, parseQuantity, planSliders, plannerTotals, rowCost, runway, stopIndexFor, storageQuantities, toRappen } from "@/desk/finance/rules/planner";
import { defaultPeriod, financeCsv, periodColumns, periodLabel, periodOptions, reportLineOf, reportTable, showsYearEnd, vatSummary } from "@/desk/finance/rules/report";
import { openReturnsIn, refundRows, refundsCsv, refundsIn, summariseRefunds } from "@/desk/finance/rules/refunds";
import { canConfirmYet, confirmRefusal, countableYear, countTotals, cutoffIso, expectedOnShelf, lineOrder, lineSums, liveFigures, parseCounted, parseTypedCost, stockCountCsv, withCounted } from "@/desk/finance/rules/stock-count";
import type { Cost, PricePlan, StockCount, StockCountLine } from "@/store/types";

const plan = (key: string): PricePlan => getState().pricePlans.find((p) => p.key === key) as PricePlan;

beforeEach(() => resetStore());

describe("evaluatePlan worked checks", () => {
  it("app host pro, 1 seat, no overage: USD 20.00, CHF 16.00 at 0.80", () => {
    const r = evaluatePlan(plan("vercel-pro"), { seats: 1 });
    expect(r.totalMinor).toBe(2000);
    expect(toRappen(r.totalMinor, "USD", [{ currency: "USD", chfPpm: 800_000, asOf: null, source: "", note: "" }])).toBe(1600);
  });
  it("app host pro, 3 seats, 1500 GB, 25M requests: USD 145.00, CHF 116.00", () => {
    const r = evaluatePlan(plan("vercel-pro"), { seats: 3, data_transfer_gb: 1500, cdn_requests: 25_000_000 });
    expect(r.seatsMinor).toBe(6000);
    expect(r.usageMinor).toBe(10500);
    expect(r.creditUsedMinor).toBe(2000);
    expect(r.totalMinor).toBe(14500);
    expect(toRappen(14500, "USD", getState().fxRates)).toBe(11600);
  });
  it("mail pro 50k at 51'500: two started blocks, USD 21.80", () => {
    expect(evaluatePlan(plan("resend-pro-50k"), { emails: 51_500 }).totalMinor).toBe(2180);
  });
  it("storage at 25 GB rounds half up once: 0.225 becomes USD 0.23", () => {
    expect(evaluatePlan(plan("r2-standard"), { storage_gb: 25 }).totalMinor).toBe(23);
  });
  it("spend cap on: USD 25.00 at 100 GB disk, flagged over the limit", () => {
    const r = evaluatePlan(plan("supabase-pro-cap"), { disk_gb: 100 });
    expect(r.totalMinor).toBe(2500);
    expect(r.overLimit).toBe(true);
  });
  it("a credit offsets usage only, never the seats", () => {
    const r = evaluatePlan(plan("vercel-pro"), { seats: 2, data_transfer_gb: 1001 });
    expect(r.usageMinor).toBe(15);
    expect(r.creditUsedMinor).toBe(15);
    expect(r.totalMinor).toBe(4000);
  });
  it("seats clamp to 1 and 100; measured beats usage", () => {
    expect(evaluatePlan(plan("vercel-pro"), { seats: 0 }).seats).toBe(1);
    expect(evaluatePlan(plan("vercel-pro"), { seats: 900 }).seats).toBe(100);
    expect(evaluatePlan(plan("r2-standard"), { storage_gb: 25 }, { storage_gb: 12.5 }).totalMinor).toBe(5);
  });
  it("the storage line of the notes: 12.5 GB, 30 uploads, 400 objects, 10 views", () => {
    expect(storageQuantities({ storedGb: 12.5, objects: 400, uploadsPerMonth: 30 }, { views_per_object: 10 })).toEqual({ storage_gb: 12.5, class_a: 30, class_b: 4060 });
  });
});

describe("planner helpers", () => {
  it("formats and parses quantities, rates and micro prices", () => {
    expect(formatQuantity(120000)).toBe("120'000");
    expect(formatQuantity(0.25)).toBe("0.25");
    expect(formatQuantity(12.5)).toBe("12.5");
    expect(parseQuantity("120'000")).toBe(120000);
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity("abc")).toBeNull();
    expect(formatRate(800000)).toBe("0.8000");
    expect(formatRate(812345)).toBe("0.812345");
    expect(formatMicro(15000)).toBe("0.015");
    expect(formatMicro(2_000_000)).toBe("2.00");
    expect(formatMicro(3250)).toBe("0.00325");
  });
  it("puts the range on the nearest stop at or below, and the tick at the first stop at or above", () => {
    expect(stopIndexFor([0, 10, 100, 1000], 140)).toBe(2);
    expect(stopIndexFor([0, 10, 100, 1000], 0)).toBe(0);
    expect(includedStopIndex([0, 100, 1000, 10000, 50000, 100000], 50000)).toBe(4);
    expect(includedStopIndex([0, 1, 2], 50)).toBe(2);
    expect(clampSlider({ min: 1, max: 100, integer: true }, 2.6)).toBe(3);
    expect(clampSlider({ min: 0, max: 1e9, integer: false }, -4)).toBe(0);
  });
  it("offers seats first, and assumption sliders for a storage plan", () => {
    expect(planSliders(plan("vercel-pro")).map((s) => s.key)).toEqual(["seats", "data_transfer_gb", "cdn_requests"]);
    expect(planSliders(plan("r2-standard")).map((s) => s.key)).toEqual(["extra_gb", "extra_uploads", "views_per_object"]);
  });
  it("adds up the seed: every saved row now, and the free ones are named", () => {
    const s = getState();
    const measure = measureStorage(s.files, s.ledger, DEMO_MONTH);
    const totals = plannerTotals(s.costs, s.pricePlans, s.fxRates, {}, measure, DEMO_MONTH);
    expect(totals.plansYear).toBe(totals.nowYear);
    expect(totals.freeLabels).toEqual(["DNS", "Code host"]);
    expect(totals.nowMonth).toBeGreaterThan(6000);
    expect(totals.missingCurrencies).toEqual([]);
  });
  it("a draft moves the plan total and not the now total; a switched-off row leaves it", () => {
    const s = getState();
    const measure = measureStorage(s.files, s.ledger, DEMO_MONTH);
    const base = plannerTotals(s.costs, s.pricePlans, s.fxRates, {}, measure, DEMO_MONTH);
    const more = plannerTotals(s.costs, s.pricePlans, s.fxRates, { cost_app: { usage: { seats: 3 } } }, measure, DEMO_MONTH);
    expect(more.nowYear).toBe(base.nowYear);
    expect(more.plansMonth - base.plansMonth).toBe(3200);
    const off = plannerTotals(s.costs, s.pricePlans, s.fxRates, { cost_app: { state: "off" } }, measure, DEMO_MONTH);
    expect(base.plansMonth - off.plansMonth).toBe(1600);
  });
  it("a missing rate is recorded, not counted", () => {
    const s = getState();
    const measure = measureStorage(s.files, s.ledger, DEMO_MONTH);
    const totals = plannerTotals(s.costs, s.pricePlans, [], {}, measure, DEMO_MONTH);
    expect(totals.missingCurrencies).toEqual(["USD"]);
    expect(totals.nowYear).toBe(2400);
  });
  it("a draft equal to the saved row is dropped", () => {
    const s = getState();
    const cost = s.costs.find((c) => c.id === "cost_app") as Cost;
    expect(normaliseDraft(cost, s.pricePlans, { usage: { seats: 1 } })).toBeNull();
    expect(normaliseDraft(cost, s.pricePlans, { usage: { seats: 2 } })).toEqual({ usage: { seats: 2 } });
    expect(normaliseDraft(cost, s.pricePlans, { state: "active" })).toBeNull();
    expect(normaliseDraft(cost, s.pricePlans, { state: "off" })).toEqual({ state: "off" });
  });
  it("activation starts a monthly cost this month unless it starts later", () => {
    expect(activationStartsOn({ billing: "monthly", startsOn: null, state: "planned" }, "active", "2027-01")).toBe("2027-01-01");
    expect(activationStartsOn({ billing: "monthly", startsOn: "2027-03-01", state: "planned" }, "active", "2027-01")).toBe("2027-03-01");
    expect(activationStartsOn({ billing: "yearly", startsOn: null, state: "planned" }, "active", "2027-01")).toBeNull();
  });
  it("runway has one decimal, never goes below zero, and needs a running cost", () => {
    expect(runway(100000, 7000)).toBe(14.3);
    expect(runway(-500, 7000)).toBe(0);
    expect(runway(1000, null)).toBeNull();
  });
  it("free tier left: floors at zero and reports months at pace", () => {
    expect(freeTierLeft(10, { storedGb: 4, gbAddedPerMonth: 2 }, 1)).toEqual({ gbLeft: 5, monthsAtPace: 2.5 });
    expect(freeTierLeft(10, { storedGb: 14, gbAddedPerMonth: 0 }, 0)).toEqual({ gbLeft: 0, monthsAtPace: null });
  });
  it("derives a rate from recent recurring bills and leaves CHF bills out", () => {
    const rate = lastBillRate(getState().ledger, "USD");
    expect(rate?.bills.length).toBe(3);
    expect(rate?.ppm).toBeGreaterThan(780_000);
    expect(rate?.ppm).toBeLessThan(820_000);
    expect(lastBillRate(getState().ledger, "GBP")).toBeNull();
  });
  it("the 12-month grid ends at the month and adds up", () => {
    const s = getState();
    const grid = lastTwelve(s.costs, s.costBookings, DEMO_MONTH);
    expect(grid.months.length).toBe(12);
    expect(grid.months[11]).toBe(DEMO_MONTH);
    expect(grid.total).toBe(grid.rows.reduce((sum, r) => sum + r.total, 0));
  });
  it("prices a custom cost, and a yearly one stays yearly", () => {
    const s = getState();
    const measure = measureStorage(s.files, s.ledger, DEMO_MONTH);
    const domain = s.costs.find((c) => c.id === "cost_domain") as Cost;
    expect(rowCost(domain, s.pricePlans, measure)).toMatchObject({ minor: 2400, currency: "CHF", yearly: true });
    expect(rowCost(domain, s.pricePlans, measure, { customMinor: 3000 }).minor).toBe(3000);
  });
});

describe("ledger", () => {
  it("runs the balance over the whole book, whatever is filtered", () => {
    const s = getState();
    const balances = runningBalances(s.ledger, s.accounts);
    const last = [...s.ledger].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).at(-1);
    expect(balances.get(last?.id as string)).toBe(bookBalance(s.ledger, s.accounts));
    expect(openingTotal(s.accounts)).toBe(205000);
  });
  it("account chips add up to the balance, switched-off accounts included", () => {
    const s = getState();
    const sum = s.accounts.reduce((total, a) => total + accountBalance(a, s.ledger), 0) + notOnAccount(s.ledger);
    expect(sum).toBe(bookBalance(s.ledger, s.accounts));
  });
  it("filters by text, month, none and id", () => {
    const s = getState();
    expect(filterEntries(s.ledger, { ...NO_FILTER, category: "none" }).every((e) => e.categoryId === null)).toBe(true);
    expect(filterEntries(s.ledger, { ...NO_FILTER, month: "2026-09" }).every((e) => e.occurredOn.startsWith("2026-09"))).toBe(true);
    expect(filterEntries(s.ledger, { ...NO_FILTER, q: "PARCEL TAPE" }).length).toBe(1);
    expect(filterEntries(s.ledger, { ...NO_FILTER, account: "acc_cash" }).every((e) => e.accountId === "acc_cash")).toBe(true);
    const { moneyIn, moneyOut } = moneyInOut(s.ledger);
    expect(moneyIn - moneyOut + openingTotal(s.accounts)).toBe(bookBalance(s.ledger, s.accounts));
  });
  it("reads a form: sign from the direction, one problem named at a time", () => {
    const base: EntryDraft = { direction: "out", amountText: "125.50", occurredOn: DEMO_TODAY, title: "Test", categoryId: null, accountId: null, counterparty: "", dropId: null, originalText: "", originalCurrency: "", vatRateBp: null, vatText: "", description: "" };
    const ok = readEntryDraft(base, false);
    expect(ok.ok && ok.values.amountRappen).toBe(-12550);
    expect(readEntryDraft({ ...base, amountText: "0" }, false)).toEqual({ ok: false, problem: "amount" });
    expect(readEntryDraft({ ...base, title: " " }, false)).toEqual({ ok: false, problem: "title" });
    expect(readEntryDraft({ ...base, originalText: "20.00" }, false)).toEqual({ ok: false, problem: "original" });
    expect(readEntryDraft({ ...base, vatRateBp: 810, vatText: "200.00" }, true)).toEqual({ ok: false, problem: "vat" });
    expect(readEntryDraft({ ...base, vatRateBp: 0, vatText: "1.00" }, true)).toEqual({ ok: false, problem: "vat" });
    const vat = readEntryDraft({ ...base, amountText: "100.00", vatRateBp: 810, vatText: "7.49" }, true);
    expect(vat.ok && vat.values.vatRappen).toBe(-749);
    expect(suggestedVat("100.00", 810)).toBe("7.49");
  });
  it("VAT applies to income and expense, never to shop sales or transfers", () => {
    expect(takesVat({ kind: "expense", slug: "equipment" })).toBe(true);
    expect(takesVat({ kind: "income", slug: "shop-sales" })).toBe(false);
    expect(takesVat({ kind: "transfer", slug: "vat-settlement" })).toBe(false);
    expect(takesVat(null)).toBe(false);
  });
});

describe("report", () => {
  it("uses the previous quarter in a quarter's first month", () => {
    expect(defaultPeriod("2027-01-08")).toBe("2026-Q4");
    expect(defaultPeriod("2026-10-28")).toBe("2026-Q3");
    expect(defaultPeriod("2026-11-03")).toBe("2026-Q4");
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
    expect(periodColumns("2026-Q3")).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(periodColumns("2026")).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  });
  it("lists quarters newest first, then years, ignoring future entries", () => {
    const options = periodOptions(["2026-02-10", "2030-01-01"], "2027-01-08");
    expect(options[0]).toBe("2027-Q1");
    expect(options).toContain("2026-Q1");
    expect(options.at(-1)).toBe("2026");
    expect(options).not.toContain("2030-Q1");
  });
  it("sorts entries onto their lines", () => {
    const cats = getState().categories;
    expect(reportLineOf(null, cats)).toBe("uncategorised");
    expect(reportLineOf("cat_shop-sales", cats)).toBe("sales");
    expect(reportLineOf("cat_other-income", cats)).toBe("other_income");
    expect(reportLineOf("cat_vat-settlement", cats)).toBe("transfer");
    expect(reportLineOf("cat_equipment", cats)).toBe("equipment");
    expect(reportLineOf("cat_marketing", cats)).toBe("other");
  });
  it("keeps transfers out of the result; the result is the sum of the lines", () => {
    const s = getState();
    const table = reportTable(s.ledger, s.categories, "2026", false);
    expect(table.result.total).toBe(table.rows.reduce((sum, r) => sum + r.total, 0));
    expect(table.transfers.total).toBe(500000 + 260000 - 60000);
    expect(Object.values(table.result.cells).reduce((a, b) => a + b, 0)).toBe(table.result.total);
  });
  it("nets VAT out of the lines when it is on", () => {
    const s = getState();
    const gross = reportTable(s.ledger, s.categories, "2026-Q3", false);
    const net = reportTable(s.ledger, s.categories, "2026-Q3", true);
    const vat = s.ledger.filter((e) => e.occurredOn >= "2026-07-01" && e.occurredOn <= "2026-09-30").reduce((sum, e) => sum + (e.vatRappen ?? 0), 0);
    expect(gross.result.total - net.result.total).toBe(vat);
    expect(vat).not.toBe(0);
  });
  it("summarises VAT: rate rows highest first, input tax positive, shop sales only counted", () => {
    const s = getState();
    const sum = vatSummary(s.ledger, s.categories, "2026");
    expect(sum.output.map((r) => r.bp)).toEqual([810]);
    expect(sum.output[0].base + sum.output[0].typed).toBe(18500);
    expect(sum.inputTotal).toBeGreaterThan(0);
    expect(sum.payouts).toBeGreaterThan(0);
    expect(sum.missingVat).toBeGreaterThan(0);
  });
  it("Q4 and a year show the stock section; other quarters do not", () => {
    expect(showsYearEnd("2026-Q4")).toBe(true);
    expect(showsYearEnd("2026")).toBe(true);
    expect(showsYearEnd("2026-Q3")).toBe(false);
  });
  it("writes the accountant's CSV: BOM, semicolons, CRLF, sales as one total a month", () => {
    const s = getState();
    const csv = financeCsv({ entries: s.ledger, categories: s.categories, accounts: s.accounts, drops: s.drops, vatOn: false }, "2026-Q4");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines[0].startsWith('"Date";"Type";"Group"')).toBe(true);
    const totals = lines.filter((l) => l.includes('"Sales total"'));
    expect(totals.length).toBe(3);
    expect(totals[0]).toMatch(/payouts? booked/);
    expect(lines.some((l) => l.includes('"Entry"') && l.includes('"Shop sales"'))).toBe(false);
    expect(lines[0]).toContain("VAT rate %");
  });
  it("sorts the CSV by day with each day's sales total after its entries", () => {
    const s = getState();
    const csv = financeCsv({ entries: s.ledger, categories: s.categories, accounts: s.accounts, drops: s.drops, vatOn: true }, "2026-Q4");
    const days = csv.slice(1).trim().split("\r\n").slice(1).map((l) => l.split(";")[0].replaceAll('"', "").split(".").reverse().join("-"));
    expect(days).toEqual([...days].sort());
  });
});

describe("refunds", () => {
  it("holds all nine refunds, of both types, newest first", () => {
    const s = getState();
    const rows = refundRows(s.orders, s.returns);
    expect(rows.length).toBe(9);
    expect(new Set(rows.map((r) => r.type))).toEqual(new Set(["return", "order"]));
    expect(rows.map((r) => r.createdAt)).toEqual([...rows.map((r) => r.createdAt)].sort().reverse());
  });
  it("groups by period and adds up", () => {
    const s = getState();
    const rows = refundRows(s.orders, s.returns);
    const y = refundsIn(rows, "2026");
    expect(summariseRefunds(y).count).toBe(y.length);
    expect(summariseRefunds(y).total).toBe(y.reduce((sum, r) => sum + r.amountRappen, 0));
  });
  it("lists open returns without any refunded one", () => {
    const s = getState();
    expect(openReturnsIn(s.returns, "2026").every((r) => r.status !== "refunded")).toBe(true);
  });
  it("hides free reasons in the CSV without Orders access, oldest first", () => {
    const s = getState();
    const rows = refundRows(s.orders, s.returns);
    const free = rows.find((r) => r.type === "order" && r.reasonText);
    const open = refundsCsv(rows, true);
    const closed = refundsCsv(rows, false);
    if (free) {
      expect(open).toContain(free.reasonText);
      expect(closed.includes(`"${free.reasonText}"`)).toBe(false);
    }
    expect(open.split("\r\n")[0]).toContain('"Date";"Type";"Return";"Order";"Reason";"Amount CHF"');
  });
});

describe("stock count", () => {
  const base: StockCountLine = { id: "l", variantId: "v", productName: "P", size: "M", color: "", sku: "S", systemQty: 10, counted: 12, toShip: 2, stockAtCount: 9, productCostRappen: 2450, typedCostRappen: null, sizeDeleted: false };

  it("runs the notes' example: system 10, counted 12, to ship 2, stock 9", () => {
    expect(lineSums(base)).toEqual({ moved: -1, yearEnd: 11, difference: 1, value: 26950, unit: 2450 });
  });
  it("gives the same year-end whenever the count happens", () => {
    const later = lineSums({ ...base, counted: 14, toShip: 1, stockAtCount: 13 });
    expect(later.moved).toBe(3);
    expect(later.yearEnd).toBe(10);
    const same = lineSums({ ...base, counted: 10, toShip: 0, stockAtCount: 10 });
    expect(same.yearEnd).toBe(10);
  });
  it("reports an unknown cost and never values it at 0, but values an explicit 0", () => {
    const unknown = countTotals([{ ...base, productCostRappen: null }]);
    expect(unknown.unknownCostPieces).toBe(11);
    expect(unknown.unknownCostLines).toBe(1);
    expect(unknown.valueRappen).toBe(0);
    const zero = countTotals([{ ...base, productCostRappen: null, typedCostRappen: 0 }]);
    expect(zero.unknownCostPieces).toBe(0);
    expect(zero.valuedPieces).toBe(11);
  });
  it("parses counted pieces and typed costs", () => {
    expect(parseCounted("")).toEqual({ ok: true, value: null });
    expect(parseCounted("1'200")).toEqual({ ok: true, value: 1200 });
    expect(parseCounted("-1")).toEqual({ ok: false });
    expect(parseCounted("100001")).toEqual({ ok: false });
    expect(parseCounted("1.5")).toEqual({ ok: false });
    expect(parseTypedCost("")).toEqual({ ok: true, value: null });
    expect(parseTypedCost("24.50")).toEqual({ ok: true, value: 2450 });
    expect(parseTypedCost("abc")).toEqual({ ok: false });
  });
  it("knows the cutoff, the countable year and when a confirm may happen", () => {
    expect(cutoffIso(2026)).toBe("2026-12-31T23:00:00.000Z");
    expect(canConfirmYet(2026, DEMO_NOW_MS)).toBe(true);
    expect(canConfirmYet(2027, DEMO_NOW_MS)).toBe(false);
    expect(countableYear("2027-01-08", 2025)).toBe(2026);
    expect(countableYear("2026-12-31", 2025)).toBe(2026);
    expect(countableYear("2026-12-30", 2026)).toBeNull();
  });
  it("refuses a confirm in the stated order", () => {
    const draft = getState().stockCounts.find((c) => c.year === 2026) as StockCount;
    expect(confirmRefusal(draft, "2025", DEMO_NOW_MS, 0)).toBe("wrong_year");
    expect(confirmRefusal({ ...draft, year: 2027 }, "2027", DEMO_NOW_MS, 0)).toBe("before_cutoff");
    expect(confirmRefusal(draft, "2026", DEMO_NOW_MS, 2)).toBe("missing_sizes");
    expect(confirmRefusal(draft, "2026", DEMO_NOW_MS, 0)).toBe("uncounted");
    const allCounted = { ...draft, lines: draft.lines.map((l) => (l.counted === null ? { ...l, counted: l.systemQty, stockAtCount: l.systemQty, toShip: 0 } : l)) };
    expect(confirmRefusal(allCounted, "2026", DEMO_NOW_MS, 0)).toBe("negative");
  });
  it("previews a typed count from live figures; a size that is gone counts as unmoved", () => {
    const s = getState();
    const live = liveFigures(s.products, s.orders);
    const variant = s.products[0].variants[0];
    const line: StockCountLine = { ...base, variantId: variant.id, systemQty: variant.stock };
    expect(withCounted(line, 5, live)).toMatchObject({ counted: 5, stockAtCount: variant.stock });
    expect(withCounted(line, null, live)).toMatchObject({ counted: null, stockAtCount: null, toShip: 0 });
    const gone = withCounted({ ...line, variantId: null, systemQty: 2 }, 2, live);
    expect(gone).toMatchObject({ toShip: 0, stockAtCount: 2 });
    expect(expectedOnShelf({ variantId: null, systemQty: 2 }, live)).toBe(2);
  });
  it("sorts by product, then size order", () => {
    const sorted = [{ ...base, size: "XL" as const }, { ...base, size: "S" as const }, { ...base, productName: "A", size: "ONE_SIZE" as const }].sort(lineOrder);
    expect(sorted.map((l) => l.size)).toEqual(["ONE_SIZE", "S", "XL"]);
  });
  it("writes one row per size and two footer rows", () => {
    const count = getState().stockCounts.find((c) => c.year === 2025) as StockCount;
    const lines = stockCountCsv(count).slice(1).trim().split("\r\n");
    expect(lines.length).toBe(count.lines.length + 3);
    expect(lines.at(-2)).toContain("Total (cost known)");
    expect(lines.at(-1)).toContain("Cost unknown:");
  });
});

describe("finance actions", () => {
  const values = { amountRappen: -5000, occurredOn: DEMO_TODAY, title: "Test", categoryId: null, accountId: "acc_cash", counterparty: "", dropId: null, originalAmountMinor: null, originalCurrency: null, vatRateBp: null, vatRappen: null, description: "" };

  it("adds and deletes an entry and moves the balance", () => {
    const before = bookBalance(getState().ledger, getState().accounts);
    const made = createEntry(values);
    expect(made.ok).toBe(true);
    expect(bookBalance(getState().ledger, getState().accounts)).toBe(before - 5000);
    if (made.ok) deleteEntry(made.data.id);
    expect(bookBalance(getState().ledger, getState().accounts)).toBe(before);
  });
  it("refuses an eleventh receipt", () => {
    const made = createEntry(values);
    if (!made.ok) throw new Error("no entry");
    const ten = Array.from({ length: 10 }, (_, i) => ({ name: `r${i}.pdf`, sizeBytes: 100 }));
    expect(addReceipts(made.data.id, ten).ok).toBe(true);
    const refused = addReceipts(made.data.id, [{ name: "x.pdf", sizeBytes: 1 }]);
    expect(refused.ok).toBe(false);
  });
  it("books the unbooked month once, refuses a second, and unbooks", () => {
    const entriesBefore = getState().ledger.length;
    const first = bookCost({ costId: "cost_assistant", month: DEMO_MONTH, chargedRappen: 1600, billMinor: 2000, occurredOn: DEMO_TODAY });
    expect(first.ok).toBe(true);
    expect(getState().ledger.length).toBe(entriesBefore + 1);
    const entry = getState().ledger.at(-1);
    expect(entry).toMatchObject({ amountRappen: -1600, source: "recurring", title: `Inbox assistant · ${DEMO_MONTH}`, externalRef: `recurring:cost_assistant:${DEMO_MONTH}`, originalAmountMinor: 2000, originalCurrency: "USD" });
    const second = bookCost({ costId: "cost_assistant", month: DEMO_MONTH, chargedRappen: 1600, billMinor: 2000, occurredOn: DEMO_TODAY });
    expect(second).toMatchObject({ ok: false, code: "already_booked" });
    expect(unbookCost("cost_assistant", DEMO_MONTH).ok).toBe(true);
    expect(getState().ledger.length).toBe(entriesBefore);
  });
  it("refuses to book a planned cost", () => {
    savePlanDraft("cost_app", { state: "planned" });
    expect(bookCost({ costId: "cost_app", month: "2027-02", chargedRappen: 100, billMinor: null, occurredOn: "2027-02-01" })).toMatchObject({ ok: false, code: "planned" });
  });
  it("revalues a saved plan itself, and the running cost stays booked truth", () => {
    const running = monthlyRunningCost(getState());
    expect(savePlanDraft("cost_app", { usage: { seats: 3 } }).ok).toBe(true);
    const cost = getState().costs.find((c) => c.id === "cost_app") as Cost;
    expect(cost.expectedMinor).toBe(6000);
    expect(cost.usage.seats).toBe(3);
    expect(monthlyRunningCost(getState())).toBe(running);
  });
  it("moves to a custom amount and keeps it", () => {
    expect(savePlanDraft("cost_app", { planId: null, customMinor: 4200 }).ok).toBe(true);
    const cost = getState().costs.find((c) => c.id === "cost_app") as Cost;
    expect(cost).toMatchObject({ planId: null, expectedMinor: 4200 });
  });
  it("allows one storage row only, and no plan on a yearly cost", () => {
    expect(savePlanDraft("cost_db", { planId: "plan_r2-standard" })).toMatchObject({ ok: false, code: "storage_taken" });
    expect(savePlanDraft("cost_domain", { planId: "plan_vercel-pro" })).toMatchObject({ ok: false, code: "yearly_plan" });
  });
  it("checks a cost's dates", () => {
    expect(costProblem({ label: "", expectedMinor: 0, startsOn: null, endsOn: null, billing: "monthly" })).toBe("name");
    expect(costProblem({ label: "x", expectedMinor: 0, startsOn: "2027-02-01", endsOn: "2027-01-01", billing: "monthly" })).toBe("ends_before");
    expect(costProblem({ label: "x", expectedMinor: 0, startsOn: null, endsOn: null, billing: "yearly" })).toBe("yearly_start");
    expect(costProblem({ label: "x", expectedMinor: 100, startsOn: null, endsOn: null, billing: "monthly" })).toBeNull();
  });
  it("checks accounts, categories and rates", () => {
    expect(saveAccount(null, { name: " ", kind: "bank", openingRappen: 0, openingOn: DEMO_TODAY, isActive: true }).ok).toBe(false);
    expect(saveAccount(null, { name: "New", kind: "bank", openingRappen: -100, openingOn: DEMO_TODAY, isActive: true }).ok).toBe(true);
    expect(saveCategory(null, { nameEn: "Rent", nameDe: "Miete", kind: "expense", group: null, isActive: true })).toMatchObject({ ok: false, code: "group" });
    expect(saveCategory(null, { nameEn: "Rent", nameDe: "Miete", kind: "expense", group: "administration", isActive: true }).ok).toBe(true);
    expect(saveCategory("cat_equipment", { nameEn: "Equipment", nameDe: "Ausrüstung", kind: "income", group: null, isActive: true })).toMatchObject({ ok: false, code: "kind_locked" });
    expect(saveRate("USD", { chfPpm: 50_000, asOf: null, source: "", note: "" })).toMatchObject({ ok: false, code: "range" });
    expect(saveRate("USD", { chfPpm: 812_300, asOf: DEMO_TODAY, source: "", note: "" }).ok).toBe(true);
  });
  it("toggles VAT without touching anything else", () => {
    setVatEnabled(true);
    expect(getState().settings.vatEnabled).toBe(true);
    setVatEnabled(false);
    expect(getState().settings.vatEnabled).toBe(false);
  });
  it("runs a stock count end to end: counts save, confirm freezes, stock never moves", () => {
    const stockBefore = JSON.stringify(getState().products.map((p) => p.variants.map((v) => v.stock)));
    expect(confirmCount(2026, "2026")).toMatchObject({ ok: false, code: "missing_sizes" });
    expect(startCount(2026).ok).toBe(true);
    expect(confirmCount(2026, "2026")).toMatchObject({ ok: false, code: "uncounted" });
    const draft = getState().stockCounts.find((c) => c.year === 2026) as StockCount;
    const patches = draft.lines.map((l) => ({ id: l.id, counted: l.systemQty, toShip: 0, stockAtCount: l.systemQty, typedCostRappen: l.typedCostRappen }));
    expect(saveCountLines(2026, patches).ok).toBe(true);
    expect(confirmCount(2026, "2025")).toMatchObject({ ok: false, code: "wrong_year" });
    const done = confirmCount(2026, "2026");
    expect(done.ok).toBe(true);
    expect((getState().stockCounts.find((c) => c.year === 2026) as StockCount).status).toBe("confirmed");
    expect(saveCountLines(2026, patches)).toMatchObject({ ok: false, code: "confirmed" });
    expect(JSON.stringify(getState().products.map((p) => p.variants.map((v) => v.stock)))).toBe(stockBefore);
  });
  it("discards a draft, starts again and tops up instead of duplicating", () => {
    expect(discardCount(2026).ok).toBe(true);
    expect(getState().stockCounts.some((c) => c.year === 2026)).toBe(false);
    const started = startCount(2026);
    expect(started.ok && started.data).toBeGreaterThan(0);
    expect(startCount(2026)).toMatchObject({ ok: true, data: 0 });
    expect(startCount(2025)).toMatchObject({ ok: false, code: "confirmed" });
  });
  it("lets only superUser reopen, and asks for a reason", () => {
    expect(reopenCount(2025, "Fix")).toMatchObject({ ok: false, code: "forbidden" });
  });
  it("cash on hand leaves switched-off accounts out", () => {
    const s = getState();
    const active = s.accounts.filter((a) => a.isActive).reduce((sum, a) => sum + accountBalance(a, s.ledger), 0);
    expect(cashOnHand(s.accounts, s.ledger)).toBe(active);
  });
});

describe("sample months in the planner", () => {
  it("quiet stays inside what is included, so the bill does not move", () => {
    const p = plan("vercel-pro");
    expect(evaluatePlan(p, scenarioUsage(p, "quiet", { seats: 1 })).totalMinor).toBe(evaluatePlan(p, { seats: 1 }).totalMinor);
  });
  it("busy lands past the included mark and peak further still", () => {
    const p = plan("vercel-pro");
    const busy = evaluatePlan(p, scenarioUsage(p, "busy", { seats: 1 }));
    const peak = evaluatePlan(p, scenarioUsage(p, "peak", { seats: 1 }));
    expect(busy.usageMinor).toBeGreaterThan(0);
    expect(peak.totalMinor).toBeGreaterThan(busy.totalMinor);
  });
  it("leaves seats alone and only uses stops the sliders have", () => {
    const p = plan("vercel-pro");
    const usage = scenarioUsage(p, "peak", { seats: 3 });
    expect(usage.seats).toBe(3);
    for (const slider of planSlidersOf(p)) {
      if (slider.kind !== "meter") continue;
      expect(slider.stops).toContain(usage[slider.key]);
      expect(slider.stops.indexOf(usage[slider.key])).toBeGreaterThan(includedStop(slider.stops, slider.included as number));
    }
  });
  it("does not touch the measured storage plan", () => {
    const p = plan("r2-standard");
    expect(scenarioUsage(p, "peak", { extra_gb: 5 })).toEqual({ extra_gb: 5 });
  });
  it("a spend-capped plan flags the overrun instead of billing it", () => {
    const p = plan("supabase-pro-cap");
    const peak = evaluatePlan(p, scenarioUsage(p, "peak"));
    expect(peak.overLimit).toBe(true);
    expect(peak.totalMinor).toBe(2500);
  });
});

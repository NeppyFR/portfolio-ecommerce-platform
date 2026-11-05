import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discountState } from "@/lib/discount-rules";
import { formatChf } from "@/lib/format";
import { lockStatus, rotationRows, rotationSummary } from "@/lib/security-rules";
import { COLLECTION_TITLES, PRODUCT_TITLES } from "@/lib/routes";
import { checkTracking } from "@/lib/tracking";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { createSeed } from "@/store/seed";
import { HEALTH_CHECKS, INVARIANTS, MANUAL_CHECK_IDS } from "@/store/seed/system";
import { FILES_TOTAL_BYTES } from "@/store/seed/work";
import type { Profile } from "@/store/types";
import { attentionCount, bellItems, dueThisWeekCount, healthSummary, liveStatus, liveStatusAt, monthlyRunningCost, priorityMailCount, stockAlerts, systemAreas, toPackCount } from "@/store/selectors";

const s = createSeed();
const count = <T,>(rows: T[], test: (row: T) => boolean) => rows.filter(test).length;

const CONFIG_ALLOWLIST = new Set([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET",
  "ADMIN_PASSWORD_HASH", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "NEXT_PUBLIC_SITE_URL", "EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO", "NEXT_PUBLIC_ALLOW_INDEXING",
  "WATCHDOG_TOKEN", "INBOX_ALLOWED_MAILBOXES", "INBOX_CLASSIFIER", "CHECKOUT_ENABLED", "ENABLE_DEV_TOOLS", "WATCHDOG_TARGET_URL", "ADMIN_OWNER_PASSWORD_HASH", "WORKSPACE_STORAGE",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_JURISDICTION", "VERCEL_API_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "GITHUB_READ_TOKEN", "GITHUB_REPO", "CLOUDFLARE_ANALYTICS_TOKEN",
]);

describe("determinism", () => {
  it("builds the same seed twice", () => {
    expect(JSON.stringify(createSeed())).toBe(JSON.stringify(s));
  });
  it("uses no wall clock and no Math.random", () => {
    const dir = "src/store/seed";
    for (const file of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, file), "utf8");
      expect(text, file).not.toMatch(/Math\.random|Date\.now|new Date\(\)/);
    }
  });
  it("puts nothing after the demo clock", () => {
    const late: string[] = [];
    const walk = (value: unknown, where: string) => {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Date.parse(value) > DEMO_NOW_MS) {
        const planned = /launchAt|startsAt|endsAt|expiresAt/.test(where);
        if (!planned) late.push(`${where}=${value}`);
      } else if (Array.isArray(value)) {
        value.forEach((v) => walk(v, where));
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, k);
      }
    };
    walk(s, "state");
    expect(late).toEqual([]);
  });
});

describe("catalogue", () => {
  it("has 13 products with the right mix and every slug in routes.ts", () => {
    expect(s.products).toHaveLength(13);
    expect(count(s.products, (p) => p.status === "active")).toBe(11);
    expect(count(s.products, (p) => p.status === "draft")).toBe(1);
    expect(count(s.products, (p) => p.status === "archived")).toBe(1);
    expect(s.products.map((p) => p.slug).sort()).toEqual(Object.keys(PRODUCT_TITLES).sort());
    expect(s.collections.map((c) => c.slug).sort()).toEqual(Object.keys(COLLECTION_TITLES).sort());
    expect(count(s.collections, (c) => c.isActive)).toBe(3);
    expect(s.tags).toHaveLength(5);
    for (const p of s.products) expect(p.nameEn).toBe(PRODUCT_TITLES[p.slug]);
  });
  it("has about 46 variants and the hand-set stock", () => {
    const variants = s.products.flatMap((p) => p.variants);
    expect(variants.length).toBeGreaterThanOrEqual(44);
    expect(variants.length).toBeLessThanOrEqual(48);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(variants.length);
    const bySlug = (slug: string) => s.products.find((p) => p.slug === slug)!;
    const stock = (slug: string, size: string) => bySlug(slug).variants.find((v) => v.size === size)!.stock;
    expect(stock("frost-candle", "ONE_SIZE")).toBe(0);
    expect(stock("lagoon-speaker", "M")).toBe(0);
    expect(bySlug("lagoon-speaker").variants.find((v) => v.sku === "AL-SPK-ICE-S")!.stock).toBe(1);
    expect(stock("trail-bottle", "L")).toBe(2);
    // The draft lamp is still in sampling: two sample pieces from the earlier rounds, no production stock yet.
    expect(bySlug("tall-lamp").variants.map((v) => v.stock)).toEqual([0, 1, 1, 0, 0]);
    for (const v of variants) {
      const special = ["AL-CNDL-FRO-OS", "AL-SPK-LAG-M", "AL-SPK-ICE-S", "AL-BTL-LIL-L"].includes(v.sku) || v.sku.startsWith("AL-TALL-");
      if (!special) {
        expect(v.stock, v.sku).toBeGreaterThanOrEqual(4);
        expect(v.stock, v.sku).toBeLessThanOrEqual(30);
      }
    }
    expect(bySlug("lagoon-speaker").variants.find((v) => v.size === "XL")!.priceOverrideRappen).toBe(12400);
    expect(bySlug("lagoon-speaker").variants.find((v) => v.size === "M")!.sku).toBe("AL-SPK-LAG-M");
    expect(bySlug("logo-notebook-cloud").variants[0].sku).toBe("AL-NOTE-CLD-OS");
    expect(variants).toHaveLength(45);
    for (const v of variants) expect(["S", "M", "L", "XL", "ONE_SIZE"], v.sku).toContain(v.size);
    expect(bySlug("lagoon-speaker").variants.map((v) => `${v.size}/${v.color}`)).toEqual(["S/Ice", "S/Lagoon", "M/Lagoon", "L/Lagoon", "XL/Lagoon"]);
    expect(new Set(s.products.map((p) => p.art))).toEqual(new Set(["mug", "bottle", "lamp", "notebook", "candle", "planter", "speaker", "pouch"]));
  });
});

describe("orders", () => {
  it("has 150 with the exact status mix", () => {
    expect(s.orders).toHaveLength(150);
    const by = (status: string) => count(s.orders, (o) => o.status === status);
    expect([by("pending"), by("paid"), by("packed"), by("shipped"), by("delivered"), by("cancelled"), by("refunded")]).toEqual([3, 14, 9, 31, 84, 4, 5]);
    expect(s.orders[0].orderNumber).toBe("AL-1150");
    expect(s.orders[0].status).toBe("paid");
    expect(s.orders[149].orderNumber).toBe("AL-1001");
    expect(new Set(s.orders.map((o) => o.orderNumber)).size).toBe(150);
  });
  it("gives the landing's seed title", () => {
    expect(toPackCount(s)).toBe(14);
    expect(attentionCount(s)).toBe(3);
  });
  it("flags the three attention orders", () => {
    const flagged = s.orders.filter((o) => o.needsAttention);
    expect(flagged.flatMap((o) => o.attentionReasons).sort()).toEqual(["amount_mismatch", "code_over_limit", "stock_conflict"]);
    const conflict = s.orders.find((o) => o.orderNumber === "AL-1147")!;
    expect(conflict.stockConflict).toBe(true);
    expect(conflict.items[0].shortfall).toBe(1);
    expect(s.orders.find((o) => o.orderNumber === "AL-1128")!.discountCode).toBe("FRIENDS10");
  });
  it("runs 90 days back with a rising trend and a weekend bias", () => {
    const days = s.orders.map((o) => o.placedAt.slice(0, 10)).sort();
    expect(days[0] >= "2026-10-10").toBe(true);
    const third = Math.floor(days.length / 3);
    const firstThirdSpan = days.filter((d) => d < "2026-11-09").length;
    const lastThirdSpan = days.filter((d) => d >= "2026-12-09").length;
    expect(lastThirdSpan).toBeGreaterThan(firstThirdSpan);
    expect(third).toBe(50);
    const newest = s.orders[0].placedAt;
    expect(Date.parse(newest)).toBeLessThan(DEMO_NOW_MS);
    const placed = s.orders.map((o) => o.placedAt);
    expect([...placed].sort().reverse()).toEqual(placed);
  });
  it("prices every order by the one formula", () => {
    for (const o of s.orders) {
      const subtotal = o.items.reduce((sum, i) => sum + i.lineTotalRappen, 0);
      const allocated = o.items.reduce((sum, i) => sum + i.discountRappen, 0);
      expect(o.subtotalRappen, o.orderNumber).toBe(subtotal);
      expect(allocated, o.orderNumber).toBe(o.discountRappen);
      expect(o.totalRappen, o.orderNumber).toBe(o.subtotalRappen - o.discountRappen + o.shippingRappen);
      const free = o.subtotalRappen - o.discountRappen >= 15000 || o.discountCode === "FREESHIP";
      expect(o.shippingRappen, o.orderNumber).toBe(free ? 0 : 700);
    }
  });
  it("carries a code on about 20 percent", () => {
    const withCode = count(s.orders, (o) => o.discountCode !== null);
    expect(withCode).toBeGreaterThanOrEqual(25);
    expect(withCode).toBeLessThanOrEqual(35);
  });
  it("uses the invented carrier and valid tracking", () => {
    for (const o of s.orders) {
      if (o.status === "shipped" || o.status === "delivered") {
        expect(o.trackingCarrier).toBe("Beispielpost");
        expect(checkTracking(o.trackingNumber ?? ""), o.orderNumber).toBe("ok");
      }
    }
  });
  it("orders events in time, ending in a consistent state", () => {
    for (const o of s.orders) {
      const times = o.events.map((e) => e.createdAt);
      expect([...times].sort(), o.orderNumber).toEqual(times);
      if (o.status === "paid") expect(o.packedAt).toBeNull();
      if (o.status === "pending") expect(o.paidAt).toBeNull();
      expect(o.refundedRappen).toBe(o.refunds.reduce((sum, r) => sum + r.amountRappen, 0));
      if (o.status === "refunded") expect(o.refundedRappen).toBe(o.totalRappen);
    }
  });
});

describe("customers, returns, discounts", () => {
  it("has 40 people plus 1 erased, 12 of them repeat", () => {
    expect(s.customers).toHaveLength(41);
    expect(count(s.customers, (c) => c.erased)).toBe(1);
    const orders = new Map<string, number>();
    for (const o of s.orders) orders.set(o.customerId, (orders.get(o.customerId) ?? 0) + 1);
    expect(count(s.customers, (c) => !c.erased && (orders.get(c.id) ?? 0) >= 2)).toBe(12);
    for (const c of s.customers) {
      expect(c.email, c.fullName).toMatch(/^[a-z]+\.[a-z]+@example\.com$|^erased@example\.com$/);
      if (!c.erased) expect(c.phone).toBe("+41 00 000 00 00");
    }
    const erased = s.orders.filter((o) => o.customerErased);
    expect(erased.length).toBeGreaterThanOrEqual(1);
  });
  it("has R-0001 to R-0008 across all statuses and 9 refunds of both types", () => {
    expect(s.returns.map((r) => r.returnNo)).toEqual(["R-0001", "R-0002", "R-0003", "R-0004", "R-0005", "R-0006", "R-0007", "R-0008"]);
    expect(new Set(s.returns.map((r) => r.status))).toEqual(new Set(["requested", "received", "refunded", "closed"]));
    const refunds = s.orders.flatMap((o) => o.refunds);
    expect(refunds).toHaveLength(9);
    expect(count(refunds, (r) => r.returnNo !== null)).toBeGreaterThan(0);
    expect(count(refunds, (r) => r.returnNo === null)).toBeGreaterThan(0);
  });
  it("has the seven codes in their states", () => {
    const state = (code: string) => discountState(s.discounts.find((d) => d.code === code)!, DEMO_TODAY);
    expect(state("LAUNCH15")).toBe("active");
    expect(state("WELCOME10")).toBe("active");
    expect(state("FREESHIP")).toBe("active");
    expect(state("SUMMER20")).toBe("expired");
    expect(state("FRIENDS10")).toBe("used_up");
    expect(state("AUTUMN25")).toBe("scheduled");
    expect(state("STAFF30")).toBe("disabled");
    expect(s.discounts.find((d) => d.code === "FRIENDS10")!.timesUsed).toBe(11);
    expect(s.discounts.find((d) => d.code === "WELCOME10")!.minOrderRappen).toBe(6000);
    expect(s.discounts.find((d) => d.code === "FREESHIP")!.minOrderRappen).toBe(5000);
  });
});

describe("stock moves", () => {
  it("has exactly 400, and each size's chain ends on its stock", () => {
    expect(s.movements).toHaveLength(400);
    expect(new Set(s.movements.map((m) => m.id)).size).toBe(400);
    for (const v of s.products.flatMap((p) => p.variants)) {
      const moves = s.movements.filter((m) => m.variantId === v.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      expect(moves.reduce((sum, m) => sum + m.delta, 0), v.sku).toBe(v.stock);
      for (const m of moves) {
        expect(m.after, v.sku).toBe(m.before + m.delta);
        expect(m.after, v.sku).toBeGreaterThanOrEqual(0);
      }
      expect(moves[0].before, v.sku).toBe(0);
      expect(moves[moves.length - 1].after, v.sku).toBe(v.stock);
    }
  });
  it("reserves exactly what the holds hold", () => {
    expect(s.holds).toHaveLength(3);
    expect(count(s.holds, (h) => h.overdue)).toBe(1);
    const held = new Map<string, number>();
    for (const h of s.holds) for (const l of h.lines) held.set(l.variantId, (held.get(l.variantId) ?? 0) + l.quantity);
    for (const v of s.products.flatMap((p) => p.variants)) expect(v.reserved, v.sku).toBe(held.get(v.id) ?? 0);
  });
});

describe("the rest of the seed", () => {
  it("drops, suppliers, purchase orders, campaigns", () => {
    expect(s.drops.map((d) => [d.name, d.season, d.status])).toEqual([["Frost", "S1", "archived"], ["Lagoon", "S2", "live"], ["Aurora", "S3", "planned"], ["Cirrus", "S4", "planned"]]);
    expect(s.drops[2].launchOn).toBe("2027-01-17");
    expect(s.drops[3].launchOn).toBeNull();
    expect(s.drops.flatMap((d) => d.waitlist)).toHaveLength(30);
    expect(s.suppliers).toHaveLength(5);
    expect(count(s.suppliers, (x) => !x.isActive)).toBe(1);
    expect(s.purchaseOrders.map((p) => p.number)).toEqual(Array.from({ length: 8 }, (_, i) => `PO-000${i + 1}`));
    expect(new Set(s.purchaseOrders.map((p) => p.status)).size).toBe(6);
    expect(new Set(s.purchaseOrders.map((p) => p.currency))).toEqual(new Set(["CHF", "EUR"]));
    expect(s.campaigns).toHaveLength(7);
    expect(new Set(s.campaigns.map((c) => c.status)).size).toBe(3);
    expect(new Set(s.campaigns.map((c) => c.channel)).size).toBe(6);
  });
  it("tasks, calendar, files, inbox", () => {
    expect(s.taskLists).toHaveLength(5);
    expect(s.tasks).toHaveLength(38);
    expect(count(s.tasks, (t) => t.doneAt !== null)).toBeGreaterThan(0);
    expect(count(s.tasks, (t) => t.doneAt === null && t.dueOn !== null && t.dueOn < DEMO_TODAY)).toBeGreaterThan(0);
    expect(count(s.tasks, (t) => t.doneAt === null && t.dueOn === DEMO_TODAY)).toBeGreaterThan(0);
    expect(s.tasks.every((t) => !t.assignees.includes("superUser" as never))).toBe(true);
    expect(s.calendarEvents).toHaveLength(24);
    expect(new Set(s.calendarEvents.map((e) => e.type)).size).toBe(7);
    expect(s.files).toHaveLength(37);
    const bytes = s.files.reduce((sum, f) => sum + f.versions[f.versions.length - 1].bytes, 0);
    expect(bytes).toBe(FILES_TOTAL_BYTES);
    expect(new Set(s.files.map((f) => f.category)).size).toBe(5);
    expect(new Set(s.files.map((f) => f.kind)).size).toBe(5);
    expect(s.inbox).toHaveLength(16);
    expect(s.inbox.find((m) => m.key === "script-body")!.body).toContain("<script>");
    expect(priorityMailCount(s)).toBe(3);
    expect(dueThisWeekCount(s)).toBeGreaterThan(0);
  });
  it("finance", () => {
    expect(s.accounts).toHaveLength(4);
    expect(count(s.accounts, (a) => !a.isActive)).toBe(1);
    expect(s.categories).toHaveLength(14);
    expect(s.ledger).toHaveLength(120);
    expect(new Set(s.ledger.map((e) => e.id)).size).toBe(120);
    expect(s.costs).toHaveLength(8);
    expect(s.pricePlans).toHaveLength(9);
    expect(s.fxRates.some((r) => r.asOf === null)).toBe(true);
    expect(s.fxRates.some((r) => r.asOf !== null)).toBe(true);
    const months = new Set(s.costBookings.filter((b) => b.costId === "cost_app").map((b) => b.month));
    expect(months.size).toBeGreaterThanOrEqual(12);
    const unbooked = s.costs.filter((c) => c.expectedMinor > 0 && c.billing === "monthly" && !s.costBookings.some((b) => b.costId === c.id && b.month === "2027-01"));
    expect(unbooked.map((c) => c.id)).toEqual(["cost_assistant"]);
    expect(s.ledger.flatMap((e) => e.receipts)).toHaveLength(12);
    expect(s.stockCounts.map((c) => [c.year, c.status])).toEqual([[2026, "draft"], [2025, "confirmed"]]);
    const draft = s.stockCounts[0].lines;
    expect(count(draft, (l) => l.counted === null)).toBeGreaterThan(0);
    expect(count(draft, (l) => l.sizeDeleted)).toBe(1);
    const yearEnd = (l: (typeof draft)[number]) => (l.counted ?? 0) - l.toShip - ((l.stockAtCount ?? l.systemQty) - l.systemQty);
    expect(count(draft, (l) => l.counted !== null && yearEnd(l) < 0)).toBeGreaterThan(0);
    expect(count(draft, (l) => l.typedCostRappen !== null)).toBeGreaterThan(0);
    expect(count(draft, (l) => l.productCostRappen === null && l.typedCostRappen === null)).toBeGreaterThan(0);
    expect(new Set(s.ledger.map((e) => e.vatRateBp))).toEqual(new Set([null, 810, 260, 0]));
    expect(count(s.ledger, (e) => e.categoryId === null)).toBe(1);
    for (const po of s.purchaseOrders) if (po.financeEntryId) expect(s.ledger.some((e) => e.id === po.financeEntryId), po.number).toBe(true);
    expect(count(s.purchaseOrders, (po) => po.status === "received" && po.financeEntryId === null)).toBe(1);
    expect(monthlyRunningCost(s)).toBeGreaterThan(0);
    for (const b of s.costBookings) expect(s.ledger.some((e) => e.id === b.entryId), b.id).toBe(true);
    for (const e of s.ledger) expect(e.occurredOn <= DEMO_TODAY, e.id).toBe(true);
    expect(formatChf(monthlyRunningCost(s))).toMatch(/^CHF/);
  });
  it("runs the numbers rule for plans: no links anywhere", () => {
    for (const plan of s.pricePlans) {
      expect(plan.source).not.toMatch(/https?:/);
      expect(plan.source).toMatch(/public price page/);
    }
  });
  it("stripe events, outbox, activity", () => {
    expect(s.stripeEvents).toHaveLength(50);
    const events = (status: string) => count(s.stripeEvents, (e) => e.status === status);
    expect([events("processed"), events("duplicate"), events("failed"), events("pending")]).toEqual([44, 3, 2, 1]);
    expect(s.outbox).toHaveLength(180);
    const mails = (status: string) => count(s.outbox, (m) => m.status === status);
    expect([mails("queued"), mails("rendered"), mails("failed"), mails("skipped")]).toEqual([2, 170, 1, 7]);
    expect(s.activity).toHaveLength(120);
  });
  it("health: 20 runs, 26 pass and 1 warn, 16 on a manual run", () => {
    expect(s.healthRuns).toHaveLength(20);
    expect(HEALTH_CHECKS).toHaveLength(27);
    expect(MANUAL_CHECK_IDS).toHaveLength(16);
    expect(INVARIANTS).toHaveLength(25);
    expect(healthSummary(s)).toEqual({ pass: 26, warn: 1, fail: 0, skip: 0, total: 27 });
    expect(s.healthRuns[0].checks.find((c) => c.status === "warn")!.id).toBe("inbox.ingest_fresh");
    expect(liveStatus(s).state).toBe("warnings");
  });
  it("database and config: 64, 45, 35, all allowlisted, one rotation due", () => {
    expect(s.dbTables).toHaveLength(64);
    expect(new Set(s.dbTables.map((t) => t.name)).size).toBe(64);
    expect(s.migrations).toHaveLength(45);
    expect(s.migrations[0].name).toBe("0001_checkout_orders");
    expect(s.migrations[44].name.startsWith("0045_")).toBe(true);
    expect(s.configVars).toHaveLength(35);
    expect(new Set(s.configVars.map((c) => c.name)).size).toBe(35);
    for (const c of s.configVars) expect(CONFIG_ALLOWLIST.has(c.name), c.name).toBe(true);
    expect(rotationSummary(rotationRows(s.configVars, DEMO_TODAY)).due).toHaveLength(1);
  });
  it("deploys, CI, sign-ins, sessions", () => {
    expect(s.deploys).toHaveLength(20);
    expect(s.ciRuns).toHaveLength(15);
    expect(count(s.ciRuns, (r) => r.conclusion === "failure")).toBe(1);
    expect(s.pullRequests).toHaveLength(6);
    expect(s.signIns).toHaveLength(50);
    const dayAgo = DEMO_NOW_MS - 24 * 3_600_000;
    expect(count(s.signIns, (a) => a.outcome === "failure" && Date.parse(a.at) > dayAgo)).toBe(2);
    expect(lockStatus(s.signIns, DEMO_NOW_MS).locked).toBe(false);
    expect(s.sessions).toHaveLength(6);
    for (const d of s.deploys) expect(d.commit).toMatch(/^[0-9a-f]{7}$/);
  });
  it("shows the scenario with its tones", () => {
    const tone = Object.fromEntries(systemAreas(s).map((a) => [a.id, a.tone]));
    expect(tone).toEqual({ health: "warn", database: "ok", payments: "warn", email: "warn", security: "ok", config: "warn", deploys: "ok", ci: "bad" });
    expect(stockAlerts(s).out.length).toBeGreaterThanOrEqual(2);
    expect(stockAlerts(s).low.length).toBeGreaterThanOrEqual(2);
  });
});

describe("private words", () => {
  const SHARP_S = String.fromCharCode(223);
  it("keeps the seed's text on the placeholder hosts, in Swiss orthography", () => {
    const text = JSON.stringify(s);
    expect(text.includes(SHARP_S)).toBe(false);
    expect(text).not.toMatch(/https?:\/\/(?!shop\.example\.com)/);
    for (const c of s.customers) expect(c.email).toMatch(/@example\.com$/);
  });
  it("writes the store's source in Swiss orthography too", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk("src/store");
    for (const file of files) expect(readFileSync(file, "utf8").includes(SHARP_S), file).toBe(false);
  });
});

describe("selectors are safe inside useStore", () => {
  it("returns the same reference for the same state", () => {
    expect(healthSummary(s)).toBe(healthSummary(s));
    expect(stockAlerts(s)).toBe(stockAlerts(s));
    expect(systemAreas(s)).toBe(systemAreas(s));
    expect(liveStatus(s)).toBe(liveStatus(s));
    expect(bellItems(s, "owner")).toBe(bellItems(s, "owner"));
  });
  it("shows each profile only what it may open", () => {
    const kinds = (profile: Profile) => bellItems(s, profile).map((b) => b.kind);
    expect(kinds("owner")).toContain("orders");
    expect(kinds("studio")).not.toContain("orders");
    expect(kinds("studio")).toContain("inbox");
    expect(kinds("finance")).not.toContain("inbox");
    expect(kinds("warehouse")).toContain("low_stock");
  });
  it("reads the clock rules at any time", () => {
    expect(liveStatusAt(s, DEMO_NOW_MS + 4 * 3_600_000).state).toBe("overdue");
    const passing = { ...s, healthRuns: [{ ...s.healthRuns[0], overall: "pass" as const }, ...s.healthRuns.slice(1)] };
    expect(liveStatusAt(passing, DEMO_NOW_MS).state).toBe("live");
    expect(liveStatusAt(passing, DEMO_NOW_MS + 2 * 3_600_000).state).toBe("stale");
    expect(liveStatusAt({ ...s, healthRuns: [] }, DEMO_NOW_MS).state).toBe("none");
  });
});

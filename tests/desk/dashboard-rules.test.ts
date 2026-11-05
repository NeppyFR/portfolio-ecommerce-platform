import { beforeEach, describe, expect, it } from "vitest";
import {
  RANGE_IDS,
  axisLabel,
  dashboardKpis,
  dashboardTaskIds,
  labelledIndexes,
  monotonePath,
  newestOrders,
  plainName,
  rangeFor,
  revenueAxis,
  revenueSeries,
  salesByCollection,
  shortName,
  stockRows,
} from "@/desk/dashboard/dashboard-rules";
import { deltaPercent, itemSales, kpis, paidOrdersIn, previousRange } from "@/lib/metrics";
import { addTask, tickTask } from "@/store/actions/tasks";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { getState, resetStore } from "@/store/core";
import { stockAlerts } from "@/store/selectors";

beforeEach(() => resetStore());

describe("periods", () => {
  it("7 and 30 days end today and hold that many days", () => {
    expect(rangeFor("7d", "2027-01-08")).toEqual({ from: "2027-01-02", to: "2027-01-08" });
    expect(rangeFor("30d", "2027-01-08")).toEqual({ from: "2026-12-10", to: "2027-01-08" });
  });

  it("the year starts on the first of a month, eleven months back", () => {
    expect(rangeFor("1y", "2027-01-08")).toEqual({ from: "2026-02-01", to: "2027-01-08" });
  });
});

describe("KPI row, on the seed", () => {
  it.each(RANGE_IDS)("the chart's points add up to the revenue figure for %s", (id) => {
    const { orders } = getState();
    const k = dashboardKpis(orders, rangeFor(id, DEMO_TODAY));
    const sum = revenueSeries(orders, id, DEMO_TODAY).reduce((all, p) => all + p.value, 0);
    expect(sum).toBe(k.revenue.value);
    expect(k.revenue.value).toBeGreaterThan(0);
  });

  it("deltas compare with the same number of days right before", () => {
    const { orders } = getState();
    const range = rangeFor("7d", DEMO_TODAY);
    const now = kpis(paidOrdersIn(orders, range));
    const then = kpis(paidOrdersIn(orders, previousRange(range)));
    const k = dashboardKpis(orders, range);
    expect(k.orders.value).toBe(now.orders);
    expect(k.aov.value).toBe(now.aovRappen);
    expect(k.revenue.delta).toBe(Math.round((deltaPercent(now.grossRappen, then.grossRappen) as number) * 10) / 10);
  });

  it("no earlier orders gives no delta, not a made-up percent", () => {
    const k = dashboardKpis(getState().orders, rangeFor("1y", DEMO_TODAY));
    expect(k.revenue.delta).toBeNull();
    expect(k.orders.delta).toBeNull();
    expect(k.customers.delta).toBeNull();
    expect(k.aov.delta).toBeNull();
  });

  it("counts each customer once", () => {
    const { orders } = getState();
    const range = rangeFor("90d", DEMO_TODAY);
    const k = dashboardKpis(orders, range);
    expect(k.customers.value).toBeLessThan(k.orders.value);
    expect(k.customers.value).toBe(new Set(paidOrdersIn(orders, range).map((o) => o.customerId)).size);
  });
});

describe("sales by collection", () => {
  it.each(RANGE_IDS)("percents add up to exactly 100 for %s", (id) => {
    const { orders, products } = getState();
    const { slices } = salesByCollection(orders, products, rangeFor(id, DEMO_TODAY));
    expect(slices.length).toBeGreaterThan(0);
    expect(slices.length).toBeLessThanOrEqual(4);
    expect(slices.reduce((all, s) => all + s.percent, 0)).toBe(100);
  });

  it("the middle figure counts every item once", () => {
    const { orders, products } = getState();
    const range = rangeFor("90d", DEMO_TODAY);
    const { totalRappen } = salesByCollection(orders, products, range);
    let total = 0;
    for (const order of paidOrdersIn(orders, range)) for (const item of order.items) total += itemSales(item);
    expect(totalRappen).toBe(total);
  });

  it("an empty period has no slices", () => {
    const { orders, products } = getState();
    expect(salesByCollection(orders, products, { from: "2020-01-01", to: "2020-01-07" })).toEqual({ slices: [], totalRappen: 0 });
  });
});

describe("chart geometry", () => {
  it("the axis top stays above the highest value", () => {
    for (const max of [0, 1, 9900, 46700, 63000, 123456, 950000, 2500000]) {
      const axis = revenueAxis(max);
      expect(axis.top).toBeGreaterThan(max);
      expect(axis.ticks[0]).toBe(0);
      expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.top);
      expect(axis.ticks.length).toBeLessThanOrEqual(7);
    }
  });

  it("axis labels read as in the picture", () => {
    expect(axisLabel(0)).toBe("0");
    expect(axisLabel(40000)).toBe("400");
    expect(axisLabel(150000)).toBe("1.5k");
    expect(axisLabel(2000000)).toBe("20k");
  });

  it("the curve passes through every point and never swings past a value", () => {
    const points = [{ x: 0, y: 100 }, { x: 10, y: 20 }, { x: 20, y: 90 }, { x: 30, y: 90 }, { x: 40, y: 10 }];
    const d = monotonePath(points);
    const numbers = (d.match(/-?\d+(\.\d+)?/g) as string[]).map(Number);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    for (const p of points.slice(1)) expect(d).toContain(` ${p.x},${p.y}`);
  });

  it("the newest point always gets a label", () => {
    expect(labelledIndexes(7, 12)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const thin = labelledIndexes(30, 6);
    expect(thin[thin.length - 1]).toBe(29);
    expect(thin.length).toBeLessThanOrEqual(7);
    expect(labelledIndexes(0, 5)).toEqual([]);
  });
});

describe("rows", () => {
  it("recent orders are newest first", () => {
    const rows = newestOrders(getState().orders, 5);
    expect(rows[0].orderNumber).toBe("AL-1150");
    expect(rows).toHaveLength(5);
  });

  it("names and colours shorten as in the picture", () => {
    expect(shortName("Anna Muster", false)).toBe("A. Muster");
    expect(shortName("Anna Maria Muster", false)).toBe("A. Muster");
    expect(shortName("Erased customer", true)).toBe("Erased customer");
    expect(plainName("Travel Pouch, Cobalt")).toBe("Travel Pouch");
  });

  it("stock alerts put the emptiest first", () => {
    const rows = stockRows(stockAlerts(getState()));
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].left).toBeGreaterThanOrEqual(rows[i - 1].left);
  });
});

describe("tasks", () => {
  it("shows one finished task, then what comes next, and only what is yours or nobody's", () => {
    const { tasks } = getState();
    const ids = dashboardTaskIds(tasks, "warehouse", 5, DEMO_NOW_MS);
    expect(ids).toHaveLength(5);
    const rows = ids.map((id) => tasks.find((t) => t.id === id)!);
    expect(rows[0].doneAt).not.toBeNull();
    for (const row of rows.slice(1)) expect(row.doneAt).toBeNull();
    for (const row of rows) expect(row.assignees.length === 0 || row.assignees.includes("warehouse")).toBe(true);
  });

  it("a task just added stays on top after coming back, and a tick moves it to the finished row", () => {
    const added = addTask("list_studio", "Reorder swing tags");
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(dashboardTaskIds(getState().tasks, "owner", 5, DEMO_NOW_MS)[0]).toBe(added.data.id);
    tickTask(added.data.id);
    const after = getState().tasks.find((t) => t.id === added.data.id);
    expect(after?.doneAt).not.toBeNull();
    expect(dashboardTaskIds(getState().tasks, "owner", 5, DEMO_NOW_MS)[0]).toBe(added.data.id);
  });
});

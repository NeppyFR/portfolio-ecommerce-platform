import type { Order, Rappen } from "@/store/types";
import { dayKey, hourOf } from "./format";
import { addDays, addMonths, daysBetween, eachDay, isDayKey, isoWeek, monthBounds, monthOf, startOfWeek, weekdayIndex } from "./dates";

export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

export type DayRange = { from: string; to: string };
export type Kpis = { grossRappen: Rappen; refundsRappen: Rappen; netRappen: Rappen; orders: number; aovRappen: Rappen | null; unitsSold: number; discountsRappen: Rappen };
export type RangePreset = "7" | "30" | "90" | "this_month" | "last_month";

export const RANGE_PRESETS: RangePreset[] = ["7", "30", "90", "this_month", "last_month"];

/** Inclusive, ending today. */
export function presetRange(preset: RangePreset, today: string): DayRange {
  if (preset === "this_month") return { from: monthBounds(monthOf(today)).start, to: today };
  if (preset === "last_month") {
    const { start, end } = monthBounds(addMonths(monthOf(today), -1));
    return { from: start, to: end };
  }
  return { from: addDays(today, 1 - Number(preset)), to: today };
}

export function matchPreset(range: DayRange, today: string): RangePreset | null {
  return RANGE_PRESETS.find((p) => {
    const candidate = presetRange(p, today);
    return candidate.from === range.from && candidate.to === range.to;
  }) ?? null;
}

export type RangeProblem = "missing" | "not_a_day" | "reversed" | "too_long";

export function rangeProblem(from: string, to: string): RangeProblem | null {
  if (!from || !to) return "missing";
  if (!isDayKey(from) || !isDayKey(to)) return "not_a_day";
  if (from > to) return "reversed";
  return daysBetween(from, to) + 1 > MAX_RANGE_DAYS ? "too_long" : null;
}

export const rangeDays = (range: DayRange): number => daysBetween(range.from, range.to) + 1;

/** The same number of days immediately before. */
export function previousRange(range: DayRange): DayRange {
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

export const paidDay = (order: Pick<Order, "paidAt">): string | null => (order.paidAt ? dayKey(order.paidAt) : null);

/** Paid orders whose paid day falls inside the range. */
export function paidOrdersIn(orders: Order[], range: DayRange): Order[] {
  return orders.filter((o) => {
    const day = paidDay(o);
    return day !== null && day >= range.from && day <= range.to;
  });
}

export const itemSales = (item: Pick<Order["items"][number], "lineTotalRappen" | "discountRappen">): Rappen => item.lineTotalRappen - item.discountRappen;

export function kpis(orders: Order[]): Kpis {
  let gross = 0;
  let refunds = 0;
  let units = 0;
  let discounts = 0;
  for (const order of orders) {
    gross += order.totalRappen;
    refunds += order.refundedRappen;
    discounts += order.discountRappen;
    for (const item of order.items) units += item.quantity;
  }
  return {
    grossRappen: gross,
    refundsRappen: refunds,
    netRappen: gross - refunds,
    orders: orders.length,
    aovRappen: orders.length ? Math.round(gross / orders.length) : null,
    unitsSold: units,
    discountsRappen: discounts,
  };
}

/** Percent change. No base gives null, which prints as a dash. */
export const deltaPercent = (current: number, previous: number): number | null => (previous === 0 ? null : ((current - previous) / previous) * 100);

export type WeekBucket = { start: string; from: string; to: string; year: number; week: number; grossRappen: Rappen; orders: number };

export function revenueByWeek(orders: Order[], range: DayRange): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let start = startOfWeek(range.from); start <= range.to; start = addDays(start, 7)) {
    const { year, week } = isoWeek(start);
    const end = addDays(start, 6);
    buckets.push({ start, from: start < range.from ? range.from : start, to: end > range.to ? range.to : end, year, week, grossRappen: 0, orders: 0 });
  }
  for (const order of paidOrdersIn(orders, range)) {
    const bucket = buckets.find((b) => b.start === startOfWeek(paidDay(order) as string));
    if (bucket) {
      bucket.grossRappen += order.totalRappen;
      bucket.orders += 1;
    }
  }
  return buckets;
}

export function ordersByWeekday(orders: Order[], range: DayRange): { index: number; orders: number; grossRappen: Rappen }[] {
  const rows = Array.from({ length: 7 }, (_, index) => ({ index, orders: 0, grossRappen: 0 }));
  for (const order of paidOrdersIn(orders, range)) {
    const row = rows[weekdayIndex(paidDay(order) as string)];
    row.orders += 1;
    row.grossRappen += order.totalRappen;
  }
  return rows;
}

export type SalesRow = { key: string; salesRappen: Rappen; units: number };

/** Groups item sales by whatever keys an item belongs to. A product in two collections counts in both. */
export function salesBy(orders: Order[], keysOf: (item: Order["items"][number]) => string[]): SalesRow[] {
  const rows = new Map<string, SalesRow>();
  for (const order of orders) {
    for (const item of order.items) {
      for (const key of keysOf(item)) {
        const row = rows.get(key) ?? { key, salesRappen: 0, units: 0 };
        row.salesRappen += itemSales(item);
        row.units += item.quantity;
        rows.set(key, row);
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.salesRappen - a.salesRappen || a.key.localeCompare(b.key));
}

export type Profit = { profitRappen: Rappen; salesRappen: Rappen; costRappen: Rappen; itemsWithCost: number; itemsWithoutCost: number };

/** Over lines with a recorded unit cost only, never guessed. Before refunds and shipping. */
export function estimatedProfit(orders: Order[], costOf: (productId: string) => Rappen | null): Profit {
  const out: Profit = { profitRappen: 0, salesRappen: 0, costRappen: 0, itemsWithCost: 0, itemsWithoutCost: 0 };
  for (const order of orders) {
    for (const item of order.items) {
      const cost = costOf(item.productId);
      if (cost === null) {
        out.itemsWithoutCost += item.quantity;
        continue;
      }
      out.itemsWithCost += item.quantity;
      out.salesRappen += itemSales(item);
      out.costRappen += cost * item.quantity;
    }
  }
  out.profitRappen = out.salesRappen - out.costRappen;
  return out;
}

/** One value per hour, 0 to 23, for hourly revenue bars. */
export function hourlyRevenue(orders: Order[], day: string): Rappen[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const order of orders) {
    if (order.paidAt && paidDay(order) === day) hours[hourOf(order.paidAt)] += order.totalRappen;
  }
  return hours;
}

/** Oldest first, for the 7-day sparkline. */
export function dailyRevenue(orders: Order[], range: DayRange): { day: string; grossRappen: Rappen; orders: number }[] {
  const rows = eachDay(range.from, range.to).map((day) => ({ day, grossRappen: 0, orders: 0 }));
  for (const order of paidOrdersIn(orders, range)) {
    const row = rows.find((r) => r.day === paidDay(order));
    if (row) {
      row.grossRappen += order.totalRappen;
      row.orders += 1;
    }
  }
  return rows;
}

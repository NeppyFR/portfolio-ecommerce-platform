import { addDays, addMonths, monthBounds, monthOf, weekdayIndex } from "@/lib/dates";
import { dailyRevenue, deltaPercent, itemSales, kpis, paidOrdersIn, previousRange, revenueByWeek, salesBy, type DayRange } from "@/lib/metrics";
import type { Order, Product, Rappen, Task, Variant } from "@/store/types";

export type RangeId = "7d" | "30d" | "90d" | "1y";
export const RANGE_IDS: RangeId[] = ["7d", "30d", "90d", "1y"];

/** 7, 30 and 90 end today. The year starts on the first of a month, so its twelve points add up to the headline. */
export function rangeFor(id: RangeId, today: string): DayRange {
  if (id === "1y") return { from: monthBounds(addMonths(monthOf(today), -11)).start, to: today };
  return { from: addDays(today, id === "7d" ? -6 : id === "30d" ? -29 : -89), to: today };
}

export type Delta = number | null;
export type DashboardKpis = {
  revenue: { value: Rappen; delta: Delta };
  orders: { value: number; delta: Delta };
  customers: { value: number; delta: Delta };
  aov: { value: Rappen | null; delta: Delta };
};

const oneDecimal = (value: number | null): Delta => (value === null ? null : Math.round(value * 10) / 10);
const distinctCustomers = (orders: Order[]): number => new Set(orders.map((o) => o.customerId)).size;

/** Against the same number of days immediately before. No base gives null, which prints as a dash. */
export function dashboardKpis(orders: Order[], range: DayRange): DashboardKpis {
  const paid = paidOrdersIn(orders, range);
  const before = paidOrdersIn(orders, previousRange(range));
  const now = kpis(paid);
  const then = kpis(before);
  const customers = distinctCustomers(paid);
  return {
    revenue: { value: now.grossRappen, delta: oneDecimal(deltaPercent(now.grossRappen, then.grossRappen)) },
    orders: { value: now.orders, delta: oneDecimal(deltaPercent(now.orders, then.orders)) },
    customers: { value: customers, delta: oneDecimal(deltaPercent(customers, distinctCustomers(before))) },
    aov: { value: now.aovRappen, delta: oneDecimal(deltaPercent(now.aovRappen ?? 0, then.aovRappen ?? 0)) },
  };
}

export type RevenuePoint =
  | { kind: "day"; key: string; day: string; value: Rappen }
  | { kind: "week"; key: string; week: number; from: string; to: string; value: Rappen }
  | { kind: "month"; key: string; month: string; value: Rappen };

/** Days for 7 and 30, ISO weeks for 90, calendar months for the year. */
export function revenueSeries(orders: Order[], id: RangeId, today: string): RevenuePoint[] {
  const range = rangeFor(id, today);
  if (id === "7d" || id === "30d") return dailyRevenue(orders, range).map((d) => ({ kind: "day", key: d.day, day: d.day, value: d.grossRappen }));
  if (id === "90d") return revenueByWeek(orders, range).map((w) => ({ kind: "week", key: w.start, week: w.week, from: w.from, to: w.to, value: w.grossRappen }));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(monthOf(range.from), i));
  const paid = paidOrdersIn(orders, range);
  return months.map((month) => {
    const { start, end } = monthBounds(month);
    return { kind: "month", key: month, month, value: kpis(paidOrdersIn(paid, { from: start, to: end })).grossRappen };
  });
}

export type Axis = { top: number; ticks: number[] };

/** A round top, at least half a step above the highest value, so the line keeps some air and the tooltip clears a peak. */
export function revenueAxis(maxRappen: number): Axis {
  const chf = Math.max(0, maxRappen) / 100;
  if (chf === 0) return { top: 40000, ticks: [0, 10000, 20000, 30000, 40000] };
  const rough = chf / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normal = rough / magnitude;
  const step = Math.max(1, (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10) * magnitude);
  let top = Math.ceil(chf / step) * step;
  if (top - chf < step * 0.5) top += step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100));
  return { top: Math.round(top * 100), ticks };
}

/** `0`, `400`, `1.5k`, `20k`. */
export function axisLabel(rappen: number): string {
  const chf = rappen / 100;
  return chf >= 1000 ? `${Number((chf / 1000).toFixed(1))}k` : String(Math.round(chf));
}

type Pt = { x: number; y: number };

/** A monotone cubic through every point. It never swings past a value, so the curve shows no revenue that did not happen. */
export function monotonePath(points: Pt[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  tangent.push(slope[n - 2]);
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += `C${r(points[i].x + h)},${r(points[i].y + tangent[i] * h)} ${r(points[i + 1].x - h)},${r(points[i + 1].y - tangent[i + 1] * h)} ${r(points[i + 1].x)},${r(points[i + 1].y)}`;
  }
  return d;
}

/** Which points get a label on the axis: evenly spaced and always the newest one. */
export function labelledIndexes(count: number, room: number): number[] {
  if (count <= 0) return [];
  const most = Math.max(2, Math.min(count, Math.floor(room)));
  const step = Math.ceil((count - 1) / (most - 1)) || 1;
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}

export type Slice = { key: string; salesRappen: Rappen; percent: number };
export const NO_COLLECTION = "none";
export const OTHER_COLLECTIONS = "other";

/** Whole percents that add up to exactly 100: the largest remainders get the leftover points. */
function wholePercents(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map((v) => Math.floor(v));
  let left = 100 - floors.reduce((sum, v) => sum + v, 0);
  const order = exact.map((v, i) => ({ i, rest: v - Math.floor(v) })).sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Item sales by collection, as the analytics notes define them: a product in two collections counts in both,
 * products in none land in their own group. `totalRappen` counts every item once, so it is not the sum of the slices.
 */
export function salesByCollection(orders: Order[], products: Product[], range: DayRange, most = 4): { slices: Slice[]; totalRappen: Rappen } {
  const paid = paidOrdersIn(orders, range);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = salesBy(paid, (item) => {
    const ids = byId.get(item.productId)?.collectionIds ?? [];
    return ids.length > 0 ? ids : [NO_COLLECTION];
  }).filter((r) => r.salesRappen > 0);
  const head = rows.length > most ? rows.slice(0, most - 1) : rows;
  const tail = rows.length > most ? rows.slice(most - 1) : [];
  const merged = [...head.map((r) => ({ key: r.key, salesRappen: r.salesRappen })), ...(tail.length > 0 ? [{ key: OTHER_COLLECTIONS, salesRappen: tail.reduce((sum, r) => sum + r.salesRappen, 0) }] : [])];
  const percents = wholePercents(merged.map((r) => r.salesRappen));
  let total = 0;
  for (const order of paid) for (const item of order.items) total += itemSales(item);
  return { slices: merged.map((r, i) => ({ ...r, percent: percents[i] })), totalRappen: total };
}

export function newestOrders(orders: Order[], count: number): Order[] {
  return [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, count);
}

/** `Anna Muster` gives `A. Muster`. An erased customer keeps the placeholder as it stands. */
export function shortName(name: string, erased: boolean): string {
  if (erased) return name;
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

export type StockRow = { product: Product; variant: Variant; left: number };

/** Lowest available first, so the top row is the one to restock. */
export function stockRows(alerts: { low: { product: Product; variant: Variant }[]; out: { product: Product; variant: Variant }[] }): StockRow[] {
  return [...alerts.out, ...alerts.low]
    .map((a) => ({ ...a, left: a.variant.stock - a.variant.reserved }))
    .sort((a, b) => a.left - b.left || a.variant.sku.localeCompare(b.variant.sku));
}

/** The name before the colour, because the second line carries the colour. */
export const plainName = (name: string): string => name.split(",")[0].trim();

const PRIORITY: Record<Task["priority"], number> = { high: 0, normal: 1, low: 2 };

/**
 * What was just added here, the newest finished task, then what comes next: earliest due first, high priority before low, undated last.
 * A person sees what is theirs or nobody's; superUser (person null) sees everything.
 */
export function dashboardTaskIds(tasks: Task[], person: string | null, count: number, sinceMs: number): string[] {
  const mine = tasks.filter((t) => person === null || t.assignees.length === 0 || (t.assignees as string[]).includes(person));
  const done = mine.filter((t) => t.doneAt !== null).sort((a, b) => (b.doneAt as string).localeCompare(a.doneAt as string)).slice(0, 1);
  const open = mine.filter((t) => t.doneAt === null);
  const isFresh = (t: Task) => Date.parse(t.createdAt) >= sinceMs;
  const fresh = open.filter(isFresh).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rest = open
    .filter((t) => !isFresh(t))
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || PRIORITY[a.priority] - PRIORITY[b.priority] || a.position - b.position);
  return [...fresh, ...done, ...rest].slice(0, count).map((t) => t.id);
}

export type SeriesWords = { weekdays: string[]; months: string[]; dayMonth: string; week: string };

const dayMonth = (day: string, w: SeriesWords): string => w.dayMonth.replace("{d}", String(Number(day.slice(8, 10)))).replace("{m}", w.months[Number(day.slice(5, 7)) - 1]);

export function axisWord(point: RevenuePoint, id: RangeId, w: SeriesWords): string {
  if (point.kind === "day") return id === "7d" ? w.weekdays[weekdayIndex(point.day)] : dayMonth(point.day, w);
  if (point.kind === "week") return dayMonth(point.from, w);
  return w.months[Number(point.month.slice(5, 7)) - 1];
}

/** The tooltip's first line. */
export function pointWord(point: RevenuePoint, w: SeriesWords, monthName: (month: string) => string): string {
  if (point.kind === "day") return `${w.weekdays[weekdayIndex(point.day)]}, ${dayMonth(point.day, w)}`;
  if (point.kind === "week") return `${w.week.replace("{n}", String(point.week))} · ${dayMonth(point.from, w)} – ${dayMonth(point.to, w)}`;
  return monthName(point.month);
}

/** A whole-franc figure for the big numbers. The exact amount stays in the title attribute. */
export const roundToFranc = (rappen: Rappen): Rappen => Math.round(rappen / 100) * 100;

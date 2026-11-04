import { csvAmount, toCsv, type CsvCell } from "@/lib/csv";
import { dailyRevenue, kpis, paidOrdersIn, itemSales, type DayRange, type Kpis } from "@/lib/metrics";
import { dayKey, formatDate } from "@/lib/format";
import { compareVariants } from "@/lib/product-rules";
import type { Order, Product } from "@/store/types";

/** Rounded to one decimal, the form the tiles print. Null stays null. */
export const roundDelta = (percent: number | null): number | null => (percent === null ? null : Math.round(percent * 10) / 10);

/** Margin as a whole-tenth percent, or null when nothing was sold with a cost. */
export const marginPercent = (profitRappen: number, salesRappen: number): number | null => (salesRappen > 0 ? Math.round((profitRappen / salesRappen) * 1000) / 10 : null);

/** `1'284` under ten thousand, `12.5k` above: the axis and hover form of a CHF value. */
export function chfShort(rappen: number): string {
  const chf = Math.round(rappen / 100);
  if (Math.abs(chf) >= 10_000) return `${(chf / 1000).toFixed(1)}k`;
  return String(chf).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export type CsvWords = {
  day: string; total: string; orders: string; revenue: string; refunds: string; net: string; units: string; discounts: string;
  order: string; paid: string; status: string; payment: string; fulfilment: string; customer: string; email: string; subtotal: string; discount: string; discountCode: string; shipping: string; refunded: string;
  product: string; sku: string; size: string; colour: string; category: string; quantity: string; unitPrice: string; lineTotal: string; sales: string; unitCost: string; profit: string;
  onHand: string; reserved: string; available: string; soldInRange: string;
};

const unitsIn = (order: Order): number => order.items.reduce((sum, item) => sum + item.quantity, 0);

function kpiCells(k: Kpis): CsvCell[] {
  return [k.orders, csvAmount(k.grossRappen), csvAmount(k.refundsRappen), csvAmount(k.netRappen), k.unitsSold, csvAmount(k.discountsRappen)];
}

/** One row per day of the range, then a total row. */
export function summaryCsv(orders: Order[], range: DayRange, w: CsvWords): string {
  const rows: CsvCell[][] = dailyRevenue(orders, range).map(({ day }) => [day, ...kpiCells(kpis(paidOrdersIn(orders, { from: day, to: day })))]);
  rows.push([w.total, ...kpiCells(kpis(paidOrdersIn(orders, range)))]);
  return toCsv([w.day, w.orders, w.revenue, w.refunds, w.net, w.units, w.discounts], rows);
}

const paymentOf = (o: Order): string => (o.refundedRappen <= 0 ? "paid" : o.refundedRappen >= o.totalRappen ? "refunded" : "partially_refunded");
const fulfilmentOf = (o: Order): string => ({ pending: "unfulfilled", paid: "unfulfilled", packed: "packed", shipped: "shipped", delivered: "delivered", cancelled: "cancelled", refunded: o.shippedAt ? "shipped" : "unfulfilled" })[o.status];

export function ordersCsv(orders: Order[], range: DayRange, w: CsvWords): string {
  const rows: CsvCell[][] = paidOrdersIn(orders, range).map((o) => [
    o.orderNumber, o.paidAt ? dayKey(o.paidAt) : "", o.status, paymentOf(o), fulfilmentOf(o), o.customerName, o.email, unitsIn(o),
    csvAmount(o.subtotalRappen), csvAmount(o.discountRappen), o.discountCode ?? "", csvAmount(o.shippingRappen), csvAmount(o.totalRappen), csvAmount(o.refundedRappen), csvAmount(o.totalRappen - o.refundedRappen),
  ]);
  return toCsv([w.order, w.paid, w.status, w.payment, w.fulfilment, w.customer, w.email, w.units, w.subtotal, w.discount, w.discountCode, w.shipping, w.total, w.refunded, w.net], rows);
}

/** A line without a recorded cost leaves both cost cells empty, never zero. */
export function orderItemsCsv(orders: Order[], products: Product[], range: DayRange, w: CsvWords, categoryLabel: (category: Product["category"]) => string): string {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows: CsvCell[][] = [];
  for (const o of paidOrdersIn(orders, range)) {
    for (const item of o.items) {
      const product = byId.get(item.productId);
      const cost = product?.costRappen ?? null;
      const sales = itemSales(item);
      rows.push([
        o.orderNumber, o.paidAt ? dayKey(o.paidAt) : "", item.name, item.sku, item.size, item.color, product ? categoryLabel(product.category) : "", item.quantity,
        csvAmount(item.unitPriceRappen), csvAmount(item.lineTotalRappen), csvAmount(item.discountRappen), csvAmount(sales),
        cost === null ? null : csvAmount(cost), cost === null ? null : csvAmount(sales - cost * item.quantity),
      ]);
    }
  }
  return toCsv([w.order, w.paid, w.product, w.sku, w.size, w.colour, w.category, w.quantity, w.unitPrice, w.lineTotal, w.discount, w.sales, w.unitCost, w.profit], rows);
}

export function inventoryCsv(orders: Order[], products: Product[], range: DayRange, w: CsvWords): string {
  const sold = new Map<string, number>();
  for (const o of paidOrdersIn(orders, range)) for (const item of o.items) sold.set(item.variantId, (sold.get(item.variantId) ?? 0) + item.quantity);
  const rows: CsvCell[][] = products.flatMap((p) =>
    p.variants.slice().sort(compareVariants).map((v) => [p.nameEn, v.sku, v.size, v.color, v.stock, v.reserved, v.stock - v.reserved, sold.get(v.id) ?? 0]),
  );
  return toCsv([w.product, w.sku, w.size, w.colour, w.onHand, w.reserved, w.available, w.soldInRange], rows);
}

/** `01.12.2026 – 30.12.2026` */
export const rangeText = (range: DayRange): string => `${formatDate(range.from)} – ${formatDate(range.to)}`;

/** Round axis steps: at most about `target` steps of 1, 2, 5 or 10 times a power of ten, whole numbers only. Always ends at or above `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / magnitude;
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick);
  return ticks;
}

/** Print every nth label so at most `room` of them show. */
export const labelEvery = (count: number, room: number): number => Math.max(1, Math.ceil(count / room));

/** `13.10.` from `2026-10-13`. */
export const dayMonth = (day: string): string => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

/** Cost and profit as shares of sales, for the split bar. Rounded to a tenth; a loss shows as all cost. */
export function profitSplit(salesRappen: number, costRappen: number): { cost: number; profit: number } {
  if (salesRappen <= 0) return { cost: 0, profit: 0 };
  const cost = Math.min(100, Math.round((costRappen / salesRappen) * 1000) / 10);
  return { cost, profit: Math.round((100 - cost) * 10) / 10 };
}

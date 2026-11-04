import { isOpenReturn } from "@/desk/commerce/orders/rules/returns";
import type { Customer, Order, Rappen, ReturnRecord, State } from "@/store/types";

export type CustomerRow = { id: string; fullName: string; email: string; orders: number; spentRappen: Rappen; lastOrderAt: string | null; erased: boolean };

/** Orders, spent and last order count only orders that were paid. Spent is total less refunds. */
export function customerRows(customers: Customer[], orders: Order[]): CustomerRow[] {
  const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
  for (const order of orders) {
    if (!order.paidAt) continue;
    const row = stats.get(order.customerId) ?? { orders: 0, spent: 0, last: null };
    row.orders += 1;
    row.spent += order.totalRappen - order.refundedRappen;
    if (!row.last || order.placedAt > row.last) row.last = order.placedAt;
    stats.set(order.customerId, row);
  }
  return customers
    .map((c) => {
      const row = stats.get(c.id);
      return { id: c.id, fullName: c.fullName, email: c.email, orders: row?.orders ?? 0, spentRappen: row?.spent ?? 0, lastOrderAt: row?.last ?? null, erased: c.erased };
    })
    .sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? "") || a.fullName.localeCompare(b.fullName));
}

export const repeatCount = (rows: CustomerRow[]): number => rows.filter((r) => !r.erased && r.orders > 1).length;

export function searchCustomers(rows: CustomerRow[], q: string): CustomerRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => r.fullName.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle));
}

const OPEN_STATUSES: Order["status"][] = ["pending", "paid", "packed", "shipped"];

/** Erasing waits until every order is settled and every return is done. */
export function hasOpenBusiness(customerId: string, orders: Order[], returns: ReturnRecord[]): boolean {
  const own = orders.filter((o) => o.customerId === customerId);
  if (own.some((o) => OPEN_STATUSES.includes(o.status))) return true;
  const numbers = new Set(own.map((o) => o.orderNumber));
  return returns.some((r) => numbers.has(r.orderNumber) && isOpenReturn(r));
}

/** Everything stored about one person, for the data request's JSON. */
export function customerExport(s: Pick<State, "customers" | "orders" | "returns" | "drops" | "outbox">, customerId: string) {
  const customer = s.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const orders = s.orders.filter((o) => o.customerId === customerId);
  const numbers = new Set(orders.map((o) => o.orderNumber));
  return {
    demo: "Invented data from a static showcase. Nothing here describes a real person.",
    customer: { id: customer.id, fullName: customer.fullName, email: customer.email, phone: customer.phone, locale: customer.locale, createdAt: customer.createdAt, addresses: customer.addresses, notes: customer.notes },
    orders: orders.map((o) => ({ orderNumber: o.orderNumber, placedAt: o.placedAt, status: o.status, totalRappen: o.totalRappen, refundedRappen: o.refundedRappen, shippingAddress: o.shippingAddress, items: o.items.map((i) => ({ name: i.name, size: i.size, sku: i.sku, quantity: i.quantity })), notes: o.notes })),
    returns: s.returns.filter((r) => numbers.has(r.orderNumber)).map((r) => ({ returnNo: r.returnNo, orderNumber: r.orderNumber, status: r.status, reason: r.reason, note: r.note })),
    waitlists: customer.waitlist,
    emails: s.outbox.filter((m) => m.orderNumber && numbers.has(m.orderNumber)).map((m) => ({ template: m.template, to: m.to, status: m.status, orderNumber: m.orderNumber })),
  };
}

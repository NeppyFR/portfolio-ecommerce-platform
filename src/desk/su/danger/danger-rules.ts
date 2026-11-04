import { LAST_SEEDED_ORDER, ORDER_PREFIX } from "@/lib/brand";
import type { Order, State } from "@/store/types";

export type DangerCard = "local" | "demo" | "test";
export const DANGER_CARDS: DangerCard[] = ["local", "demo", "test"];

/** Fixed English in both languages, as in the real system. Matched exactly. */
export const DANGER_PHRASES: Record<DangerCard, string> = {
  local: "remove local test orders",
  demo: "remove demo data",
  test: "remove test leftovers",
};
export const SIGN_OUT_PHRASE = "sign out everyone else";

export const phraseMatches = (typed: string, phrase: string): boolean => typed === phrase;

export type Counts = Record<string, number>;

const isSessionOrder = (o: Pick<Order, "orderNumber">) => Number(o.orderNumber.slice(ORDER_PREFIX.length)) > LAST_SEEDED_ORDER;

/** A "local test order" here is one made in this tab: it only exists until the next reload. */
export function sessionOrders(s: Pick<State, "orders">): Order[] {
  return s.orders.filter(isSessionOrder);
}

export function localCounts(s: Pick<State, "orders" | "outbox" | "stripeEvents">): Counts {
  const orders = sessionOrders(s);
  const numbers = new Set(orders.map((o) => o.orderNumber));
  const buyers = new Set(orders.map((o) => o.customerId));
  const others = new Set(s.orders.filter((o) => !isSessionOrder(o)).map((o) => o.customerId));
  return {
    orders: orders.length,
    customers: [...buyers].filter((id) => id !== null && !others.has(id)).length,
    checkout_sessions: orders.length,
    emails: s.outbox.filter((m) => m.orderNumber !== null && numbers.has(m.orderNumber)).length,
    stripe_events: s.stripeEvents.filter((e) => e.orderNumber !== null && numbers.has(e.orderNumber)).length,
  };
}

export function demoCounts(s: Pick<State, "products" | "orders" | "customers" | "discounts" | "campaigns" | "outbox" | "inbox" | "activity">): Counts {
  return { products: s.products.length, orders: s.orders.length, customers: s.customers.length, codes: s.discounts.length, campaigns: s.campaigns.length, emails: s.outbox.length, inbox: s.inbox.length, activity: s.activity.length };
}

/** What a killed browser-test run would leave behind. Only the rows above zero print. */
export const TEST_COUNTS: Counts = {
  orders: 6, checkout_sessions: 9, stripe_events: 14, products: 2, collections: 1, tags: 0, discount_codes: 3, customers: 4,
  inbox_messages: 2, staff_sessions: 7, login_attempts: 11, rate_limit_hits: 5, test_session_activity: 0, test_feature_access: 2, test_access_activity: 3,
};

export function dangerCounts(card: DangerCard, s: State): Counts {
  if (card === "local") return localCounts(s);
  if (card === "demo") return demoCounts(s);
  return TEST_COUNTS;
}

export const totalOf = (counts: Counts): number => Object.values(counts).reduce((sum, n) => sum + n, 0);

export const shownRows = (counts: Counts): [string, number][] => Object.entries(counts).filter(([, n]) => n > 0);

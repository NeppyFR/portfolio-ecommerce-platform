import type { DbTable, State } from "@/store/types";

const sum = <T>(rows: T[], count: (row: T) => number): number => rows.reduce((total, row) => total + count(row), 0);

/** Bytes per row with indexes, roughly: logs and bodies are wide, join tables are narrow. */
const ROW_BYTES: Record<string, number> = {
  activity_log: 420,
  email_outbox: 1800,
  inbox_messages: 2600,
  order_events: 360,
  orders: 980,
  stock_movements: 310,
  stripe_events: 1400,
  workspace_files: 540,
};
const DEFAULT_ROW_BYTES = 260;
const BASE_BYTES = 24_000;

/** The tables the demo's own data can answer for. A row count here always agrees with the screen that shows it. */
function liveRows(s: State): Record<string, number> {
  return {
    activity_log: s.activity.length,
    calendar_events: s.calendarEvents.length,
    campaigns: s.campaigns.length,
    collections: s.collections.length,
    cost_fx_rates: s.fxRates.length,
    cost_price_plans: s.pricePlans.length,
    customers: s.customers.length,
    discount_codes: s.discounts.length,
    drops: s.drops.length,
    email_outbox: s.outbox.length,
    feature_access: s.featureSwitches.length,
    finance_accounts: s.accounts.length,
    finance_categories: s.categories.length,
    finance_entries: s.ledger.length,
    health_check_runs: s.healthRuns.length,
    inbox_messages: s.inbox.length,
    login_attempts: s.signIns.length,
    order_events: sum(s.orders, (o) => o.events.length),
    order_items: sum(s.orders, (o) => o.items.length),
    order_notes: sum(s.orders, (o) => o.notes.length),
    order_refunds: sum(s.orders, (o) => o.refunds.length),
    order_returns: s.returns.length,
    orders: s.orders.length,
    product_variants: sum(s.products, (p) => p.variants.length),
    products: s.products.length,
    purchase_orders: s.purchaseOrders.length,
    recurring_costs: s.costs.length,
    settings: 1,
    staff_sessions: s.sessions.length,
    staff_users: s.team.length,
    stock_counts: s.stockCounts.length,
    stock_movements: s.movements.length,
    stripe_events: s.stripeEvents.length,
    suppliers: s.suppliers.length,
    tags: s.tags.length,
    task_lists: s.taskLists.length,
    tasks: s.tasks.length,
    workspace_files: s.files.length,
  };
}

/** Rows and sizes per table, biggest first. Tables the demo does not model keep a small count from the seed. */
export function tableFacts(s: State): DbTable[] {
  const live = liveRows(s);
  return s.dbTables
    .map((table) => {
      const rows = live[table.name] ?? table.rows % 60;
      return { name: table.name, rows, sizeBytes: BASE_BYTES + rows * (ROW_BYTES[table.name] ?? DEFAULT_ROW_BYTES) };
    })
    .sort((a, b) => b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name));
}

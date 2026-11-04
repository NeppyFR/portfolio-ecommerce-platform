import { ACCOUNT_ID, SHOP_DOMAIN, eventId } from "@/lib/brand";
import { addDays } from "@/lib/dates";
import { DEMO_TODAY } from "../clock";
import { renderEmailParts } from "../emails";
import type { AccessChange, ActivityRow, CheckStatus, CiRun, ConfigKind, ConfigNeed, ConfigVar, DbFacts, DbTable, Deploy, HealthCheck, HealthRun, Migration, Notification, Order, OutboxEmail, Profile, PullRequestRow, SignInAttempt, StaffSession, StorageBucket, StripeEvent } from "../types";
import { plusMinutes, type Rng, zurich } from "./rng";

const NOW = zurich(DEMO_TODAY, 14, 2);

/** The 27 watchdog checks, in order. `target` checks need a deployed address, `security` ones may never be skipped once deployed. */
export const HEALTH_CHECKS: { id: string; target: boolean; security: boolean; reason: string }[] = [
  { id: "env.schema", target: false, security: false, reason: "all 35 variables needed so far are set and well formed" },
  { id: "site.reachable", target: true, security: false, reason: "/api/health answered 200 in 182 ms" },
  { id: "site.deployment", target: true, security: false, reason: "test mode, dev email, origin and env tag as expected" },
  { id: "admin.sweep", target: true, security: true, reason: "41 unauthenticated requests, none reached admin content" },
  { id: "admin.cookie", target: true, security: true, reason: "alg=none, random-secret and expired tokens were all refused" },
  { id: "supabase.reachable", target: false, security: false, reason: "the database answered in 96 ms" },
  { id: "supabase.auth_signup", target: false, security: false, reason: "new sign-ups and anonymous sign-ins are off" },
  { id: "supabase.migrations", target: false, security: false, reason: "all 45 migration files are applied" },
  { id: "rls.anon_probes", target: false, security: true, reason: "22 publishable-key probes: all denied or empty" },
  { id: "db.invariants", target: false, security: false, reason: "no invariant violations" },
  { id: "stock.reservations_stale", target: false, security: false, reason: "no reservation held past its expiry" },
  { id: "stripe.mode", target: false, security: true, reason: `test mode on account ${ACCOUNT_ID}` },
  { id: "stripe.webhook_endpoint", target: false, security: false, reason: "webhook destination enabled with the 4 events on the pinned API version" },
  { id: "webhook.route_alive", target: true, security: true, reason: "bogus signature rejected with 400" },
  { id: "stripe.fulfilment_gap", target: false, security: false, reason: "61 paid sessions in 48 h, every one has its order" },
  { id: "email.provider", target: false, security: false, reason: "dev provider here and on the target, no outbox row from another provider" },
  { id: "email.outbox_coverage", target: false, security: false, reason: "every paid order has its confirmation, nothing stuck in the outbox" },
  { id: "inbox.ingest_fresh", target: false, security: false, reason: "last ingest 45 min ago" },
  { id: "inbox.unsorted_stale", target: false, security: false, reason: "no real mail waiting to be sorted for over 3 h" },
  { id: "inbox.rls", target: false, security: false, reason: "the publishable key cannot read the inbox (6 probes)" },
  { id: "inbox.prompt_sync", target: false, security: false, reason: "the inbox task prompt matches the classifier contract" },
  { id: "headers.security", target: true, security: true, reason: "security headers present on / and /admin/login" },
  { id: "headers.noindex", target: true, security: true, reason: "noindex on / and /admin/login, robots.txt disallows crawling" },
  { id: "exposure.paths", target: true, security: true, reason: "19 sensitive paths (source maps included) serve nothing" },
  { id: "exposure.bundle", target: true, security: true, reason: "34 public chunks scanned, no secret or secret variable name" },
  { id: "tls.certificate", target: true, security: false, reason: "certificate valid for 61 more days" },
  { id: "npm.audit", target: false, security: false, reason: "no high or critical advisories in production dependencies (2 moderate, 1 low)" },
];

/** A manual run skips anything that needs a deployed address, and the audit: 16 of the 27. */
export const MANUAL_CHECK_IDS: string[] = HEALTH_CHECKS.filter((c) => !c.target && c.id !== "npm.audit").map((c) => c.id);

export const INVARIANTS: { id: string; severity: "fail" | "warn" | "fail / warn"; meaning: string }[] = [
  { id: "I01", severity: "fail", meaning: "stock differs from the sum of its movements" },
  { id: "I02", severity: "fail", meaning: "reserved differs from the open checkout items" },
  { id: "I03", severity: "fail", meaning: "totals mismatch (subtotal, allocation, total formula)" },
  { id: "I04", severity: "fail", meaning: "paid order whose sale and restock movements do not match its items" },
  { id: "I05", severity: "fail", meaning: "paid for over 10 min without a confirmation outbox row" },
  { id: "I06", severity: "warn", meaning: "outbox row queued over 10 min, or failed" },
  { id: "I07", severity: "fail", meaning: "expired reservation still held after 15 min" },
  { id: "I08", severity: "fail", meaning: "completed checkout without order, or order without its checkout" },
  { id: "I09", severity: "fail / warn", meaning: "times used differs from redemptions (fail); over the usage limit (warn)" },
  { id: "I10", severity: "fail", meaning: "status differs from its derived value; refunded differs from the sum of refunds" },
  { id: "I11", severity: "warn", meaning: "shipped without a shipping outbox row" },
  { id: "I12", severity: "warn", meaning: "unresolved stock conflict or attention" },
  { id: "I13", severity: "warn", meaning: "active product without an active size" },
  { id: "I14", severity: "fail", meaning: "a public table without row-level security" },
  { id: "I15", severity: "fail", meaning: "table or column privileges outside the allowlist" },
  { id: "I16", severity: "fail", meaning: "function execute rights outside the allowlist, or a definer function without a fixed search path" },
  { id: "I17", severity: "fail", meaning: "storage write policies for the public keys, or bucket config drift" },
  { id: "I18", severity: "fail", meaning: "settings row missing, active people not 4, or the superUser row inactive" },
  { id: "I19", severity: "fail", meaning: "order number sequence behind the highest live number" },
  { id: "I20", severity: "fail", meaning: "a real row referencing a demo customer" },
  { id: "I21", severity: "warn", meaning: "inbox rows older than retention (prune missed)" },
  { id: "I22", severity: "warn", meaning: "inbox mail unclassified over 2 h, review backlog over 20, or 5 classify attempts" },
  { id: "I23", severity: "warn", meaning: "scheduled job missing, or its last run failed" },
  { id: "I24", severity: "warn", meaning: "orphan storage objects, or image rows without an object" },
  { id: "I25", severity: "warn", meaning: "race fixtures older than 1 h" },
];

const overallOf = (checks: HealthCheck[]): HealthRun["overall"] => (checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "pass");

const TARGET = `https://${SHOP_DOMAIN}`;

function checkRow(rng: Rng, id: string, status: CheckStatus, code: string, reason: string): HealthCheck {
  return { id, status, code, reason, ms: rng.int(status === "pass" ? 40 : 90, 1400) };
}

/** 20 runs, newest first. The newest full run is 26 pass and 1 warn, on `inbox.ingest_fresh`. */
export function createHealthRuns(rng: Rng): HealthRun[] {
  const runs: HealthRun[] = [];
  for (let i = 0; i < 20; i += 1) {
    const startedAt = plusMinutes(zurich(DEMO_TODAY, 13, 30), -60 * i);
    const manual = i === 7;
    const defs = manual ? HEALTH_CHECKS.filter((c) => MANUAL_CHECK_IDS.includes(c.id)) : HEALTH_CHECKS;
    const checks = defs.map((def) => {
      if (i === 0 && def.id === "inbox.ingest_fresh") return checkRow(rng, def.id, "warn", "stale", "no ingest for 133 min (over 120): check that the inbox task runs");
      if (i === 11 && def.id === "site.reachable") return checkRow(rng, def.id, "warn", "slow", "/api/health took 2310 ms (over 2000)");
      if (i === 15 && def.id === "email.outbox_coverage") return checkRow(rng, def.id, "fail", "missing_confirmation", "1 paid order without a confirmation email (I05)");
      if (i === 18 && def.id === "npm.audit") return checkRow(rng, def.id, "skip", "not_available", "npm is not available in this runtime");
      return checkRow(rng, def.id, "pass", "ok", def.reason);
    });
    const ms = checks.reduce((sum, c) => sum + c.ms, 0);
    runs.push({
      id: `run_${20 - i}`, startedAt, finishedAt: new Date(Date.parse(startedAt) + Math.round(ms / 4)).toISOString(), source: manual ? "admin" : "watchdog",
      target: manual ? null : TARGET, overall: overallOf(checks), checks,
    });
  }
  return runs;
}

const TABLES = ["activity_log", "addresses", "login_attempts", "staff_sessions", "staff_users", "calendar_event_people", "calendar_events", "campaign_products", "campaigns", "checkout_session_items", "checkout_sessions", "collections", "cost_fx_rates", "cost_price_plans", "customer_notes", "customers", "discount_codes", "discount_redemptions", "discount_restrictions", "drop_products", "drop_waitlist", "drops", "email_outbox", "file_categories", "finance_accounts", "finance_categories", "finance_entries", "finance_receipts", "fulfillment_transitions", "health_check_runs", "inbox_classifications", "inbox_ingest_runs", "inbox_messages", "order_events", "order_items", "order_notes", "order_refunds", "order_return_items", "order_returns", "orders", "feature_access", "product_collections", "product_costs", "product_images", "product_tags", "product_variants", "products", "purchase_order_lines", "purchase_orders", "rate_limit_hits", "recurring_costs", "secret_rotations", "settings", "stock_count_lines", "stock_counts", "stock_movements", "stripe_events", "suppliers", "tags", "task_assignees", "task_lists", "tasks", "workspace_files", "storage_measurements"];

export function createDbTables(rng: Rng): DbTable[] {
  return TABLES.map((name) => ({ name, rows: rng.int(0, 900), sizeBytes: rng.int(24, 1200) * 1000 })).sort((a, b) => b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name));
}

export function createDbFacts(): DbFacts {
  return { sizeBytes: 58_400_000, connectionsUsed: 14, connectionsMax: 60, demoLoaded: true };
}

export function createBuckets(): StorageBucket[] {
  return [{ name: "product-images", isPublic: true, objects: 39, sizeBytes: 11_800_000 }];
}

const MIGRATIONS = ["checkout_orders", "base_extensions", "shared_types", "staff_and_settings", "product_range", "customer_records", "promo_codes", "stock_movements", "campaign_tables", "mail_tables", "operations_log", "updated_at_triggers", "row_security_grants", "close_public_access", "price_engine", "reserve_and_fulfil", "session_checks", "mail_sorting", "reporting_views", "demo_loader", "image_bucket", "scheduled_jobs", "execute_rights", "checkout_sessions", "invariant_ignores_demo", "plain_books", "owner_limits", "database_report", "key_reminders", "larger_uploads", "expense_attachments", "ledger_accounts", "drop_planning", "supplier_orders", "monthly_costs", "customer_notes", "returns_flow", "system_profile", "feature_grants", "owner_defaults", "report_groups", "usage_planner", "storage_measurements", "spend_cap", "remove_local_orders"];

export function createMigrations(): Migration[] {
  return MIGRATIONS.map((name, i) => {
    const id = `${String(i + 1).padStart(4, "0")}_${name}`;
    return { id, name: id, appliedOn: addDays("2026-10-18", Math.floor((i * 12) / MIGRATIONS.length)), state: "applied" };
  });
}

const CONFIG_ROWS: [string, ConfigKind, ConfigNeed, string, boolean, string | null][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", "public", "required", "2", true, null],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "public", "required", "2", true, null],
  ["SUPABASE_SERVICE_ROLE_KEY", "secret", "required", "3", true, "2026-10-21"],
  ["SUPABASE_DB_URL", "secret", "optional", "2", true, "2026-10-21"],
  ["STRIPE_SECRET_KEY", "secret", "required", "F1", true, "2026-10-22"],
  ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "public", "required", "F1", true, null],
  ["STRIPE_WEBHOOK_SECRET", "secret", "required", "F1", true, "2026-10-22"],
  ["ADMIN_PASSWORD_HASH", "secret", "required", "4", true, "2026-06-30"],
  ["ADMIN_PASSWORD", "secret", "optional", "4", false, null],
  ["ADMIN_SESSION_SECRET", "secret", "required", "4", true, "2026-10-24"],
  ["NEXT_PUBLIC_SITE_URL", "public", "required", "1", true, null],
  ["EMAIL_PROVIDER", "setting", "optional", "3", true, null],
  ["RESEND_API_KEY", "secret", "later", "later", false, null],
  ["EMAIL_FROM", "setting", "later", "later", false, null],
  ["EMAIL_REPLY_TO", "setting", "later", "later", false, null],
  ["NEXT_PUBLIC_ALLOW_INDEXING", "public", "optional", "1", true, null],
  ["WATCHDOG_TOKEN", "secret", "recommended", "7", true, "2026-10-26"],
  ["INBOX_ALLOWED_MAILBOXES", "setting", "optional", "5", true, null],
  ["INBOX_CLASSIFIER", "setting", "optional", "5", true, null],
  ["CHECKOUT_ENABLED", "setting", "optional", "F1", true, null],
  ["ENABLE_DEV_TOOLS", "setting", "optional", "F1", false, null],
  ["WATCHDOG_TARGET_URL", "setting", "optional", "F3", true, null],
  ["ADMIN_OWNER_PASSWORD_HASH", "secret", "recommended", "release", true, "2026-10-27"],
  ["WORKSPACE_STORAGE", "setting", "optional", "release", true, null],
  ["R2_ACCOUNT_ID", "setting", "optional", "release", true, null],
  ["R2_ACCESS_KEY_ID", "secret", "optional", "release", true, "2026-10-25"],
  ["R2_SECRET_ACCESS_KEY", "secret", "optional", "release", true, "2026-10-25"],
  ["R2_BUCKET", "setting", "optional", "release", true, null],
  ["R2_JURISDICTION", "setting", "optional", "release", true, null],
  ["VERCEL_API_TOKEN", "secret", "optional", "IT", false, null],
  ["VERCEL_PROJECT_ID", "setting", "optional", "IT", false, null],
  ["VERCEL_TEAM_ID", "setting", "optional", "IT", false, null],
  ["GITHUB_READ_TOKEN", "secret", "optional", "IT", false, null],
  ["GITHUB_REPO", "setting", "optional", "IT", false, null],
  ["CLOUDFLARE_ANALYTICS_TOKEN", "secret", "optional", "AF", false, null],
];

/** Names and flags only, never a value. `ADMIN_PASSWORD_HASH` is the one secret due for rotation. */
export function createConfigVars(): ConfigVar[] {
  return CONFIG_ROWS.map(([name, kind, need, phase, present, rotatedOn]) => ({ name, kind, need, phase, status: present ? "present" : "missing", rotatedOn }));
}

const COMMITS = ["Fix rounding on free shipping", "Add stock count CSV", "Tighten the checkout hold", "Show holds on the payments tab", "Queue the shipping email on ship", "Sort the outbox newest first", "Split the finance report groups", "Add return reasons", "Guard CSV cells", "Lock the owner switch", "Refresh the map legend", "Trim the inbox summary", "Cap the bag at 30 units", "Add drop countdown", "Fold accents in search", "Label cost plans", "Log clear lockout", "Print packing slips on A4", "Retry a failed render", "Move rotation dates to config"];

export function createDeploys(rng: Rng): Deploy[] {
  return COMMITS.map((title, i) => {
    const preview = i % 3 === 1;
    return {
      id: `dep_${20 - i}`, commit: rng.hex(7), branch: preview ? `work/${title.split(" ")[1].toLowerCase()}` : "main", title,
      at: plusMinutes(NOW, -(180 + i * 410)), state: i === 8 ? "error" : i === 13 ? "canceled" : "ready", target: preview ? "preview" : "production", durationSec: rng.int(55, 140),
    };
  });
}

export function createCiRuns(rng: Rng, deploys: Deploy[]): CiRun[] {
  const workflows = ["unit tests", "browser tests", "database checks"];
  return Array.from({ length: 15 }, (_, i) => ({
    id: `ci_${15 - i}`, commit: deploys[Math.floor(i / 3)].commit, branch: "main", workflow: workflows[i % 3], at: plusMinutes(NOW, -(160 + i * 140)),
    conclusion: i === 1 ? "failure" as const : "success" as const, durationSec: rng.int(40, 610),
  }));
}

export function createPullRequests(rng: Rng): PullRequestRow[] {
  const rows: [string, PullRequestRow["state"], PullRequestRow["checks"]][] = [
    ["Aurora drop page copy", "open", "passing"],
    ["Bag code message spacing", "open", "failing"],
    ["Cost planner slider stops", "open", "pending"],
    ["Stock count for one-size items", "merged", "passing"],
    ["Return reasons in German", "merged", "passing"],
    ["Inbox retention setting", "merged", "passing"],
  ];
  return rows.map(([title, state, checks], i) => ({ id: `pr_${i + 1}`, title, branch: `work/${rng.hex(4)}`, state, checks, at: plusMinutes(NOW, -(240 + i * 900)) }));
}

/** 50 attempts, newest first, 2 failures in the last 24 hours and no lock. */
export function createSignIns(rng: Rng): SignInAttempt[] {
  const profiles: Profile[] = ["owner", "finance", "warehouse", "studio", "superUser"];
  const addresses = ["3fa9c1d2", "b7e04a11", "91cd6e3f", "c20f8b77"];
  return Array.from({ length: 50 }, (_, i) => {
    const failed = i === 3 || i === 6 || i === 27 || i === 41;
    return {
      id: `sig_${50 - i}`,
      at: plusMinutes(NOW, -(35 + i * 170 + rng.int(0, 40))),
      profile: failed ? null : profiles[i % profiles.length],
      outcome: failed ? "failure" as const : i === 33 ? "pending" as const : "success" as const,
      addressHash: rng.pick(addresses),
    };
  });
}

export function createSessions(): StaffSession[] {
  const make = (id: number, profile: Profile | null, startedMinutes: number, seenMinutes: number, device: string, isThisBrowser = false): StaffSession => {
    const startedAt = plusMinutes(NOW, -startedMinutes);
    return { id: `ses_${id}`, profile, startedAt, lastSeenAt: plusMinutes(NOW, -seenMinutes), expiresAt: plusMinutes(startedAt, 12 * 60), device, isThisBrowser };
  };
  return [
    make(1, "owner", 321, 0, "Laptop, Chrome", true),
    make(2, "warehouse", 367, 6, "Phone, Safari"),
    make(3, "warehouse", 240, 22, "Packing station, Chrome"),
    make(4, "finance", 118, 40, "Laptop, Firefox"),
    make(5, "studio", 95, 80, "Tablet, Safari"),
    make(6, null, 12, 12, "Laptop, Edge"),
  ];
}

/** 50 Stripe events, newest first: 44 processed, 3 duplicate, 2 failed (older than 24 h), 1 pending (under 10 min). */
export function createStripeEvents(orders: Order[]): StripeEvent[] {
  const paid = orders.filter((o) => o.paidAt).slice(0, 50);
  const rows: StripeEvent[] = [{
    id: eventId(1400), type: "checkout.session.completed", status: "pending", createdAt: plusMinutes(NOW, -4), orderNumber: null, sessionId: "cs_demo_2002", mode: "test", env: "production", detail: "Waiting for the handler",
  }];
  for (let i = 0; rows.length < 50; i += 1) {
    const order = paid[i];
    const n = 1399 - i;
    const status = i === 11 || i === 24 || i === 37 ? "duplicate" as const : i === 18 || i === 31 ? "failed" as const : "processed" as const;
    rows.push({
      id: eventId(n),
      type: i % 9 === 8 ? "checkout.session.async_payment_succeeded" : "checkout.session.completed",
      status,
      createdAt: status === "failed" ? plusMinutes(order.paidAt as string, 1) : order.paidAt as string,
      orderNumber: order.orderNumber,
      sessionId: order.checkoutSessionId,
      mode: "test",
      env: "production",
      detail: status === "duplicate" ? "Already handled, ignored" : status === "failed" ? "Signature could not be checked, retried by the provider" : "Order written",
    });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The newest 180 rows of the outbox: 2 queued, 170 rendered, 1 failed, 7 skipped. Status never reaches sent. */
export function createOutbox(orders: Order[]): OutboxEmail[] {
  const rows: Omit<OutboxEmail, "id" | "status" | "renderedAt" | "error">[] = [];
  for (const order of orders) {
    if (order.paidAt) {
      const parts = renderEmailParts(order, "order_confirmation");
      rows.push({ template: "order_confirmation", to: order.email, subject: parts.subject, orderNumber: order.orderNumber, locale: order.locale, createdAt: plusMinutes(order.paidAt, 1), provider: "dev", attempts: 1 });
    }
    if (order.shippedAt) {
      const parts = renderEmailParts(order, "shipping_notification");
      rows.push({ template: "shipping_notification", to: order.email, subject: parts.subject, orderNumber: order.orderNumber, locale: order.locale, createdAt: plusMinutes(order.shippedAt, 1), provider: "dev", attempts: 1 });
    }
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = rows.slice(0, 180);
  const erased = new Set(orders.filter((o) => o.customerErased).map((o) => o.orderNumber));
  const skipTargets = new Set([24, 53, 71, 96, 121, 148, 172]);
  return newest.map((row, i) => {
    const skipped = skipTargets.has(i) || erased.has(row.orderNumber ?? "");
    const status = i < 2 ? "queued" as const : i === 40 ? "failed" as const : "rendered" as const;
    return {
      ...row,
      id: `mail_out_${180 - i}`,
      status: skipped && status === "rendered" ? "skipped" as const : status,
      renderedAt: status === "rendered" && !skipped ? plusMinutes(row.createdAt, 1) : null,
      error: status === "failed" ? "Template render timed out; safe to retry" : null,
      attempts: status === "failed" ? 3 : row.attempts,
    };
  });
}

const ACTIVITY_ROWS: [string, string, string, string][] = [
  ["Lea Brunner", "orders", "order.pack", "Packed {order}"],
  ["Lea Brunner", "orders", "order.ship", "Shipped {order}"],
  ["Jonas Aebi", "finances", "entry.create", "Booked a ledger entry"],
  ["Mara Keller", "auth", "auth.login", "Signed in"],
  ["Lea Brunner", "auth", "auth.switch_profile", "Picked the Warehouse profile"],
  ["Nico Steiner", "drops", "drop.update", "Edited Aurora: launch time"],
  ["Nico Steiner", "products", "product.update", "Edited Oversized Hoodie, Cloud: description"],
  ["Lea Brunner", "inventory", "stock.adjust", "Count correction on a Lagoon Zip Hoodie size"],
  ["Jonas Aebi", "finances", "cost.book", "Booked a running cost"],
  ["system", "orders", "order.paid", "Payment received for {order}"],
  ["Mara Keller", "discounts", "discount.update", "Switched STAFF30 off"],
  ["Mara Keller", "team", "team.update", "Nico Steiner: role"],
  ["system", "email", "email.render", "Rendered a confirmation for {order}"],
  ["Lea Brunner", "returns", "return.received", "Parcel received for a return"],
  ["Mara Keller", "team", "team.update", "Lea Brunner: role"],
  ["Mara Keller", "auth", "auth.clear_lockout", "Cleared the login lockout (3 attempts)"],
];

export function createActivity(rng: Rng, orders: Order[]): ActivityRow[] {
  const rows: ActivityRow[] = Array.from({ length: 118 }, (_, i) => {
    const [actor, area, action, detail] = ACTIVITY_ROWS[i % ACTIVITY_ROWS.length];
    return { id: `act_${120 - i}`, at: plusMinutes(NOW, -(8 + i * 47 + rng.int(0, 20))), actor, area, action, detail: detail.replace("{order}", orders[Math.min(i, orders.length - 1)].orderNumber) };
  });
  return [
    ...rows,
    { id: "act_2", at: zurich("2026-12-12", 10, 5), actor: "superUser", area: "access", action: "access.set", detail: "Studio: Inbox on" },
    { id: "act_1", at: zurich("2026-11-28", 16, 40), actor: "superUser", area: "access", action: "access.set", detail: "Warehouse: Customers on until 2027-01-09" },
  ];
}

export function createAccessHistory(): AccessChange[] {
  return [
    { id: "acc_ch_1", at: zurich("2026-12-12", 10, 5), actor: "superUser", profile: "studio", feature: "inbox", on: true, until: null, kind: "set" },
    { id: "acc_ch_2", at: zurich("2026-11-28", 16, 40), actor: "superUser", profile: "warehouse", feature: "customers", on: true, until: "2027-01-09", kind: "set" },
  ];
}

export function createNotifications(): Notification[] {
  return [
    { id: "note_1", at: plusMinutes(NOW, -160), kind: "return_opened", title: "Return opened", href: "/desk/orders/returns/", readAt: null },
    { id: "note_2", at: plusMinutes(NOW, -2880), kind: "refund_paid", title: "Refund paid out", href: "/desk/finance/refunds/", readAt: plusMinutes(NOW, -2000) },
  ];
}

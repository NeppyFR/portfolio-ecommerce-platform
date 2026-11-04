import { isDueThisWeek } from "@/lib/task-due";
import { isPriorityMail } from "@/lib/triage";
import { runningPerMonth } from "@/lib/running-costs";
import { rotationRows, rotationSummary, lockStatus } from "@/lib/security-rules";
import { variantStockState } from "@/lib/product-rules";
import { attention, worstTone } from "@/lib/tones";
import { canAccess } from "@/lib/features";
import { formatChf } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import { DEMO_MONTH, DEMO_NOW_MS, DEMO_TODAY } from "./clock";
import type { HealthRun, Order, Product, Profile, State, Tone, Variant } from "./types";

/**
 * Shell and Dashboard read only these. Screens import them and never reimplement them.
 * Anything returning an object or array is cached per state, so it is safe inside useStore.
 */

function perState<T>(fn: (s: State) => T): (s: State) => T {
  const cache = new WeakMap<State, { value: T }>();
  return (s) => {
    const hit = cache.get(s);
    if (hit) return hit.value;
    const value = fn(s);
    cache.set(s, { value });
    return value;
  };
}

export const toPackCount = (s: State): number => s.orders.filter((o) => o.status === "paid").length;

export const isAttentionOrder = (o: Pick<Order, "needsAttention" | "attentionResolvedAt">): boolean => o.needsAttention && !o.attentionResolvedAt;

export const attentionCount = (s: State): number => s.orders.filter(isAttentionOrder).length;

export const priorityMailCount = (s: State): number => s.inbox.filter(isPriorityMail).length;

export const dueThisWeekCount = (s: State): number => s.tasks.filter((t) => isDueThisWeek(t, DEMO_TODAY)).length;

/** Rappen per month, from booked bills. Zero until a booked month is over. */
export const monthlyRunningCost = (s: State): number => runningPerMonth(s.costs, s.costBookings, DEMO_MONTH) ?? 0;

export type HealthSummary = { pass: number; warn: number; fail: number; skip: number; total: 27 };

/** The newest run of all 27 checks. A manual run covers only 16, so it never moves this count. */
export const latestFullRun = (s: State): HealthRun | null => s.healthRuns.find((r) => r.checks.length === 27) ?? null;

export const healthSummary = perState((s: State): HealthSummary => {
  const checks = latestFullRun(s)?.checks ?? [];
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    skip: checks.filter((c) => c.status === "skip").length,
    total: 27,
  };
});

export type LiveState = "live" | "none" | "failed" | "overdue" | "warnings" | "stale";

export type LiveStatus = { state: LiveState; tone: "ok" | "warn" | "bad"; run: HealthRun | null };

/** First match wins: no run, failed, over 3 h old, warnings, over 75 min old, live. */
export function liveStatusAt(s: State, nowMs: number): LiveStatus {
  const run = s.healthRuns[0] ?? null;
  if (!run) return { state: "none", tone: "warn", run };
  const age = (nowMs - Date.parse(run.finishedAt ?? run.startedAt)) / 60_000;
  if (run.overall === "fail") return { state: "failed", tone: "bad", run };
  if (age > 180) return { state: "overdue", tone: "bad", run };
  if (run.overall !== "pass") return { state: "warnings", tone: "warn", run };
  if (age > 75) return { state: "stale", tone: "warn", run };
  return { state: "live", tone: "ok", run };
}

export const liveStatus = perState((s: State): LiveStatus => liveStatusAt(s, DEMO_NOW_MS));

/** Sizes on sale whose state is not ok. Low and out count only active sizes of active products. */
export const stockAlerts = perState((s: State): { low: { product: Product; variant: Variant }[]; out: { product: Product; variant: Variant }[] } => {
  const low: { product: Product; variant: Variant }[] = [];
  const out: { product: Product; variant: Variant }[] = [];
  for (const product of s.products) {
    if (product.status !== "active") continue;
    for (const variant of product.variants) {
      if (!variant.isActive) continue;
      const state = variantStockState(variant, s.settings.lowStockDefault);
      if (state === "low") low.push({ product, variant });
      if (state === "out") out.push({ product, variant });
    }
  }
  return { low, out };
});

export type SystemArea = { id: "health" | "database" | "payments" | "email" | "security" | "config" | "deploys" | "ci"; tone: Tone };

/** The eight lights behind `/desk/system/`. The seed shows every tone but `unknown`. */
export function systemAreasAt(s: State, nowMs: number): SystemArea[] {
  const live = liveStatusAt(s, nowMs);
  const databaseTone: Tone = s.migrations.some((m) => m.state === "pending") ? "bad" : s.migrations.some((m) => m.state === "extra") ? "warn" : "ok";
  const failedRecently = s.stripeEvents.some((e) => e.status === "failed" && nowMs - Date.parse(e.createdAt) < 24 * 3_600_000);
  const stuck = s.stripeEvents.some((e) => e.status === "pending" && nowMs - Date.parse(e.createdAt) > 10 * 60_000);
  const paymentsTone = worstTone([failedRecently ? "bad" : stuck ? "warn" : "ok", s.holds.some((h) => h.overdue) ? "warn" : "ok"]);
  const emailFailed = s.outbox.some((m) => m.status === "failed");
  const staleQueue = s.outbox.some((m) => m.status === "queued" && nowMs - Date.parse(m.createdAt) > 10 * 60_000);
  const ingestStale = nowMs - Date.parse(s.inboxIngest.lastRunAt) > 120 * 60_000;
  const emailTone = worstTone([emailFailed || staleQueue ? "warn" : "ok", ingestStale ? "warn" : "ok"]);
  const lock = lockStatus(s.signIns, nowMs);
  const securityTone: Tone = lock.global ? "bad" : lock.locked ? "warn" : "ok";
  const configTone: Tone = rotationSummary(rotationRows(s.configVars, DEMO_TODAY)).due.length > 0 ? "warn" : "ok";
  const newestDeploy = s.deploys.find((d) => d.target === "production");
  const deploysTone: Tone = newestDeploy && (newestDeploy.state === "error" || newestDeploy.state === "blocked") ? "bad" : newestDeploy ? "ok" : "warn";
  const latestByWorkflow = new Map<string, string>();
  for (const run of s.ciRuns) {
    if (run.branch === "main" && !latestByWorkflow.has(run.workflow)) latestByWorkflow.set(run.workflow, run.conclusion);
  }
  const ciTone: Tone = [...latestByWorkflow.values()].includes("failure") ? "bad" : s.pullRequests.some((p) => p.state === "open" && p.checks === "failing") ? "warn" : "ok";
  return [
    { id: "health", tone: live.tone },
    { id: "database", tone: databaseTone },
    { id: "payments", tone: paymentsTone },
    { id: "email", tone: emailTone },
    { id: "security", tone: securityTone },
    { id: "config", tone: configTone },
    { id: "deploys", tone: deploysTone },
    { id: "ci", tone: ciTone },
  ];
}

export const systemAreas = perState((s: State): SystemArea[] => systemAreasAt(s, DEMO_NOW_MS));

export const systemAttentionCount = (s: State): number => attention(systemAreas(s)).length;

export type BellItem = { kind: "attention" | "tasks" | "orders" | "inbox" | "low_stock" | "watchdog" | "lockout" | "return_opened" | "refund_paid"; tone: "info" | "warn" | "bad"; count: number; href: string; at: string; detail: string };

/** Derived at read time: each kind at most once, and only the kinds this profile may open. */
export function bellItems(s: State, profile: Profile): BellItem[] {
  return bellCache(s)[profile] ?? computeBell(s, profile);
}

const bellCache = perState((s: State): Record<Profile, BellItem[]> => ({
  owner: computeBell(s, "owner"), finance: computeBell(s, "finance"), warehouse: computeBell(s, "warehouse"), studio: computeBell(s, "studio"), superUser: computeBell(s, "superUser"),
}));

function computeBell(s: State, profile: Profile): BellItem[] {
  const out: BellItem[] = [];
  const has = (feature: Parameters<typeof canAccess>[1]) => canAccess(profile, feature, s.featureSwitches);
  const nowIso = new Date(DEMO_NOW_MS).toISOString();
  const lock = lockStatus(s.signIns, DEMO_NOW_MS);
  if (has("it") && lock.locked) out.push({ kind: "lockout", tone: "bad", count: lock.failures, href: "/desk/system/security/?tab=access", at: nowIso, detail: "" });
  const live = liveStatus(s);
  if (has("it") && s.settings.notifyWatchdogFail && live.state === "failed") out.push({ kind: "watchdog", tone: "bad", count: 1, href: "/desk/system/health/", at: live.run?.startedAt ?? nowIso, detail: "" });
  const attentionOrders = s.orders.filter(isAttentionOrder);
  if (has("orders") && attentionOrders.length > 0) out.push({ kind: "attention", tone: "warn", count: attentionOrders.length, href: "/desk/orders/?status=attention", at: attentionOrders[0].placedAt, detail: attentionOrders[0].orderNumber });
  if (has("tasks")) {
    const person = profile === "superUser" ? null : profile;
    const mine = s.tasks.filter((t) => person !== null && t.doneAt === null && t.assignees.includes(person) && t.dueOn !== null && t.dueOn <= DEMO_TODAY);
    if (mine.length > 0) {
      const late = mine.filter((t) => (t.dueOn as string) < DEMO_TODAY).length;
      out.push({ kind: "tasks", tone: late > 0 ? "warn" : "info", count: mine.length, href: "/desk/checklist/?view=mine", at: nowIso, detail: mine[0].title });
    }
  }
  const toPack = s.orders.filter((o) => o.status === "paid");
  if (has("orders") && s.settings.notifyNewOrder && toPack.length > 0) {
    out.push({ kind: "orders", tone: "info", count: toPack.length, href: toPack.length === 1 ? orderHref(toPack[0].orderNumber) : "/desk/orders/?status=paid", at: toPack[0].paidAt ?? toPack[0].placedAt, detail: `${toPack[0].orderNumber} · ${formatChf(toPack[0].totalRappen)}` });
  }
  if (has("inbox") && s.settings.notifyInboxHigh) {
    const count = priorityMailCount(s);
    if (count > 0) out.push({ kind: "inbox", tone: "info", count, href: "/desk/inbox/", at: nowIso, detail: "" });
  }
  if (has("inventory") && s.settings.notifyLowStock) {
    const { low, out: empty } = stockAlerts(s);
    if (low.length + empty.length > 0) out.push({ kind: "low_stock", tone: "warn", count: low.length + empty.length, href: "/desk/inventory/?filter=low", at: nowIso, detail: "" });
  }
  return out;
}

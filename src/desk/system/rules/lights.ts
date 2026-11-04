import type { en } from "@/i18n/dict/system";
import { dayKey, formatDateTime, formatTime } from "@/lib/format";
import { LOCK_WINDOW_MS, ROTATION_DAYS, lockStatus, rotationRows, rotationSummary } from "@/lib/security-rules";
import { attention, worstState } from "@/lib/tones";
import { DEMO_TODAY } from "@/store/clock";
import { liveStatusAt, type SystemArea } from "@/store/selectors";
import type { CiRun, Deploy, HealthCheck, HealthRun, SignInAttempt, State, Tone } from "@/store/types";

export type AreaId = SystemArea["id"];
export type StateKey = keyof (typeof en)["state"];
export type Light = { tone: Tone; key: StateKey; vars: Record<string, string | number> };
export type AreaLight = Light & { id: AreaId };

export const AREA_IDS: AreaId[] = ["health", "database", "payments", "email", "security", "config", "deploys", "ci"];

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** The first three ids, then `+N`. */
export function idList(ids: string[]): string {
  return ids.length > 3 ? `${ids.slice(0, 3).join(", ")} +${ids.length - 3}` : ids.join(", ");
}

/** Today's times show only `HH:MM`; anything older shows its date too. */
export function whenOf(iso: string, nowMs: number): string {
  return dayKey(iso) === dayKey(new Date(nowMs)) ? formatTime(iso) : formatDateTime(iso);
}

export type RunCounts = { pass: number; warn: number; fail: number; skip: number; total: number };

export function countChecks(checks: HealthCheck[]): RunCounts {
  const by = (status: HealthCheck["status"]) => checks.filter((c) => c.status === status).length;
  return { pass: by("pass"), warn: by("warn"), fail: by("fail"), skip: by("skip"), total: checks.length };
}

const light = (tone: Tone, key: StateKey, vars: Record<string, string | number> = {}): Light => ({ tone, key, vars });

export function healthLight(s: State, nowMs: number): Light {
  const live = liveStatusAt(s, nowMs);
  if (!live.run) return light("warn", "healthNone");
  const when = whenOf(live.run.finishedAt ?? live.run.startedAt, nowMs);
  const c = countChecks(live.run.checks);
  if (live.state === "failed") return light("bad", "healthFail", { when, fail: c.fail });
  if (live.state === "overdue") return light("bad", "healthOverdue", { when });
  if (live.state === "warnings") return light("warn", "healthWarn", { when, passed: c.pass, total: c.total, warn: c.warn });
  if (live.state === "stale") return light("warn", "healthStale", { when });
  return light("ok", "healthOk", { when, passed: c.pass, total: c.total });
}

export function databaseLight(s: State): Light {
  const pending = s.migrations.filter((m) => m.state === "pending");
  const extra = s.migrations.filter((m) => m.state === "extra");
  if (pending.length) return light("bad", "databasePending", { count: pending.length, ids: idList(pending.map((m) => m.name)) });
  if (extra.length) return light("warn", "databaseExtra", { count: extra.length, ids: idList(extra.map((m) => m.name)) });
  return light("ok", "databaseOk", { files: s.migrations.length });
}

/** The database box on the map: the latest run's checks whose id starts `supabase.`, `db.` or `rls.`. */
export function supabaseLight(s: State): Light {
  const checks = (s.healthRuns[0]?.checks ?? []).filter((c) => /^(supabase|db|rls)\./.test(c.id));
  const failed = checks.filter((c) => c.status === "fail").map((c) => c.id);
  if (failed.length) return light("bad", "supabaseChecksFail", { ids: idList(failed) });
  const warned = checks.filter((c) => c.status === "warn").map((c) => c.id);
  if (warned.length) return light("warn", "supabaseChecksWarn", { ids: idList(warned) });
  return light("ok", "supabaseOk");
}

export function stripeLight(s: State, nowMs: number): Light {
  const failed = s.stripeEvents.filter((e) => e.status === "failed" && nowMs - Date.parse(e.createdAt) < DAY).length;
  if (failed) return light("bad", "stripeFailed", { failed });
  const stuck = s.stripeEvents.filter((e) => e.status === "pending" && nowMs - Date.parse(e.createdAt) > 10 * MIN).length;
  if (stuck) return light("warn", "stripeStuck", { stuck });
  const newest = s.stripeEvents[0];
  return newest ? light("ok", "stripeOk", { when: whenOf(newest.createdAt, nowMs) }) : light("ok", "stripeNone");
}

/** The watchdog's stripe.fulfilment_gap check; the database side has no gap rows in this demo. */
export function gapLight(s: State): Light {
  const check = latestCheck(s, "stripe.fulfilment_gap");
  if (check?.status === "fail") return light("bad", "gapCheckFail");
  if (check?.status === "warn") return light("warn", "gapCheckWarn");
  return light("ok", "gapOk");
}

export function latestCheck(s: State, id: string): (HealthCheck & { run: HealthRun }) | null {
  for (const run of s.healthRuns) {
    const check = run.checks.find((c) => c.id === id);
    if (check) return { ...check, run };
  }
  return null;
}

export function holdsLight(s: State): Light {
  const overdue = s.holds.filter((h) => h.overdue).length;
  if (overdue) return light("warn", "holdsOverdue", { count: overdue });
  return s.holds.length ? light("ok", "holdsOk", { count: s.holds.length }) : light("ok", "holdsNone");
}

/** Late means the release job gave a hold back more than 15 minutes after it expired. */
export function isLateRelease(r: State["releases"][number]): boolean {
  return r.reason === "expired" && Date.parse(r.releasedAt) - Date.parse(r.expiredAt) > 15 * MIN;
}

export function releasesLight(s: State, nowMs: number): Light {
  const day = s.releases.filter((r) => nowMs - Date.parse(r.releasedAt) < DAY);
  const late = day.filter(isLateRelease).length;
  return late ? light("warn", "releasesLate", { late }) : light("ok", "releasesOk", { total: day.length });
}

export function paymentsLight(s: State, nowMs: number): Light {
  return worstState([stripeLight(s, nowMs), gapLight(s), holdsLight(s), releasesLight(s, nowMs)]) as Light;
}

export function emailLight(s: State, nowMs: number): Light {
  const failed = s.outbox.filter((m) => m.status === "failed").length;
  if (failed) return light("warn", "emailFailed", { failed });
  const queued = staleQueued(s, nowMs);
  if (queued) return light("warn", "emailStale", { queued });
  return s.outbox.length ? light("ok", "emailOk") : light("ok", "emailEmpty");
}

export const staleQueued = (s: State, nowMs: number): number => s.outbox.filter((m) => m.status === "queued" && nowMs - Date.parse(m.createdAt) > 10 * MIN).length;

export function inboxLight(s: State, nowMs: number): Light {
  if (s.inboxIngest.mailboxes === 0) return light("off", "inboxNoMailbox");
  const when = whenOf(s.inboxIngest.lastRunAt, nowMs);
  return nowMs - Date.parse(s.inboxIngest.lastRunAt) > 120 * MIN ? light("warn", "inboxStale", { when }) : light("ok", "inboxOk", { when });
}

export function emailAreaLight(s: State, nowMs: number): Light {
  return worstState([emailLight(s, nowMs), inboxLight(s, nowMs)]) as Light;
}

export type LoginSummary = { success: number; failure: number; pending: number };

export function loginSummary(attempts: Pick<SignInAttempt, "at" | "outcome">[], nowMs: number): LoginSummary {
  const day = attempts.filter((a) => nowMs - Date.parse(a.at) < DAY);
  const by = (outcome: SignInAttempt["outcome"]) => day.filter((a) => a.outcome === outcome).length;
  return { success: by("success"), failure: by("failure"), pending: by("pending") };
}

export function securityLight(s: State, nowMs: number): Light {
  const lock = lockStatus(s.signIns, nowMs);
  if (lock.global) return light("bad", "securityGlobal", { failures: lock.failures });
  if (lock.locked) return light("warn", "securityLocked", { count: lock.prefixes.length });
  const day = loginSummary(s.signIns, nowMs);
  return light("ok", "securityOk", { failures: day.failure + day.pending });
}

/** Phases 1 to 7 are built; `later` and the named release phases are not required yet. */
export function configLight(s: State): Light {
  const missingRequired = s.configVars.filter((v) => v.need === "required" && v.status === "missing").map((v) => v.name);
  if (missingRequired.length) return light("bad", "configBad", { ids: idList(missingRequired) });
  const due = rotationSummary(rotationRows(s.configVars, DEMO_TODAY)).due;
  if (due.length) return light("warn", "configRotationDue", { days: ROTATION_DAYS, ids: idList(due) });
  const missingRecommended = s.configVars.filter((v) => v.need === "recommended" && v.status === "missing").map((v) => v.name);
  if (missingRecommended.length) return light("warn", "configWarn", { ids: idList(missingRecommended) });
  return light("ok", "configOk", { set: s.configVars.filter((v) => v.status === "present").length });
}

/** The commit production runs: the newest ready production deploy. */
export function productionDeploy(deploys: Deploy[]): Deploy | null {
  return deploys.find((d) => d.target === "production" && d.state === "ready") ?? null;
}

export const mainHead = (runs: CiRun[]): string | null => runs.find((r) => r.branch === "main")?.commit ?? null;

export function deploysLight(s: State, nowMs: number): Light {
  const newest = s.deploys.find((d) => d.target === "production");
  if (!newest) return light("warn", "deploysNone");
  if (newest.state === "error" || newest.state === "blocked") return light("bad", "deploysFailed", { when: whenOf(newest.at, nowMs) });
  const prod = productionDeploy(s.deploys);
  if (!prod) return light("warn", "deploysNone");
  const head = mainHead(s.ciRuns);
  if (head && prod.commit !== head) {
    const building = s.deploys.find((d) => d.commit === head && (d.state === "building" || d.state === "queued"));
    return building ? light("ok", "deploysDeploying", { commit: head }) : light("warn", "deploysBehind", { commit: prod.commit });
  }
  return light("ok", "deploysOk", { commit: prod.commit, when: whenOf(prod.at, nowMs) });
}

/** Newest run of each workflow on main, in the order they first appear. */
export function latestPerWorkflow(runs: CiRun[]): CiRun[] {
  const seen = new Map<string, CiRun>();
  for (const run of runs) {
    if (run.branch === "main" && !seen.has(run.workflow)) seen.set(run.workflow, run);
  }
  return [...seen.values()];
}

export function ciLight(s: State): Light {
  const latest = latestPerWorkflow(s.ciRuns);
  const failed = latest.filter((r) => r.conclusion === "failure").map((r) => r.workflow);
  if (failed.length) return light("bad", "ciMainFailed", { ids: idList(failed) });
  const open = s.pullRequests.filter((p) => p.state === "open");
  const failing = open.filter((p) => p.checks === "failing").length;
  if (failing) return light("warn", "ciPrsFailing", { count: failing });
  return latest.length ? light("ok", "ciOk", { prs: open.length }) : light("ok", "ciNoRuns", { prs: open.length });
}

const UNKNOWN_KEY: Record<AreaId, StateKey> = {
  health: "healthUnknown", database: "databaseUnknown", payments: "stripeUnknown", email: "emailUnknown",
  security: "securityUnknown", config: "configUnknown", deploys: "deploysUnknown", ci: "ciUnknown",
};

/** The eight lights with their sentences. A failed source turns only its own area Unknown. */
export function areaLights(s: State, nowMs: number, failed: AreaId | null = null): AreaLight[] {
  const lights: Record<AreaId, Light> = {
    health: healthLight(s, nowMs),
    database: databaseLight(s),
    payments: paymentsLight(s, nowMs),
    email: emailAreaLight(s, nowMs),
    security: securityLight(s, nowMs),
    config: configLight(s),
    deploys: deploysLight(s, nowMs),
    ci: ciLight(s),
  };
  return AREA_IDS.map((id) => (id === failed ? { id, tone: "unknown", key: UNKNOWN_KEY[id], vars: {} } : { id, ...lights[id] }));
}

export const attentionAreas = (lights: AreaLight[]): AreaLight[] => attention(lights);

export type MapState = { tone: Tone; key: StateKey; vars: Record<string, string | number> };

/** Only four boxes are live, as in the source. The rest read off even when their own tab has data. */
export function nodeLights(s: State, nowMs: number, failed: AreaId | null = null): Partial<Record<string, MapState>> {
  const unknown = (area: AreaId): MapState => ({ tone: "unknown", key: UNKNOWN_KEY[area], vars: {} });
  return {
    database: failed === "database" ? unknown("database") : supabaseLight(s),
    payments: failed === "payments" ? unknown("payments") : stripeLight(s, nowMs),
    mail: failed === "email" ? unknown("email") : emailLight(s, nowMs),
    inbox: failed === "email" ? unknown("email") : inboxLight(s, nowMs),
  };
}

/** Last sign of life per wire. The other eleven always show a dash, the switched-off watchdog wire among them. */
export function edgeLastSeen(s: State): Partial<Record<string, string>> {
  const webhook = s.stripeEvents[0]?.createdAt;
  const rendered = s.outbox.find((m) => m.renderedAt)?.renderedAt ?? undefined;
  const ingest = s.inboxIngest.lastRunAt;
  return { stV: webhook, vRs: rendered, rsC: rendered, clMb: ingest, clSb: ingest };
}

export const LOCK_WINDOW_MINUTES = LOCK_WINDOW_MS / MIN;

/** Maps a raw activity area onto the 18 groups of the About filter. Unknown areas show only under Everything. */
const ENTITY_OF: Record<string, keyof (typeof en)["activity"]["entity"]> = {
  products: "product", product: "product", collections: "collection", collection: "collection", tags: "product",
  inventory: "variant", stock: "variant", variants: "variant",
  orders: "order", order: "order", returns: "order", customers: "customer", customer: "customer",
  discounts: "discount", discount: "discount", marketing: "campaign", campaigns: "campaign", campaign: "campaign",
  settings: "settings", team: "team", access: "team", auth: "session", security: "session", sessions: "session",
  email: "email", emails: "email", inbox: "inbox", files: "file", file: "file", drops: "file", drop: "file",
  calendar: "calendar", tasks: "task", checklist: "task", finances: "finance", finance: "finance", costs: "finance", refunds: "finance",
  production: "production", suppliers: "production", danger: "danger", health: "settings", config: "settings",
};

export type ActivityEntity = keyof (typeof en)["activity"]["entity"];

export const entityOf = (area: string): ActivityEntity | null => ENTITY_OF[area] ?? null;

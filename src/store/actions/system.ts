import { useSyncExternalStore } from "react";
import type { AreaId } from "@/desk/system/rules/lights";
import { LOCK_WINDOW_MS, rotationDayProblem } from "@/lib/security-rules";
import { DEMO_NOW_MS, DEMO_TODAY, now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity, renderEmail } from "@/store/flows";
import { HEALTH_CHECKS, MANUAL_CHECK_IDS } from "@/store/seed/system";
import { clearProfile } from "@/store/actions/profile";
import type { ActionResult, CheckStatus, HealthCheck, HealthRun, SignInAttempt, StaffSession, State } from "@/store/types";

/**
 * The one piece of System state outside the store: which source pretends to have failed.
 * It shows the `unknown` tone, which no seeded area reads, and goes back to none on reset.
 */
let failedSource: AreaId | null = null;
const failedListeners = new Set<() => void>();
const emitFailed = () => failedListeners.forEach((l) => l());
const subscribeFailed = (l: () => void) => {
  failedListeners.add(l);
  return () => {
    failedListeners.delete(l);
  };
};

export const getFailedSource = (): AreaId | null => failedSource;

export function setFailedSource(area: AreaId | null): void {
  failedSource = area;
  emitFailed();
}

export function useFailedSource(): AreaId | null {
  return useSyncExternalStore(subscribeFailed, getFailedSource, () => null);
}

registerReset(() => {
  failedSource = null;
  emitFailed();
});

const MS_BY_INDEX = [38, 96, 61, 142, 88, 53, 117, 74, 205, 49, 131, 67, 93, 158, 44, 109];

/** The rows a manual run writes. Three of them read live state, so fixing a problem shows in the next run. */
export function manualChecks(s: State, nowMs: number): HealthCheck[] {
  const overdueHolds = s.holds.filter((h) => h.overdue).length;
  const failedMail = s.outbox.filter((m) => m.status === "failed").length;
  const queuedMail = s.outbox.filter((m) => m.status === "queued" && nowMs - Date.parse(m.createdAt) > 10 * 60_000).length;
  const backlog = failedMail + queuedMail;
  const ingestMinutes = Math.round((nowMs - Date.parse(s.inboxIngest.lastRunAt)) / 60_000);
  return HEALTH_CHECKS.filter((c) => MANUAL_CHECK_IDS.includes(c.id)).map((def, i) => {
    const row = (status: CheckStatus, code: string, reason: string): HealthCheck => ({ id: def.id, status, code, reason, ms: MS_BY_INDEX[i % MS_BY_INDEX.length] });
    if (def.id === "stock.reservations_stale" && overdueHolds) return row("warn", "stale", `${overdueHolds} reservation(s) held over 15 min past expiry (is the release job behind)`);
    if (def.id === "email.outbox_coverage" && backlog) return row("warn", "backlog", `${backlog} outbox row(s) queued over 10 min or failed (I06), 0 shipments without email (I11)`);
    if (def.id === "inbox.ingest_fresh") {
      return ingestMinutes > 120 ? row("warn", "stale", `no ingest for ${ingestMinutes} min (over 120): check that the inbox task runs`) : row("pass", "ok", `last ingest ${ingestMinutes} min ago`);
    }
    return row("pass", "ok", def.reason);
  });
}

const overallOf = (checks: HealthCheck[]): HealthRun["overall"] => (checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "pass");

/** After the screen's short delay: prepends a run from source `admin`, 16 checks, no target. */
export function runHealthChecks(): ActionResult<HealthRun> {
  const s = getState();
  const finishedAt = now();
  const checks = manualChecks(s, DEMO_NOW_MS);
  const ms = checks.reduce((sum, c) => sum + c.ms, 0);
  const run: HealthRun = {
    id: `run_m${s.healthRuns.length + 1}`,
    startedAt: new Date(Date.parse(finishedAt) - Math.round(ms / 4)).toISOString(),
    finishedAt,
    source: "admin",
    target: null,
    overall: overallOf(checks),
    checks,
  };
  update((state) => ({ ...state, healthRuns: [run, ...state.healthRuns] }));
  const count = (status: CheckStatus) => checks.filter((c) => c.status === status).length;
  logActivity({ area: "health", action: "health.run", detail: `Ran the server checks: ${count("pass")} passed, ${count("warn")} warned, ${count("fail")} failed` });
  return { ok: true, data: run };
}

/** Queued or failed becomes rendered. Nothing is ever sent. */
export function retryEmail(id: string): ActionResult<{ html: string }> {
  const mail = getState().outbox.find((m) => m.id === id);
  if (!mail) return { ok: false, code: "not_found", message: "That email is gone." };
  if (mail.status !== "queued" && mail.status !== "failed") return { ok: false, code: "not_retryable", message: "Only queued or failed emails can be rendered again." };
  const html = renderEmail(id);
  if (!html) return { ok: false, code: "no_order", message: "That email has no order left to render." };
  logActivity({ area: "email", action: "email.render", detail: `Rendered ${mail.orderNumber ?? id} again` });
  return { ok: true, data: { html } };
}

export type RetentionProblem = "whole" | "min" | "max";

export function retentionProblem(text: string): RetentionProblem | null {
  if (!/^\d+$/.test(text.trim())) return "whole";
  const days = Number(text.trim());
  if (days < 7) return "min";
  return days > 365 ? "max" : null;
}

export function setRetentionDays(text: string): ActionResult<number> {
  const problem = retentionProblem(text);
  if (problem) return { ok: false, code: problem, message: "Keep mail for 7 to 365 whole days." };
  const days = Number(text.trim());
  update((s) => ({ ...s, settings: { ...s.settings, inboxRetentionDays: days, updatedAt: now() } }));
  logActivity({ area: "inbox", action: "settings.update", detail: `Inbox retention set to ${days} days` });
  return { ok: true, data: days };
}

const inLockWindow = (a: SignInAttempt, nowMs: number) => a.outcome !== "success" && nowMs - Date.parse(a.at) < LOCK_WINDOW_MS;

/** Removes failed and pending attempts of the last 15 minutes. */
export function clearLockout(): ActionResult<{ removed: number }> {
  const s = getState();
  const removed = s.signIns.filter((a) => inLockWindow(a, DEMO_NOW_MS)).length;
  if (removed === 0) return { ok: false, code: "nothing_to_clear", message: "No failed attempts in the last 15 minutes." };
  update((state) => ({ ...state, signIns: state.signIns.filter((a) => !inLockWindow(a, DEMO_NOW_MS)) }));
  logActivity({ area: "auth", action: "auth.clear_lockout", detail: `Cleared the login lockout (${removed} attempts)` });
  return { ok: true, data: { removed } };
}

/** A demo aid: the lock cannot be seen otherwise, because this demo has no sign-in. */
export function simulateWrongTries(): ActionResult<{ added: number }> {
  const at = now();
  const rows: SignInAttempt[] = Array.from({ length: 5 }, (_, i) => ({
    id: `sig_w${getState().signIns.length + i + 1}`,
    at,
    profile: null,
    outcome: "failure",
    addressHash: "7ac41e0d",
  }));
  update((s) => ({ ...s, signIns: [...rows, ...s.signIns] }));
  logActivity({ area: "auth", action: "auth.login_failed", detail: "Demo: 5 wrong tries from one address" });
  return { ok: true, data: { added: rows.length } };
}

/**
 * Ends every session and forgets the chosen profile. This browser keeps one row with no profile,
 * since it has not chosen again yet. The caller toasts and goes to `/desk/enter/`.
 */
export function logEveryoneOut(): ActionResult<{ ended: number }> {
  const s = getState();
  const ended = s.sessions.length;
  const at = now();
  const fresh: StaffSession = { id: `ses_n${ended + 1}`, profile: null, startedAt: at, lastSeenAt: at, expiresAt: new Date(Date.parse(at) + 12 * 3_600_000).toISOString(), device: s.sessions.find((x) => x.isThisBrowser)?.device ?? "This browser", isThisBrowser: true };
  update((state) => ({ ...state, sessions: [fresh] }));
  logActivity({ area: "auth", action: "auth.revoke_sessions", detail: `Logged everyone out (${ended} sessions)` });
  clearProfile();
  return { ok: true, data: { ended } };
}

export type RotationProblem = "invalid" | "too_early" | "future" | "not_secret";

/** Records the day a secret last changed. Only the day is stored, never a value. */
export function setRotationDate(name: string, day: string): ActionResult<string> {
  const row = getState().configVars.find((v) => v.name === name);
  if (!row || row.kind !== "secret") return { ok: false, code: "not_secret", message: "Only a secret has a rotation date." };
  const problem = rotationDayProblem(day, DEMO_TODAY);
  if (problem) return { ok: false, code: problem, message: "Pick a valid day that is not in the future." };
  update((s) => ({ ...s, configVars: s.configVars.map((v) => (v.name === name ? { ...v, rotatedOn: day } : v)) }));
  logActivity({ area: "config", action: "config.rotation", detail: `${name}: last change recorded as ${day}` });
  return { ok: true, data: day };
}

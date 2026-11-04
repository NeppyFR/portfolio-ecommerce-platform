import type { ConfigVar, SignInAttempt } from "@/store/types";
import { addDays } from "./dates";

export const LOCK_WINDOW_MS = 15 * 60_000;
export const PER_ADDRESS_LIMIT = 5;
export const GLOBAL_LIMIT = 40;
export const SESSION_HOURS = 12;
export const ROTATION_DAYS = 180;

export type LockStatus = { locked: boolean; global: boolean; prefixes: string[]; failures: number; liftsAt: string | null };

/**
 * Counts attempts that are not a success in the last 15 minutes, grouped by address prefix.
 * 5 or more on a prefix locks it; GLOBAL_LIMIT or more in total locks everyone. Lifts 15 minutes after
 * the oldest counted attempt.
 */
export function lockStatus(attempts: Pick<SignInAttempt, "at" | "outcome" | "addressHash">[], nowMs: number): LockStatus {
  const recent = attempts.filter((a) => a.outcome !== "success" && nowMs - Date.parse(a.at) < LOCK_WINDOW_MS);
  const byPrefix = new Map<string, number>();
  for (const attempt of recent) {
    const prefix = attempt.addressHash.slice(0, 8);
    byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
  }
  const prefixes = [...byPrefix.entries()].filter(([, count]) => count >= PER_ADDRESS_LIMIT).map(([prefix]) => prefix);
  const global = recent.length >= GLOBAL_LIMIT;
  const counted = global ? recent : recent.filter((a) => prefixes.includes(a.addressHash.slice(0, 8)));
  const oldest = counted.length ? Math.min(...counted.map((a) => Date.parse(a.at))) : null;
  return {
    locked: global || prefixes.length > 0,
    global,
    prefixes,
    failures: recent.length,
    liftsAt: oldest === null ? null : new Date(oldest + LOCK_WINDOW_MS).toISOString(),
  };
}

export type RotationRow = { name: string; rotatedOn: string | null; dueOn: string | null; status: "ok" | "due" | "none" };

/** Secrets only. The due day is the last change plus 180 days; a secret is due once that day has come. */
export function rotationRows(vars: ConfigVar[], today: string): RotationRow[] {
  return vars
    .filter((v) => v.kind === "secret" && v.status === "present")
    .map((v) => {
      if (!v.rotatedOn) return { name: v.name, rotatedOn: null, dueOn: null, status: "none" as const };
      const dueOn = addDays(v.rotatedOn, ROTATION_DAYS);
      return { name: v.name, rotatedOn: v.rotatedOn, dueOn, status: dueOn <= today ? ("due" as const) : ("ok" as const) };
    });
}

export function rotationSummary(rows: RotationRow[]): { due: string[]; undated: string[]; next: RotationRow | null } {
  const dated = rows.filter((r) => r.dueOn !== null).sort((a, b) => (a.dueOn as string).localeCompare(b.dueOn as string));
  return {
    due: rows.filter((r) => r.status === "due").map((r) => r.name),
    undated: rows.filter((r) => r.status === "none").map((r) => r.name),
    next: dated.find((r) => r.status === "ok") ?? null,
  };
}

export function rotationDayProblem(day: string, today: string): "invalid" | "too_early" | "future" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`))) return "invalid";
  if (day < "2020-01-01") return "too_early";
  return day > today ? "future" : null;
}

/** Team rules. Returns why a profile's switch is locked, or null when it may be changed. */
export function teamLock(input: { target: string; viewer: string; activeCount: number; targetActive: boolean }): "fixed" | "self" | "last" | "full_switch" | null {
  if (input.target === "superUser") return "fixed";
  if (input.target === input.viewer) return "self";
  if (input.targetActive && input.activeCount <= 1) return "last";
  if (input.target === "owner" && input.viewer !== "superUser") return "full_switch";
  return null;
}

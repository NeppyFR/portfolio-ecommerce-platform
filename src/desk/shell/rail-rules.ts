import { fmt, plural } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { dayKey, formatDateTime, formatTime } from "@/lib/format";
import { DEMO_TODAY } from "@/store/clock";
import type { HealthRun } from "@/store/types";

type Strings = typeof shell.en;

/** `13:30` for a time on the demo's today, `07.01.2027, 13:30` otherwise. */
export function shortStamp(iso: string): string {
  return dayKey(iso) === DEMO_TODAY ? formatTime(iso) : formatDateTime(iso);
}

export const runTime = (run: HealthRun): string => run.finishedAt ?? run.startedAt;

export function liveDetail(run: HealthRun | null, t: Strings): string {
  if (!run) return t.live.detailNone;
  const passed = run.checks.filter((c) => c.status === "pass").length;
  const failed = run.checks.filter((c) => c.status === "fail").length;
  const warned = run.checks.filter((c) => c.status === "warn").length;
  const counts = [fmt(t.live.passed, { passed, total: run.checks.length })];
  if (failed) counts.push(fmt(t.live.failedCount, { count: failed }));
  if (warned) counts.push(fmt(plural(warned, t.live.warning.one, t.live.warning.other), { count: warned }));
  return fmt(t.live.detail, { when: shortStamp(runTime(run)), counts: counts.join(" · ") });
}

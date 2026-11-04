import { fmt, plural } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { canAccess } from "@/lib/features";
import { formatChf } from "@/lib/format";
import { isDueToday, isOverdue } from "@/lib/task-due";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { registerReset } from "@/store/core";
import { bellItems, type BellItem } from "@/store/selectors";
import type { FeatureKey, NotificationKind, Person, Profile, State } from "@/store/types";
import { shortStamp } from "./rail-rules";

type Strings = typeof shell.en;

export type BellKind = NotificationKind;
export type BellTone = "info" | "warn" | "bad";
export type BellRow = {
  key: string;
  kind: BellKind;
  tone: BellTone;
  title: string;
  detail: string;
  href: string;
  at: string | null;
  /** Events are listed only while new. Conditions stay listed while they hold. */
  event: boolean;
  signature: string;
};

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const SUPER_PASSWORD_ALARM = 5;
const ORDER: BellKind[] = ["profile_password", "lockout", "watchdog", "attention", "tasks", "orders", "return_opened", "refund_paid", "inbox", "low_stock"];

const within = (iso: string, spanMs: number) => DEMO_NOW_MS - Date.parse(iso) <= spanMs;
const count = (forms: { one: string; other: string }, n: number) => fmt(plural(n, forms.one, forms.other), { count: n });
const newest = <T,>(rows: T[], at: (row: T) => string): T | undefined =>
  rows.reduce<T | undefined>((best, row) => (best === undefined || Date.parse(at(row)) > Date.parse(at(best)) ? row : best), undefined);

function fromItem(item: BellItem, s: State, profile: Profile, t: Strings): BellRow {
  const n = t.note;
  const base = { key: item.kind, kind: item.kind, tone: item.tone, href: item.href, signature: `${item.count}:${item.detail}` };
  const condition = { ...base, at: null, event: false };
  switch (item.kind) {
    case "lockout":
      return { ...condition, title: n.lockoutTitle, detail: count(n.lockoutDetail, item.count) };
    case "watchdog":
      return { ...condition, title: n.watchdogTitle, detail: fmt(n.watchdogDetail, { at: shortStamp(item.at) }), at: item.at };
    case "attention":
      return { ...condition, title: count(n.attentionTitle, item.count), detail: n.attentionDetail };
    case "tasks": {
      const mine = profile === "superUser" ? [] : s.tasks.filter((task) => task.assignees.includes(profile as Person));
      const today = mine.filter((task) => isDueToday(task, DEMO_TODAY)).length;
      const late = mine.filter((task) => isOverdue(task, DEMO_TODAY)).length;
      return {
        ...condition,
        title: today ? count(n.tasksToday, today) : count(n.tasksOverdue, late),
        detail: today && late ? fmt(n.tasksPlusOverdue, { count: late }) : fmt(n.tasksNext, { title: item.detail }),
      };
    }
    case "orders":
      return { ...base, title: count(n.ordersTitle, item.count), detail: fmt(n.ordersDetail, { order: item.detail }), at: item.at, event: true };
    case "return_opened":
      return { ...base, title: count(n.returnTitle, item.count), detail: item.detail, at: item.at, event: true };
    case "refund_paid":
      return { ...base, title: count(n.refundTitle, item.count), detail: item.detail, at: item.at, event: true };
    case "inbox":
      return { ...condition, title: count(n.inboxTitle, item.count), detail: n.inboxDetail };
    case "low_stock":
      return { ...condition, title: count(n.lowStockTitle, item.count), detail: n.lowStockDetail };
  }
}

/** The rows the selectors do not derive: superUser passwords, plus returns and refunds, which only Finance sees. */
function extraRows(s: State, profile: Profile, t: Strings): BellRow[] {
  const can = (feature: FeatureKey) => canAccess(profile, feature, s.featureSwitches);
  const n = t.note;
  const rows: BellRow[] = [];

  if (can("superadmin")) {
    const failed = s.signIns.filter((a) => a.outcome === "failure" && a.profile === "superUser" && within(a.at, DAY));
    if (failed.length) {
      rows.push({
        key: "profile_password",
        kind: "profile_password",
        tone: failed.length >= SUPER_PASSWORD_ALARM ? "bad" : "warn",
        title: count(n.passwordTitle, failed.length),
        detail: n.passwordDetail,
        href: "/desk/su/security/",
        at: newest(failed, (a) => a.at)?.at ?? null,
        event: false,
        signature: `${failed.length}`,
      });
    }
  }

  if (can("finances")) {
    const opened = s.returns.filter((r) => r.status === "requested" && within(r.createdAt, WEEK));
    const latest = newest(opened, (r) => r.createdAt);
    if (latest) {
      const forms = n.returnDetail;
      rows.push({
        key: "return_opened",
        kind: "return_opened",
        tone: "info",
        title: count(n.returnTitle, opened.length),
        detail: fmt(plural(opened.length, forms.one, forms.other), { ret: latest.returnNo, order: latest.orderNumber }),
        href: "/desk/finance/refunds/",
        at: latest.createdAt,
        event: true,
        signature: `${opened.length}:${latest.returnNo}`,
      });
    }

    const paidOut = s.orders.flatMap((o) => o.refunds.filter((r) => within(r.createdAt, WEEK)).map((r) => ({ ...r, orderNumber: o.orderNumber })));
    const last = newest(paidOut, (r) => r.createdAt);
    if (last) {
      const forms = n.refundDetail;
      const total = paidOut.reduce((sum, r) => sum + r.amountRappen, 0);
      rows.push({
        key: "refund_paid",
        kind: "refund_paid",
        tone: "warn",
        title: count(n.refundTitle, paidOut.length),
        detail: fmt(plural(paidOut.length, forms.one, forms.other), { amount: formatChf(total), order: last.orderNumber }),
        href: "/desk/finance/refunds/",
        at: last.createdAt,
        event: true,
        signature: `${paidOut.length}:${last.id}`,
      });
    }
  }
  return rows;
}

/** Each kind appears at most once, as a summary row, in the source's order. `notify()` rows come first, while unread. */
export function deriveNotifications(s: State, profile: Profile, t: Strings): BellRow[] {
  const derived = [...bellItems(s, profile).map((item) => fromItem(item, s, profile, t)), ...extraRows(s, profile, t)];
  const rows = ORDER.flatMap((kind) => derived.filter((row) => row.kind === kind).slice(0, 1));
  const money = canAccess(profile, "finances", s.featureSwitches);

  const stored = s.notifications
    .filter((item) => {
      if (item.readAt !== null) return false;
      if (item.kind === "demo") return true;
      if ((item.kind === "return_opened" || item.kind === "refund_paid") && !money) return false;
      return !rows.some((row) => row.kind === item.kind);
    })
    .map((item): BellRow => {
      const title = item.kind === "return_opened" ? count(t.note.returnTitle, 1) : item.kind === "refund_paid" ? count(t.note.refundTitle, 1) : item.title;
      return { key: item.id, kind: item.kind, tone: "info", title, detail: "", href: item.href, at: item.at, event: true, signature: item.id };
    });

  return [...stored, ...rows];
}

export function emptyLine(s: State, profile: Profile, t: Strings): string {
  const can = (feature: FeatureKey) => canAccess(profile, feature, s.featureSwitches);
  const money = can("finances") ? ` ${t.bell.emptyMoney}` : "";
  if (can("orders") && can("inventory")) return `${t.bell.empty}${money}`;
  if (can("tasks") && can("it")) return `${t.bell.emptyAlerts}${money}`;
  if (can("tasks")) return `${t.bell.emptyPartner}${money}`;
  return `${t.bell.emptyNone}${money}`;
}

/* What each profile has marked as seen. Memory only, so a reload shows everything as new again. */
const seen = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

export const subscribeSeen = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const seenVersion = () => version;

export const isUnread = (profile: Profile, row: BellRow) => seen.get(`${profile}:${row.key}`) !== row.signature;

export function markAllSeen(profile: Profile, rows: BellRow[]): void {
  rows.forEach((row) => seen.set(`${profile}:${row.key}`, row.signature));
  bump();
}

registerReset(() => {
  seen.clear();
  bump();
});

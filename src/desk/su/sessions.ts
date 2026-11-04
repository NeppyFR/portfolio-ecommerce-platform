import { DEMO_NOW_MS } from "@/store/clock";
import type { ActivityRow, Profile, SignInAttempt, StaffSession, State } from "@/store/types";

export type SessionGroup = { profile: Profile | null; sessions: StaffSession[] };

const ORDER: (Profile | null)[] = ["owner", "finance", "warehouse", "studio", "superUser", null];

/** Running sessions. This browser's row always wears the profile in use, so stepping in moves it. */
export function runningSessions(s: Pick<State, "sessions" | "profile">): StaffSession[] {
  return s.sessions
    .filter((session) => Date.parse(session.expiresAt) > DEMO_NOW_MS)
    .map((session) => (session.isThisBrowser ? { ...session, profile: s.profile } : session));
}

export function groupSessions(sessions: StaffSession[]): SessionGroup[] {
  return ORDER.map((profile) => ({ profile, sessions: sessions.filter((x) => x.profile === profile) })).filter((g) => g.sessions.length > 0);
}

/** "Phone, Safari": the kind of device translates, the browser does not. */
export function deviceLabel(device: string, words: Record<string, string>): string {
  const [kind, ...rest] = device.split(", ");
  return [words[kind] ?? kind, ...rest].join(", ");
}

export const signedInCount = (sessions: StaffSession[], profile: Profile): number => sessions.filter((x) => x.profile === profile).length;

export const MAX_FAILURES_SHOWN = 20;
const DAY_MS = 86_400_000;

export type AttemptStats = { day: number; week: number; recent: SignInAttempt[]; lastSuper: string | null };

/** Failed attempts in 24 h and 7 days, up to 20 of them newest first, and the last superUser sign-in. */
export function attemptStats(attempts: SignInAttempt[], nowMs: number): AttemptStats {
  const failed = attempts.filter((a) => a.outcome === "failure").sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const within = (ms: number) => failed.filter((a) => nowMs - Date.parse(a.at) < ms);
  const week = within(7 * DAY_MS);
  const lastSuper = attempts.filter((a) => a.profile === "superUser" && a.outcome === "success").map((a) => a.at).sort().at(-1) ?? null;
  return { day: within(DAY_MS).length, week: week.length, recent: week.slice(0, MAX_FAILURES_SHOWN), lastSuper };
}

export type RecentKind = "set" | "reset" | "revoke" | "danger";

export function recentKind(action: string): RecentKind | null {
  if (action === "access.set") return "set";
  if (action === "access.reset") return "reset";
  if (action === "auth.revoke_sessions") return "revoke";
  if (action.startsWith("danger.")) return "danger";
  return null;
}

/** What the overview lists: access changes, ended sessions and danger previews, at most 10. The same change said twice shows once, newest first. */
export function recentChanges(activity: ActivityRow[]): ActivityRow[] {
  const seen = new Set<string>();
  const out: ActivityRow[] = [];
  for (const row of activity) {
    if (recentKind(row.action) === null) continue;
    const key = `${row.action}|${row.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length === 10) break;
  }
  return out;
}

const PERSON_WORDS: Record<string, string> = { Owner: "owner", Finance: "finance", Warehouse: "warehouse", Studio: "studio" };

export type RecentWords = {
  feature: (key: string) => string | undefined;
  person: (profile: string) => string;
  on: string;
  off: string;
  until: string;
  day: (iso: string) => string;
  reset: string;
  endedOne: string;
  endedProfile: string;
  endedNoProfile: string;
  endedOthers: string;
  danger: string;
};

/** The log keeps its English shape; the overview says the same thing in the page's language. An unknown shape prints as written. */
export function describeRecent(detail: string, w: RecentWords): string {
  const set = /^(Owner|Finance|Warehouse|Studio): (\w+) (on|off)(?: until (\d{4}-\d{2}-\d{2}))?$/.exec(detail);
  if (set) {
    const key = set[2] === "Checklist" ? "tasks" : set[2].toLowerCase();
    const feature = w.feature(key);
    if (!feature) return detail;
    const change = (set[3] === "on" ? w.on : w.off).replace("{feature}", feature);
    const end = set[4] ? ` ${w.until.replace("{day}", w.day(set[4]))}` : "";
    return `${w.person(PERSON_WORDS[set[1]])}: ${change}${end}`;
  }
  const reset = /^(Owner|Finance|Warehouse|Studio): back to the defaults$/.exec(detail);
  if (reset) return w.reset.replace("{who}", w.person(PERSON_WORDS[reset[1]]));
  const ended = /^(Session \S+|Sessions of (.+)|Everyone else): (\d+) ended$/.exec(detail);
  if (ended) {
    const n = ended[3];
    if (ended[1].startsWith("Session ")) return w.endedOne.replace("{id}", ended[1].slice("Session ".length));
    if (ended[1] === "Everyone else") return w.endedOthers.replace("{n}", n);
    if (ended[2] === "no profile") return w.endedNoProfile.replace("{n}", n);
    return w.endedProfile.replace("{who}", w.person(ended[2])).replace("{n}", n);
  }
  const danger = /^Preview only: (\d+) rows counted, nothing was deleted$/.exec(detail);
  if (danger) return w.danger.replace("{n}", danger[1]);
  return detail;
}

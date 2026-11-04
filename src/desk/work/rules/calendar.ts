import { addDays, daysBetween, eachDay, monthBounds, weekBounds } from "@/lib/dates";
import { dayKey, formatMonth, formatTime } from "@/lib/format";
import type { CalendarEvent, CalendarEventType, Drop, Lang, Person, Task } from "@/store/types";

export const FIRST_HOUR = 7;
export const LAST_HOUR = 21;
export const HOUR_PX = 44;
export const MAX_CHIPS = 3;
export const MAX_DOTS = 4;
export const MAX_RANGE_DAYS = 366;
export const EVENT_TYPES: CalendarEventType[] = ["drop", "sample", "shoot", "meeting", "legal", "campaign", "other"];

export type EntrySource = "manual" | "drop" | "task";
export type CalendarEntry = { id: string; source: EntrySource; refId: string; title: string; type: CalendarEventType; day: string; lastDay: string; allDay: boolean; startMin: number | null; endMin: number | null; people: Person[]; notes: string };

export const minutesOf = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const hhmm = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const EVERYONE: Person[] = ["owner", "finance", "warehouse", "studio"];

/** The three sources and nothing else: typed-in events, drop launch dates, open task due dates. Done tasks drop out. */
export function buildEntries(events: CalendarEvent[], drops: Drop[], tasks: Task[]): CalendarEntry[] {
  const manual: CalendarEntry[] = events.map((e) => {
    const day = dayKey(e.startsAt);
    return {
      id: e.id,
      source: "manual",
      refId: e.id,
      title: e.title,
      type: e.type,
      day,
      lastDay: e.allDay && e.endsAt ? dayKey(e.endsAt) : day,
      allDay: e.allDay,
      startMin: e.allDay ? null : minutesOf(formatTime(e.startsAt)),
      endMin: e.allDay || !e.endsAt ? null : minutesOf(formatTime(e.endsAt)),
      people: e.attendees,
      notes: e.notes,
    };
  });
  const launches: CalendarEntry[] = drops.flatMap((d) => {
    if (!d.launchOn) return [];
    const start = d.launchAt ? minutesOf(formatTime(d.launchAt)) : null;
    return [{ id: `drop:${d.id}`, source: "drop" as const, refId: d.id, title: d.name, type: "drop" as const, day: d.launchOn, lastDay: d.launchOn, allDay: start === null, startMin: start, endMin: start === null ? null : start + 60, people: EVERYONE, notes: "" }];
  });
  const due: CalendarEntry[] = tasks.flatMap((t) => (t.doneAt === null && t.dueOn ? [{ id: `task:${t.id}`, source: "task" as const, refId: t.id, title: t.title, type: "other" as const, day: t.dueOn, lastDay: t.dueOn, allDay: true, startMin: null, endMin: null, people: t.assignees, notes: t.notes }] : []));
  return [...manual, ...launches, ...due];
}

export const occursOn = (entry: Pick<CalendarEntry, "day" | "lastDay">, day: string): boolean => entry.day <= day && day <= entry.lastDay;

export const inRange = (entry: Pick<CalendarEntry, "day" | "lastDay">, start: string, end: string): boolean => entry.day <= end && entry.lastDay >= start;

/** All-day first, then date, start, title. */
export function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  const start = (a.startMin ?? 0) - (b.startMin ?? 0);
  if (start !== 0) return start;
  return a.title.localeCompare(b.title, "en");
}

export const entriesOn = (entries: CalendarEntry[], day: string): CalendarEntry[] => entries.filter((e) => occursOn(e, day)).sort(compareEntries);

export const monthCount = (entries: CalendarEntry[], month: string): number => {
  const { start, end } = monthBounds(month);
  return entries.filter((e) => inRange(e, start, end)).length;
};

/** People first, then types: type counts count within the people filter. */
export type EntryFilter = { people: Person[]; hidden: CalendarEventType[] };
export const NO_FILTER: EntryFilter = { people: [], hidden: [] };
export const passesPeople = (entry: CalendarEntry, people: Person[]): boolean => people.length === 0 || entry.people.some((p) => people.includes(p));
export const passes = (entry: CalendarEntry, filter: EntryFilter): boolean => passesPeople(entry, filter.people) && !filter.hidden.includes(entry.type);

/** Start clamped into the grid, end at least start + 30, a missing end means 60 minutes. */
export function blockSpan(entry: Pick<CalendarEntry, "startMin" | "endMin">): { start: number; end: number } {
  const first = FIRST_HOUR * 60;
  const last = (LAST_HOUR + 1) * 60;
  const rawStart = entry.startMin ?? first;
  const start = Math.max(first, Math.min(rawStart, last - 30));
  const rawEnd = entry.endMin ?? rawStart + 60;
  const end = Math.min(last, Math.max(rawEnd, start + 30));
  return { start, end };
}

export const blockTop = (start: number): number => ((start - FIRST_HOUR * 60) / 60) * HOUR_PX;
export const blockHeight = (start: number, end: number): number => ((end - start) / 60) * HOUR_PX;

export type Placed<T> = { item: T; start: number; end: number; lane: number; lanes: number };

/** Sort by start, then longest first. Events chain into a cluster while they overlap; each takes the lowest free lane. */
export function place<T extends Pick<CalendarEntry, "startMin" | "endMin">>(items: T[]): Placed<T>[] {
  const spans = items.map((item) => ({ item, ...blockSpan(item) })).sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 0);
    cluster.forEach((c) => {
      c.lanes = lanes;
      out.push(c);
    });
    cluster = [];
  };
  for (const span of spans) {
    if (cluster.length && span.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((c) => c.end > span.start).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane += 1;
    cluster.push({ ...span, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, span.end);
  }
  flush();
  return out;
}

export type EventDraft = { title: string; allDay: boolean; day: string; until: string; start: string; end: string; type: CalendarEventType; people: Person[]; notes: string };
export type EventProblem = "title" | "times" | "endAfterStart" | "people" | "untilBefore" | "tooLong" | "day";

/** The first thing wrong with a draft, in the order the form reads, or null. */
export function eventProblem(d: EventDraft): EventProblem | null {
  if (!d.title.trim()) return "title";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return "day";
  if (d.allDay) {
    if (d.until) {
      if (d.until < d.day) return "untilBefore";
      if (daysBetween(d.day, d.until) > MAX_RANGE_DAYS) return "tooLong";
    }
  } else {
    if (!d.start || !d.end) return "times";
    if (minutesOf(d.end) <= minutesOf(d.start)) return "endAfterStart";
  }
  if (d.people.length === 0) return "people";
  return null;
}

const LONG_WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
};

const parts = (day: string) => day.split("-").map(Number);
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

export const longWeekday = (day: string, lang: Lang): string => LONG_WEEKDAYS[lang][noon(day).getUTCDay()];

/** `Monday, 26 October 2026` or `Montag, 26. Oktober 2026`. */
export function longDay(day: string, lang: Lang): string {
  const [, , d] = parts(day);
  const [monthName, year] = formatMonth(day.slice(0, 7), lang).split(" ");
  return lang === "de" ? `${longWeekday(day, lang)}, ${d}. ${monthName} ${year}` : `${longWeekday(day, lang)}, ${d} ${monthName} ${year}`;
}

/** `4–10 January 2027`, `4.–10. Januar 2027`; across a month, `28 December – 3 January 2027`. */
export function weekTitle(anyDay: string, lang: Lang): string {
  const { start, end } = weekBounds(anyDay);
  const [, , a] = parts(start);
  const [, , b] = parts(end);
  const [endMonth, year] = formatMonth(end.slice(0, 7), lang).split(" ");
  if (start.slice(0, 7) === end.slice(0, 7)) return lang === "de" ? `${a}.–${b}. ${endMonth} ${year}` : `${a}–${b} ${endMonth} ${year}`;
  const [startMonth] = formatMonth(start.slice(0, 7), lang).split(" ");
  return lang === "de" ? `${a}. ${startMonth} – ${b}. ${endMonth} ${year}` : `${a} ${startMonth} – ${b} ${endMonth} ${year}`;
}

export type RelativeDay = { kind: "today" | "tomorrow" | "yesterday" | "future" | "past"; n: number };
export function relativeDay(day: string, today: string): RelativeDay {
  const n = daysBetween(today, day);
  if (n === 0) return { kind: "today", n: 0 };
  if (n === 1) return { kind: "tomorrow", n: 1 };
  if (n === -1) return { kind: "yesterday", n: 1 };
  return n > 0 ? { kind: "future", n } : { kind: "past", n: -n };
}

export const weekDays = (anyDay: string): string[] => {
  const { start, end } = weekBounds(anyDay);
  return eachDay(start, end);
};

export const shiftWeek = (day: string, n: number): string => addDays(day, n * 7);

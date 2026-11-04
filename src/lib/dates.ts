/**
 * Day keys are `YYYY-MM-DD` strings. Arithmetic runs on UTC noon, so a clock change never moves a day.
 * Weeks start on Monday. Keys compare as strings.
 */
import type { Lang } from "@/store/types";

const NOON = "T12:00:00Z";
const DAY_MS = 86_400_000;

const asDate = (day: string) => new Date(day + NOON);
const toKey = (date: Date) => date.toISOString().slice(0, 10);

export const isDayKey = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = asDate(value);
  return !Number.isNaN(date.getTime()) && toKey(date) === value;
};

export function addDays(day: string, n: number): string {
  return toKey(new Date(asDate(day).getTime() + n * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / DAY_MS);
}

/** 0 is Monday, 6 is Sunday. */
export const weekdayIndex = (day: string): number => (asDate(day).getUTCDay() + 6) % 7;

export const startOfWeek = (day: string): string => addDays(day, -weekdayIndex(day));

export function weekBounds(day: string): { start: string; end: string } {
  const start = startOfWeek(day);
  return { start, end: addDays(start, 6) };
}

export const monthOf = (day: string): string => day.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthBounds(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/** `2026-11-30` gives `2026-Q4`. */
export function quarterOf(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function quarterBounds(quarter: string): { start: string; end: string } {
  const [y, q] = quarter.split("-Q").map(Number);
  const first = (q - 1) * 3 + 1;
  return { start: `${y}-${String(first).padStart(2, "0")}-01`, end: monthBounds(`${y}-${String(first + 2).padStart(2, "0")}`).end };
}

/** ISO week number and its week-year: Thursday decides. */
export function isoWeek(day: string): { year: number; week: number } {
  const thursday = addDays(startOfWeek(day), 3);
  const year = Number(thursday.slice(0, 4));
  return { year, week: Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1 };
}

/** The Monday-to-Sunday days of a month grid, always whole weeks. */
export function monthWeeks(month: string): string[][] {
  const { start, end } = monthBounds(month);
  const weeks: string[][] = [];
  for (let monday = startOfWeek(start); monday <= end; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const SHORT_MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
};

export const weekdayName = (day: string, lang: Lang): string => WEEKDAYS[lang][weekdayIndex(day)];

/** `Fri, 8 Jan` or `Fr, 8. Jan.` */
export function shortDay(day: string, lang: Lang): string {
  const [, m, d] = day.split("-").map(Number);
  return lang === "de" ? `${weekdayName(day, lang)}, ${d}. ${SHORT_MONTHS.de[m - 1]}` : `${weekdayName(day, lang)}, ${d} ${SHORT_MONTHS.en[m - 1]}`;
}

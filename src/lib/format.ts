import type { Lang } from "@/store/types";
import { DEMO_TIME_ZONE } from "@/store/clock";

const NBSP = " ";
const MINUS = "−";

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** `formatChf(128400)` gives `CHF 1'284.00` with a non-breaking space. Negative uses U+2212. */
export function formatChf(rappen: number, opts: { symbol?: boolean } = {}): string {
  if (opts.symbol === false) {
    const abs = Math.abs(Math.round(rappen));
    return `${rappen < 0 ? MINUS : ""}${groupThousands(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, "0")}`;
  }
  return formatMinor(rappen, "CHF");
}

/** Foreign plan amounts are minor units: `formatMinor(2000, "USD")` gives `USD 20.00`. */
export function formatMinor(minor: number, currency: string): string {
  const abs = Math.abs(Math.round(minor));
  const whole = groupThousands(String(Math.floor(abs / 100)));
  const cents = String(abs % 100).padStart(2, "0");
  return `${minor < 0 ? MINUS : ""}${currency}${NBSP}${whole}.${cents}`;
}

/** `+CHF 50.00`, `−CHF 50.00`, and plain at zero. */
export function signedChf(rappen: number): string {
  return `${rappen > 0 ? "+" : ""}${formatChf(rappen)}`;
}

/**
 * Accepts `12.50`, `12,50`, `1'234.00`, `CHF 12.50`, a leading minus, at most 2 decimals.
 * Returns Rappen, or null for anything else.
 */
export function parseChf(text: string): number | null {
  const cleaned = text.trim().replace(/^CHF/i, "").replace(/[\s ]/g, "").replace(/−/g, "-");
  const match = /^(-?)(\d{1,3}(?:'\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[2].replaceAll("'", ""));
  const cents = Number((match[3] ?? "").padEnd(2, "0") || "0");
  const value = whole * 100 + cents;
  if (!Number.isSafeInteger(value)) return null;
  return match[1] && value !== 0 ? -value : value;
}

type Parts = { year: string; month: string; day: string; hour: string; minute: string };

const zoned = new Intl.DateTimeFormat("en-GB", {
  timeZone: DEMO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function zonedParts(date: Date | string): Parts {
  const out: Parts = { year: "", month: "", day: "", hour: "", minute: "" };
  for (const part of zoned.formatToParts(typeof date === "string" ? new Date(date) : date)) {
    if (part.type in out) out[part.type as keyof Parts] = part.value;
  }
  return out;
}

/** `18.10.2026`. A bare day key prints the same day in every viewer's time zone. */
export function formatDate(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y}`;
  }
  const p = zonedParts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/** `18.10.2026, 14:05` */
export function formatDateTime(date: Date | string): string {
  const p = zonedParts(date);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

/** `18.10.2026 14:05`, for Inbox rows. */
export function formatStamp(date: Date | string): string {
  const p = zonedParts(date);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** `14:05` */
export function formatTime(date: Date | string): string {
  const p = zonedParts(date);
  return `${p.hour}:${p.minute}`;
}

/** Hour of day, 0 to 23, in the shop's time zone. */
export const hourOf = (date: Date | string): number => Number(zonedParts(date).hour);

/** The shop's calendar day of a timestamp: `2026-10-18`. */
export function dayKey(date: Date | string): string {
  const p = zonedParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Decimal units, as on the Files screen: `24.6 MB`, `512 B`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};

/** `2026-10` gives `October 2026` or `Oktober 2026`. */
export function formatMonth(month: string, lang: Lang): string {
  const [y, m] = month.split("-");
  return `${MONTHS[lang][Number(m) - 1]} ${y}`;
}

/** Chart axis values: `1'284`, and `12.5k` from 10,000. */
export function chfTick(rappen: number): string {
  const chf = rappen / 100;
  if (Math.abs(chf) >= 10000) return `${(chf / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return groupThousands(String(Math.round(chf)));
}

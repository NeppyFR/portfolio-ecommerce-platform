import { canAccess, hasFullPowers } from "@/lib/features";
import { itemSales } from "@/lib/metrics";
import { compareVariants } from "@/lib/product-rules";
import type { Drop, FeatureSwitch, Product, Profile, Rappen, SizeCode, State, Variant } from "@/store/types";

/** Sold divided by sold plus what is still available. Null when there was never anything to compare. */
export function sellThrough(sold: number, available: number): number | null {
  const total = sold + Math.max(0, available);
  return total > 0 ? sold / total : null;
}

/** `62 %` for 0.62, a dash for null. */
export function percent(share: number | null): string {
  return share === null ? "–" : `${Math.round(share * 100)} %`;
}

export type Countdown = { past: boolean; days: number; hours: number; minutes: number };

/** Whole days, hours and minutes between now and the launch, rounded down, and whether it has passed. */
export function countdown(nowMs: number, launchMs: number): Countdown {
  const minutes = Math.floor(Math.abs(launchMs - nowMs) / 60_000);
  return { past: nowMs >= launchMs, days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

const ZURICH = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The Zurich wall clock of an instant: `{ day: "2027-01-17", time: "18:00" }`. */
export function zurichWallClock(iso: string): { day: string; time: string } {
  const parts = Object.fromEntries(ZURICH.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The instant of a Zurich wall-clock time. Corrects for the offset twice, so clock-change days land right. */
export function zurichInstant(day: string, time: string): string {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  for (let i = 0; i < 2; i += 1) {
    const wall = zurichWallClock(new Date(guess).toISOString());
    const [wy, wmo, wd] = wall.day.split("-").map(Number);
    const [wh, wmi] = wall.time.split(":").map(Number);
    guess += wanted - Date.UTC(wy, wmo - 1, wd, wh, wmi);
  }
  return new Date(guess).toISOString();
}

export const DROP_SIZES: SizeCode[] = ["XS", "S", "M", "L", "XL", "ONE_SIZE"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type WaitlistLine = { email: string; size: SizeCode | null; name: string };

/**
 * Pasted waitlist lines: `email`, `email, size` or `email, size, name`, split on comma, semicolon or tab.
 * Addresses are lower-cased, a line twice counts once, and anything unreadable comes back as is.
 */
export function parseWaitlist(text: string): { entries: WaitlistLine[]; invalid: string[] } {
  const entries: WaitlistLine[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [emailPart = "", sizePart = "", ...rest] = line.split(/[,;\t]/).map((s) => s.trim());
    const email = emailPart.toLowerCase();
    const sizeUpper = sizePart.toUpperCase().replace(/\s+/g, "_");
    const size = (DROP_SIZES as string[]).includes(sizeUpper) ? (sizeUpper as SizeCode) : null;
    if (!EMAIL_RE.test(email) || email.length > 254 || (sizePart && !size)) {
      invalid.push(line);
      continue;
    }
    const key = `${email}|${size ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ email, size, name: rest.join(" ").slice(0, 80) });
  }
  return { entries, invalid };
}

export type DropInputProblem = "name" | "time" | "time_format";

export function dropInputProblem(input: { name: string; launchOn: string | null; launchTime: string | null }): DropInputProblem | null {
  if (!input.name.trim() || input.name.trim().length > 60) return "name";
  if (input.launchTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.launchTime)) return "time_format";
    if (!input.launchOn) return "time";
  }
  return null;
}

/** No date first, then the latest launch day, ties by name. */
export function compareDrops(a: Pick<Drop, "launchOn" | "name">, b: Pick<Drop, "launchOn" | "name">): number {
  if (!a.launchOn && b.launchOn) return -1;
  if (a.launchOn && !b.launchOn) return 1;
  if (a.launchOn && b.launchOn && a.launchOn !== b.launchOn) return a.launchOn < b.launchOn ? 1 : -1;
  return a.name.localeCompare(b.name);
}

/** A launch time counts from its instant; a day alone counts from midnight in Zurich. */
export function launchMs(drop: Pick<Drop, "launchAt" | "launchOn">): number | null {
  if (drop.launchAt) return Date.parse(drop.launchAt);
  if (drop.launchOn) return Date.parse(zurichInstant(drop.launchOn, "00:00"));
  return null;
}

/** The next launch still ahead, nearest first. */
export function nextLaunch(drops: Drop[], nowMs: number): Drop | null {
  const ahead = drops.filter((d) => {
    const at = launchMs(d);
    return d.status === "planned" && at !== null && at > nowMs;
  });
  ahead.sort((a, b) => (launchMs(a) as number) - (launchMs(b) as number));
  return ahead[0] ?? null;
}

export type DropSize = { variant: Variant; available: number; sold: number };
export type DropProduct = { product: Product; revenueRappen: Rappen; sold: number; sizes: DropSize[] };
export type WaitCount = { productId: string | null; size: SizeCode | null; waiting: number; notified: number };
export type DropHub = {
  totals: { sold: number; revenueRappen: Rappen; available: number; waiting: number };
  products: DropProduct[];
  lists: { id: string; name: string; done: number; total: number; dropDay: boolean }[];
  loose: { done: number; total: number };
  ledger: { count: number; inRappen: Rappen; outRappen: Rappen };
  files: number;
  counts: WaitCount[];
};

/** Everything one drop's sheet shows, read from the whole state. */
export function dropHub(s: State, drop: Drop): DropHub {
  const sold = new Map<string, number>();
  const revenue = new Map<string, number>();
  for (const order of s.orders) {
    if (!order.paidAt) continue;
    for (const item of order.items) {
      sold.set(item.variantId, (sold.get(item.variantId) ?? 0) + item.quantity);
      revenue.set(item.productId, (revenue.get(item.productId) ?? 0) + itemSales(item));
    }
  }
  const products: DropProduct[] = [];
  for (const id of drop.productIds) {
    const product = s.products.find((p) => p.id === id);
    if (!product) continue;
    const sizes = product.variants.slice().sort(compareVariants).map((variant) => ({ variant, available: variant.stock - variant.reserved, sold: sold.get(variant.id) ?? 0 }));
    products.push({ product, revenueRappen: revenue.get(id) ?? 0, sold: sizes.reduce((sum, v) => sum + v.sold, 0), sizes });
  }
  const lists = s.taskLists
    .filter((l) => l.dropId === drop.id)
    .map((l) => {
      const tasks = s.tasks.filter((t) => t.listId === l.id);
      return { id: l.id, name: l.name, done: tasks.filter((t) => t.doneAt).length, total: tasks.length, dropDay: l.isDropDay };
    });
  const listIds = new Set(lists.map((l) => l.id));
  const loose = s.tasks.filter((t) => t.dropId === drop.id && !listIds.has(t.listId));
  const entries = s.ledger.filter((e) => e.dropId === drop.id);
  const countMap = new Map<string, WaitCount>();
  for (const entry of drop.waitlist) {
    const key = `${entry.productId ?? ""}|${entry.size ?? ""}`;
    const row = countMap.get(key) ?? { productId: entry.productId, size: entry.size, waiting: 0, notified: 0 };
    if (entry.notifiedAt) row.notified += 1;
    else row.waiting += 1;
    countMap.set(key, row);
  }
  return {
    totals: {
      sold: products.reduce((sum, p) => sum + p.sold, 0),
      revenueRappen: products.reduce((sum, p) => sum + p.revenueRappen, 0),
      available: products.reduce((sum, p) => sum + p.sizes.reduce((inner, v) => inner + Math.max(0, v.available), 0), 0),
      waiting: drop.waitlist.filter((e) => !e.notifiedAt).length,
    },
    products,
    lists,
    loose: { done: loose.filter((t) => t.doneAt).length, total: loose.length },
    ledger: { count: entries.length, inRappen: entries.reduce((sum, e) => sum + Math.max(0, e.amountRappen), 0), outRappen: entries.reduce((sum, e) => sum + Math.max(0, -e.amountRappen), 0) },
    files: s.files.filter((f) => f.dropId === drop.id && !f.trashedAt).length,
    counts: [...countMap.values()].sort((a, b) => b.waiting - a.waiting),
  };
}

/** Stock and sales of a drop show only to a profile that may open every page those numbers come from. */
export function seesDropNumbers(profile: Profile, switches: FeatureSwitch[]): boolean {
  return (["analytics", "orders", "inventory", "products", "marketing"] as const).every((feature) => canAccess(profile, feature, switches));
}

/** A drop's ledger sums follow the Finances feature, so the card never shows money its link cannot open. */
export const seesDropMoney = (profile: Profile, switches: FeatureSwitch[]): boolean => canAccess(profile, "finances", switches);

/** Only the fully empowered profiles see waitlist addresses and add products to a drop. */
export const seesWaitlistAddresses = (profile: Profile): boolean => hasFullPowers(profile);

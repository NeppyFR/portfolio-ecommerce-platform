/** mulberry32. One generator per seed run, with a fixed order of calls, so build and browser agree. */
export const SEED_NUMBER = 20270108;

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
  shuffle: <T>(items: readonly T[]) => T[];
  hex: (length: number) => string;
};

export function createRng(seed: number = SEED_NUMBER): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const chance = (p: number) => next() < p;
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const hex = (length: number) => {
    let out = "";
    while (out.length < length) out += int(0, 15).toString(16);
    return out;
  };
  return { next, int, pick, chance, shuffle, hex };
}

/** The shop's wall-clock time as an ISO instant. Summer time ran until 25 October 2026. */
export function zurich(day: string, hour = 12, minute = 0): string {
  const offset = day < "2026-10-25" && day >= "2026-03-29" ? 2 : 1;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - offset, minute)).toISOString();
}

export const plusMinutes = (iso: string, minutes: number): string => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

import type { Tone } from "@/store/types";

/** Lower means more urgent. */
export const TONE_RANK: Record<Tone, number> = { bad: 0, warn: 1, unknown: 2, ok: 3, off: 4 };

/** The lowest rank wins; the first one wins a tie. */
export function worstState<T extends { tone: Tone }>(states: T[]): T | null {
  let worst: T | null = null;
  for (const state of states) {
    if (!worst || TONE_RANK[state.tone] < TONE_RANK[worst.tone]) worst = state;
  }
  return worst;
}

export function worstTone(tones: Tone[]): Tone {
  return worstState(tones.map((tone) => ({ tone })))?.tone ?? "off";
}

/** Keeps bad, warn and unknown, sorted by rank and then by the order given. `ok` and `off` are left out. */
export function attention<T extends { tone: Tone }>(areas: T[]): T[] {
  return areas
    .map((area, index) => ({ area, index }))
    .filter(({ area }) => area.tone === "bad" || area.tone === "warn" || area.tone === "unknown")
    .sort((a, b) => TONE_RANK[a.area.tone] - TONE_RANK[b.area.tone] || a.index - b.index)
    .map(({ area }) => area);
}

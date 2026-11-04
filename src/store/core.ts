import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import type { State } from "./types";

export type { State };

const SEED: State = createSeed();
let state: State = createSeed();
const listeners = new Set<() => void>();

export const getState = () => state;

export function update(fn: (s: State) => State) {
  state = fn(state);
  listeners.forEach((l) => l());
}

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(SEED));
}

const resets = new Set<() => void>();
export const registerReset = (fn: () => void) => {
  resets.add(fn);
};

export function resetStore() {
  state = createSeed();
  resets.forEach((r) => r());
  listeners.forEach((l) => l());
}

"use client";

import { useEffect, useRef, type RefObject } from "react";

export type LoopFrame = (deltaMs: number, elapsedMs: number) => void;
export type VisibleLoopOptions = { enabled?: boolean; maxDeltaMs?: number };

/**
 * One rAF per surface, stopped by IntersectionObserver when off-screen and by visibilitychange when hidden.
 * No timers run while paused, and elapsed time only counts frames that ran, so a paused surface resumes where it was.
 */
export function useVisibleLoop(target: RefObject<Element | null>, frame: LoopFrame, options: VisibleLoopOptions = {}): void {
  const { enabled = true, maxDeltaMs = 64 } = options;
  const latest = useRef(frame);
  useEffect(() => {
    latest.current = frame;
  });
  useEffect(() => {
    const el = target.current;
    if (!enabled || !el) return;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let onScreen = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const delta = last === 0 ? 0 : Math.min(now - last, maxDeltaMs);
      last = now;
      elapsed += delta;
      latest.current(delta, elapsed);
    };
    const sync = () => {
      const run = onScreen && document.visibilityState === "visible";
      if (run && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!run && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [target, enabled, maxDeltaMs]);
}

import { describe, expect, it, vi } from "vitest";
import { EDGES, STATIONS } from "@/map/data";
import {
  DWELL_MS,
  LOOP_REST_MS,
  STATION_STEP,
  STORY_LOOP_MS,
  STORY_STEPS,
  advanceClock,
  ambientPeriod,
  ambientShare,
  createClock,
  easeHop,
  edgeFade,
  logTime,
  logWindow,
  pointOn,
  seekClock,
  stationIndexOfStep,
  stepShare,
  stepStart,
  storyAt,
  toTransform,
} from "@/map/packets";

describe("story", () => {
  it("runs the hops of the order in order, with Books replaying the end of the database wire", () => {
    expect(STORY_STEPS.map((s) => s.edge)).toEqual(["cDns", "dnsV", "vSt", "cSt", "stV", "vSb", "vRs", "vSb", "rsC"]);
    const books = STORY_STEPS[7];
    expect(books.station).toBe("books");
    expect(books.from).toBeGreaterThan(0);
    expect(books.to).toBe(1);
  });

  it("maps every station to its first hop, in rail order", () => {
    const steps = STATIONS.map((s) => STATION_STEP[s.id]);
    expect(steps).toEqual([0, 2, 5, 6, 7, 8]);
    STATIONS.forEach((s, i) => expect(stationIndexOfStep(STATION_STEP[s.id])).toBe(i));
  });

  it("says the money and the mail are not real", () => {
    const words = STORY_STEPS.map((s) => s.en).join(" | ");
    expect(words).toMatch(/simulated/);
    expect(words).toMatch(/rendered, not sent/);
    const de = STORY_STEPS.map((s) => s.de).join(" | ");
    expect(de).toMatch(/simuliert/);
    expect(de).toMatch(/nicht versendet/);
  });

  it("has every hop end on a real receiver, and the packet starts each hop at its wire start", () => {
    for (const s of STORY_STEPS) {
      const edge = EDGES.find((e) => e.id === s.edge);
      expect(edge?.to).toBe(s.receiver);
      expect(stepShare(s, 0)).toBeCloseTo(s.from);
      expect(stepShare(s, 1)).toBeCloseTo(s.to);
    }
  });

  it("finds the hop for any moment and rests only at the very end", () => {
    STORY_STEPS.forEach((s, i) => {
      const at = storyAt(stepStart(i) + 1);
      expect(at.step).toBe(i);
      expect(at.resting).toBe(false);
      const dwell = storyAt(stepStart(i) + s.ms + DWELL_MS / 2);
      expect(dwell.step).toBe(i);
      expect(dwell.k).toBe(1);
    });
    const end = storyAt(STORY_LOOP_MS - LOOP_REST_MS / 2);
    expect(end.step).toBe(STORY_STEPS.length - 1);
    expect(end.resting).toBe(true);
    expect(storyAt(STORY_LOOP_MS).step).toBe(0);
    expect(storyAt(-1).step).toBe(STORY_STEPS.length - 1);
  });

  it("eases from 0 to 1 without leaving the range", () => {
    expect(easeHop(0)).toBe(0);
    expect(easeHop(1)).toBe(1);
    for (let k = 0; k <= 1; k += 0.05) {
      expect(easeHop(k)).toBeGreaterThanOrEqual(0);
      expect(easeHop(k)).toBeLessThanOrEqual(1);
    }
  });
});

describe("ambient packets", () => {
  it("gives every wire 6 to 9 s a traversal, and the slow ones 14 s", () => {
    EDGES.forEach((e, i) => {
      const p = ambientPeriod(i, e.slow);
      if (e.slow) expect(p).toBe(14000);
      else {
        expect(p).toBeGreaterThanOrEqual(6000);
        expect(p).toBeLessThanOrEqual(9000);
      }
    });
  });

  it("moves with time, stays on the wire and fades out at both ends", () => {
    expect(ambientShare(0, false, 1000)).not.toBe(ambientShare(0, false, 2000));
    for (let ms = 0; ms < 60000; ms += 777) {
      const share = ambientShare(5, false, ms);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThan(1);
    }
    expect(edgeFade(0)).toBe(0);
    expect(edgeFade(1)).toBe(0);
    expect(edgeFade(0.5)).toBe(1);
  });

  it("reads positions by interpolation and writes them only as a transform", () => {
    const xy = new Float32Array(97 * 2);
    for (let i = 0; i <= 96; i++) {
      xy[i * 2] = i;
      xy[i * 2 + 1] = 2 * i;
    }
    expect(pointOn(xy, 0)).toEqual([0, 0]);
    expect(pointOn(xy, 1)).toEqual([96, 192]);
    expect(pointOn(xy, 2)).toEqual([96, 192]);
    expect(pointOn(xy, 0.5)).toEqual([48, 96]);
    expect(toTransform([1, 2.5])).toBe("translate(1.00px,2.50px)");
  });
});

describe("clock and log", () => {
  it("tells listeners when the hop changes, not on every frame", () => {
    const clock = createClock();
    const heard = vi.fn();
    clock.listeners.add(heard);
    advanceClock(clock, 10);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenLastCalledWith(0);
    advanceClock(clock, 10);
    advanceClock(clock, 10);
    expect(heard).toHaveBeenCalledTimes(1);
    advanceClock(clock, stepStart(1));
    expect(heard).toHaveBeenLastCalledWith(1);
  });

  it("counts loops when the story wraps", () => {
    const clock = createClock();
    advanceClock(clock, STORY_LOOP_MS - 5);
    expect(clock.loops).toBe(0);
    advanceClock(clock, 10);
    expect(clock.loops).toBe(1);
    expect(clock.ms).toBe(5);
  });

  it("seeks to the start of a hop, wraps out-of-range steps and tells the listeners", () => {
    const clock = createClock();
    const heard = vi.fn();
    clock.listeners.add(heard);
    seekClock(clock, 3);
    expect(clock.step).toBe(3);
    expect(clock.ms).toBe(stepStart(3));
    expect(clock.seeks).toBe(1);
    expect(heard).toHaveBeenLastCalledWith(3);
    seekClock(clock, STORY_STEPS.length + 1);
    expect(clock.step).toBe(1);
    seekClock(clock, -1);
    expect(clock.step).toBe(STORY_STEPS.length - 1);
  });

  it("shows the last four lines, oldest first, wrapping into the previous loop", () => {
    expect(logWindow(5)).toEqual([2, 3, 4, 5].map((step) => ({ step, loopsBack: 0 })));
    const wrapped = logWindow(1);
    expect(wrapped.map((l) => l.step)).toEqual([7, 8, 0, 1]);
    expect(wrapped.map((l) => l.loopsBack)).toEqual([1, 1, 0, 0]);
    expect(logWindow(0).length).toBe(4);
  });

  it("stamps the log with the demo's own clock", () => {
    expect(logTime(0, 0, 0)).toBe("14:02:00");
    expect(logTime(3, 0, 0)).toMatch(/^14:02:0\d$/);
    expect(logTime(8, 1, 0) < "14:02:00").toBe(true);
  });
});

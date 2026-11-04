import { EDGES, STATIONS, STORY, edgePath, type EdgeId, type MapEdge, type MapMode, type Station } from "./data";
import type { NodeId } from "@/store/types";

/** Packet timing and geometry. Pure apart from `sampleEdges`, so the story can be tested without a browser. */

export type StoryStep = {
  edge: EdgeId;
  /** Share of the wire this hop starts and ends at. Only the Books replay starts part way along. */
  from: number;
  to: number;
  ms: number;
  en: string;
  de: string;
  station: Station["id"];
  receiver: NodeId;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const SAMPLES = 96;
/** Dwell after each hop, so the flash and the log line can be read. */
export const DWELL_MS = 320;
/** Pause at the end of the loop before the next order leaves. */
export const LOOP_REST_MS = 1400;

const HOP_MS: Record<EdgeId, number> = {
  cDns: 900, pDns: 900, dnsV: 900, vSb: 800, vR2: 900, pR2: 1400, vSt: 800, cSt: 1500, stV: 800, vRs: 1100, rsC: 1200, ghV: 1200, ghSb: 1600, ghR2: 900, clMb: 800, clSb: 800,
};

const edgeOf = (id: EdgeId): MapEdge => {
  const e = EDGES.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown edge ${id}`);
  return e;
};

const stationOf = (edge: EdgeId): Station["id"] => {
  const s = STATIONS.find((x) => x.id !== "books" && x.edges.includes(edge));
  if (!s) throw new Error(`No station for ${edge}`);
  return s.id;
};

const fromStory: StoryStep[] = STORY.map((hop) => {
  const e = edgeOf(hop.edge);
  return { edge: hop.edge, from: 0, to: 1, ms: HOP_MS[hop.edge], en: hop.en, de: hop.de, station: stationOf(hop.edge), receiver: e.to };
});

const booksStep: StoryStep = {
  edge: "vSb",
  from: 0.55,
  to: 1,
  ms: 520,
  en: "Reaches the books inside a payout (simulated; the real one is booked by hand)",
  de: "Per Auszahlung ins Buch (simuliert; echt von Hand)",
  station: "books",
  receiver: "database",
};

/** The eight hops of 7.7, with Books replaying the end of the database wire between Parcel and Receipt. */
export const STORY_STEPS: StoryStep[] = [...fromStory.slice(0, 7), booksStep, fromStory[7]];

const starts: number[] = [];
let cursor = 0;
for (const step of STORY_STEPS) {
  starts.push(cursor);
  cursor += step.ms + DWELL_MS;
}
export const STORY_LOOP_MS = cursor + LOOP_REST_MS;

export const stepStart = (step: number): number => starts[step] ?? 0;

export type StoryAt = { step: number; k: number; resting: boolean };

/** Where the dark packet is `ms` into the loop. `k` is the share of the hop done, 1 while it dwells. */
export function storyAt(ms: number): StoryAt {
  const t = ((ms % STORY_LOOP_MS) + STORY_LOOP_MS) % STORY_LOOP_MS;
  for (let i = STORY_STEPS.length - 1; i >= 0; i--) {
    if (t >= starts[i]) {
      const k = Math.min(1, (t - starts[i]) / STORY_STEPS[i].ms);
      return { step: i, k, resting: i === STORY_STEPS.length - 1 && t >= starts[i] + STORY_STEPS[i].ms + DWELL_MS };
    }
  }
  return { step: 0, k: 0, resting: false };
}

export const easeHop = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** Share of the wire for this step at hop progress `k`. */
export const stepShare = (step: StoryStep, k: number): number => step.from + (step.to - step.from) * easeHop(k);

export const STATION_STEP: Record<Station["id"], number> = STATIONS.reduce(
  (acc, station) => {
    acc[station.id] = STORY_STEPS.findIndex((s) => s.station === station.id);
    return acc;
  },
  {} as Record<Station["id"], number>,
);

/** The station a step belongs to, as an index into `STATIONS`. */
export const stationIndexOfStep = (step: number): number => STATIONS.findIndex((s) => s.id === STORY_STEPS[step].station);

/** The last `count` steps up to and including `step`, oldest first, wrapping into the previous loop. */
export function logWindow(step: number, count = 4): { step: number; loopsBack: number }[] {
  const n = STORY_STEPS.length;
  const out: { step: number; loopsBack: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const raw = step - i;
    out.push({ step: ((raw % n) + n) % n, loopsBack: raw < 0 ? 1 : 0 });
  }
  return out;
}

/** One dot per running wire. 6 to 9 s a traversal, 14 s on the slow wires. */
export function ambientPeriod(index: number, slow: boolean | undefined): number {
  if (slow) return 14000;
  return 6000 + (((index * 37) % 31) / 30) * 3000;
}

export const ambientPhase = (index: number): number => (index * 0.381966) % 1;

export function ambientShare(index: number, slow: boolean | undefined, elapsedMs: number): number {
  return (ambientPhase(index) + elapsedMs / ambientPeriod(index, slow)) % 1;
}

/** Fades a dot in and out at the ends of its wire, so it does not pop under a box. */
export const edgeFade = (share: number): number => Math.min(1, Math.min(share, 1 - share) / 0.06);

export type EdgeSamples = Partial<Record<EdgeId, Float32Array>>;

/** Positions along every wire, sampled once with `getPointAtLength` on a detached path, so a hidden map still gets them. */
export function sampleEdges(mode: MapMode): EdgeSamples {
  const out: EdgeSamples = {};
  for (const e of EDGES) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", edgePath(e, mode));
    const length = path.getTotalLength();
    const xy = new Float32Array((SAMPLES + 1) * 2);
    for (let i = 0; i <= SAMPLES; i++) {
      const p = path.getPointAtLength((length * i) / SAMPLES);
      xy[i * 2] = p.x;
      xy[i * 2 + 1] = p.y;
    }
    out[e.id] = xy;
  }
  return out;
}

export function pointOn(xy: Float32Array, share: number): [number, number] {
  const f = Math.max(0, Math.min(1, share)) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(f));
  const r = f - i;
  return [xy[i * 2] + (xy[i * 2 + 2] - xy[i * 2]) * r, xy[i * 2 + 1] + (xy[i * 2 + 3] - xy[i * 2 + 1]) * r];
}

export const toTransform = (p: [number, number]): string => `translate(${p[0].toFixed(2)}px,${p[1].toFixed(2)}px)`;

/** The story clock. Advanced by whichever map is on screen, and read by the log. */
export type StoryClock = {
  ms: number;
  step: number;
  loops: number;
  listeners: Set<(step: number) => void>;
  /** Bumped by a seek, so a paused or still map redraws. */
  seeks: number;
};

export function createClock(): StoryClock {
  return { ms: 0, step: STORY_STEPS.length - 1, loops: 0, listeners: new Set(), seeks: 0 };
}

export function advanceClock(clock: StoryClock, deltaMs: number): StoryAt {
  const before = clock.ms;
  clock.ms = (clock.ms + deltaMs) % STORY_LOOP_MS;
  if (clock.ms < before) clock.loops += 1;
  const at = storyAt(clock.ms);
  if (at.step !== clock.step) {
    clock.step = at.step;
    clock.listeners.forEach((l) => l(at.step));
  }
  return at;
}

export function seekClock(clock: StoryClock, step: number): void {
  const n = STORY_STEPS.length;
  const target = ((step % n) + n) % n;
  clock.ms = stepStart(target);
  clock.step = target;
  clock.seeks += 1;
  clock.listeners.forEach((l) => l(target));
}

/** The log's clock reads the demo's own time: 14:02:00 plus the seconds into the loop. */
export function logTime(step: number, loopsBack: number, loops: number): string {
  const seconds = Math.floor((stepStart(step) + (loops - loopsBack) * STORY_LOOP_MS) / 1000);
  const total = 14 * 3600 + 2 * 60 + seconds;
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

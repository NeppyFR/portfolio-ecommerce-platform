"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { EDGES, VIEWBOX, edgePath, type EdgeId, type MapMode } from "@/map/data";
import { MapCanvas, WireWords } from "@/map/MapCanvas";
import {
  STORY_STEPS,
  advanceClock,
  ambientPeriod,
  ambientPhase,
  ambientShare,
  edgeFade,
  pointOn,
  sampleEdges,
  stepShare,
  storyAt,
  toTransform,
  type EdgeSamples,
  type StoryClock,
} from "@/map/packets";
import type { NodeId } from "@/store/types";
import { useReducedMotion } from "@/ui/useReducedMotion";
import { useVisibleLoop } from "@/ui/useVisibleLoop";

export type LiveMapProps = {
  mode: MapMode;
  labels?: boolean;
  onNode?: (id: NodeId) => void;
  viewBox?: string;
  className?: string;
  ariaLabel?: string;
  /** With a clock the bright story packet runs too. Without one, only the ambient dots. */
  clock?: StoryClock;
};

const STORY_EDGES: EdgeId[] = Array.from(new Set(STORY_STEPS.map((s) => s.edge)));

/** The gradients the public maps fill their icon tiles and their hubs with. Render once per page, wherever a map shows. */
export function MapDefs() {
  return (
    <svg width="0" height="0" className="lp-defs" aria-hidden="true">
      <defs>
        <linearGradient id="lp-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f8dff" />
          <stop offset=".55" stopColor="#2860ee" />
          <stop offset="1" stopColor="#6a5cff" />
        </linearGradient>
        {/* Blue to a deep violet: white words stay at AA across the whole fill. */}
        <linearGradient id="lp-hub" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2860ee" />
          <stop offset="1" stopColor="#5a48e6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The map with its packets. All motion goes through refs: one rAF, no React state per frame. */
export function LiveMap({ mode, labels, onNode, viewBox, className, ariaLabel, clock }: LiveMapProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const samples = useRef<EdgeSamples | null>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const star = useRef<SVGGElement>(null);
  const trail = useRef<(SVGCircleElement | null)[]>([]);
  const hot = useRef<Partial<Record<EdgeId, SVGPathElement | null>>>({});
  const elapsed = useRef(0);
  const lastHop = useRef(-1);
  const flashed = useRef(-1);
  const seenSeeks = useRef(0);

  const paths = useMemo(() => Object.fromEntries(EDGES.map((e) => [e.id, edgePath(e, mode)])) as Record<EdgeId, string>, [mode]);

  const flash = useCallback((node: NodeId) => {
    const el = root.current?.querySelector<SVGGElement>(`[data-node="${node}"]`);
    if (!el) return;
    const pulse = el.querySelector<SVGRectElement>(".ui-map-pulse");
    pulse?.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.06,1.22)" }], { duration: 400, easing: "ease-out" });
    el.animate([{ filter: "brightness(1.5)" }, { filter: "brightness(1)" }], { duration: 300, easing: "ease-out" });
  }, []);

  const drawAmbient = useCallback((ms: number, still: boolean) => {
    const s = samples.current;
    if (!s) return;
    EDGES.forEach((e, i) => {
      const dot = dots.current[i];
      const xy = s[e.id];
      if (!dot || !xy) return;
      const share = still ? 0.2 + ambientPhase(i) * 0.6 : ambientShare(i, e.slow, ms);
      dot.style.transform = toTransform(pointOn(xy, share));
      dot.style.opacity = still ? "1" : String(edgeFade(share));
    });
  }, []);

  const drawStory = useCallback(
    (step: number, k: number, resting: boolean) => {
      const s = samples.current;
      if (!s || !star.current) return;
      const hop = STORY_STEPS[step];
      const xy = s[hop.edge];
      if (!xy) return;
      const share = stepShare(hop, k);
      star.current.style.transform = toTransform(pointOn(xy, share));
      star.current.style.opacity = resting ? "0" : String(Math.min(1, k / 0.08));
      trail.current.forEach((dot, i) => {
        if (!dot) return;
        const back = stepShare(hop, Math.max(0, k - (i + 1) * 0.045));
        dot.style.transform = toTransform(pointOn(xy, back));
        dot.style.opacity = resting || k >= 1 || k <= 0 ? "0" : String(0.5 - i * 0.14);
      });
      if (lastHop.current !== step) {
        lastHop.current = step;
        for (const id of STORY_EDGES) {
          const wire = hot.current[id];
          if (wire) wire.style.opacity = id === hop.edge ? "1" : "0";
        }
      }
      if (resting) {
        const wire = hot.current[hop.edge];
        if (wire) wire.style.opacity = "0";
        lastHop.current = -1;
      }
    },
    [],
  );

  useEffect(() => {
    samples.current = sampleEdges(mode);
    drawAmbient(0, reduced);
    if (clock) {
      if (reduced) drawStory(clock.step, 1, false);
      else {
        const at = storyAt(clock.ms);
        drawStory(at.step, at.k, at.resting);
      }
    }
  }, [mode, reduced, clock, drawAmbient, drawStory]);

  // A still map has no loop, so a seek draws straight away. The log's listener fires on every seek.
  useEffect(() => {
    if (!clock) return;
    const listener = (step: number) => {
      if (seenSeeks.current !== clock.seeks) {
        seenSeeks.current = clock.seeks;
        flashed.current = -1;
        drawStory(step, reduced ? 1 : 0, false);
        if (reduced) flash(STORY_STEPS[step].receiver);
      }
    };
    clock.listeners.add(listener);
    return () => {
      clock.listeners.delete(listener);
    };
  }, [clock, reduced, drawStory, flash]);

  useVisibleLoop(
    root,
    (delta) => {
      elapsed.current += delta;
      drawAmbient(elapsed.current, false);
      if (!clock) return;
      const at = advanceClock(clock, delta);
      drawStory(at.step, at.k, at.resting);
      if (at.k >= 1 && !at.resting && flashed.current !== at.step) {
        flashed.current = at.step;
        flash(STORY_STEPS[at.step].receiver);
      }
      if (at.k < 1 && flashed.current === at.step) flashed.current = -1;
    },
    { enabled: !reduced },
  );

  const story = clock ? (
    <>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          ref={(el) => {
            trail.current[i] = el;
          }}
          className="lp-trail"
          r={mode !== "phone" ? 5 - i : 4 - i * 0.8}
        />
      ))}
      <g ref={star} className="lp-star" data-star="story">
        <circle className="lp-star-halo" r={mode !== "phone" ? 15 : 12} />
        <circle r={mode !== "phone" ? 7 : 6} />
      </g>
    </>
  ) : null;

  const packets = (
    <>
      {clock
        ? STORY_EDGES.map((id) => (
            <path
              key={id}
              ref={(el) => {
                hot.current[id] = el;
              }}
              className="lp-hot"
              data-hot={id}
              d={paths[id]}
            />
          ))
        : null}
      {EDGES.map((e, i) => e.state ? null : (
        <circle
          key={e.id}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="lp-pk"
          data-packet={e.id}
          data-slow={e.slow || undefined}
          data-period={ambientPeriod(i, e.slow)}
          r={mode !== "phone" ? 4 : 3.4}
        />
      ))}
      {mode !== "phone" ? null : story}
    </>
  );

  return (
    <div ref={root} className={className}>
      <MapCanvas mode={mode} labels={labels} animated={!reduced} onNode={onNode} viewBox={viewBox} packets={packets} ariaLabel={ariaLabel} />
      {/* Wide only: the App to Database wire is nearly all label, so under the labels the story packet would vanish. The words go back on top of it, or a bright packet would pass over white text. The phone map has no labels. */}
      {mode !== "phone" && story ? (
        <svg className="lp-story" viewBox={viewBox ?? VIEWBOX[mode]} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {story}
          {labels === false ? null : <WireWords mode={mode} />}
        </svg>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { landing } from "@/i18n/dict/landing";
import { STORY_ORDER } from "@/lib/brand";
import { orderHref } from "@/lib/routes";
import { STATIONS } from "@/map/data";
import { STATION_STEP, STORY_STEPS, logTime, logWindow, seekClock, stationIndexOfStep, type StoryClock } from "@/map/packets";
import { useStore } from "@/store/core";
import { ProductArt } from "@/ui";
import { Track } from "@/ui/Track";

type LogEl = HTMLDivElement & { seek?: (step: number) => void };

/** `One order, live`: the order row, the six-station rail and the last four log lines. */
export function StoryPanel({ clock, className }: { clock: StoryClock; className?: string }) {
  const t = useT(landing);
  const lang = useLang();
  const orders = useStore((s) => s.orders);
  const order = useMemo(() => orders.find((o) => o.orderNumber === STORY_ORDER), [orders]);
  const [view, setView] = useState({ step: clock.step, loops: clock.loops });
  const log = useRef<LogEl>(null);
  const rail = useRef<HTMLOListElement>(null);
  const scrubbing = useRef(false);

  useEffect(() => {
    const listener = (step: number) => setView({ step, loops: clock.loops });
    clock.listeners.add(listener);
    const el = log.current;
    if (el) el.seek = (step: number) => seekClock(clock, step);
    return () => {
      clock.listeners.delete(listener);
      if (el) delete el.seek;
    };
  }, [clock]);

  const activeStation = stationIndexOfStep(view.step);
  const lines = logWindow(view.step);
  const item = order?.items[0];

  const pick = (e: PointerEvent<HTMLOListElement>) => {
    const buttons = rail.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons) return;
    let best = 0;
    let bestDist = Infinity;
    buttons.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - e.clientX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== activeStation) seekClock(clock, STATION_STEP[STATIONS[best].id]);
  };

  return (
    <aside className={`lp-panel ${className ?? ""}`} aria-label={t.orderTitle}>
      <header className="lp-panel-head">
        <h2>{t.orderTitle}</h2>
        <span className="lp-panel-id">
          <i aria-hidden="true" />
          {STORY_ORDER}
        </span>
      </header>
      <Link className="lp-order" href={orderHref(STORY_ORDER)} aria-label={fmt(t.orderLink, { id: STORY_ORDER })}>
        {item ? (
          <span className="lp-order-glyph">
            <ProductArt type={item.art} tone={item.tone} view="mini" />
          </span>
        ) : null}
        <span className="lp-order-no">{STORY_ORDER}</span>
        {order ? <Track status={order.status} /> : null}
      </Link>
      <ol
        ref={rail}
        className="lp-rail-stations"
        aria-label={t.stationsAria}
        onPointerDown={(e) => {
          scrubbing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (scrubbing.current) pick(e);
        }}
        onPointerUp={() => {
          scrubbing.current = false;
        }}
        onPointerCancel={() => {
          scrubbing.current = false;
        }}
      >
        {STATIONS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="lp-station"
              data-state={i === activeStation ? "now" : i < activeStation ? "done" : "next"}
              aria-current={i === activeStation ? "step" : undefined}
              onClick={() => seekClock(clock, STATION_STEP[s.id])}
            >
              <span className="lp-station-dot" aria-hidden="true" />
              {lang === "de" ? s.de : s.en}
            </button>
          </li>
        ))}
      </ol>
      <div ref={log} className="lp-log" data-story-step={view.step} aria-label={t.logAria} role="group">
        <ol>
          {lines.map(({ step, loopsBack }) => {
            const hop = STORY_STEPS[step];
            return (
              <li key={`${view.loops - loopsBack}-${step}`}>
                <time>{logTime(step, loopsBack, view.loops)}</time>
                <span>{lang === "de" ? hop.de : hop.en}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

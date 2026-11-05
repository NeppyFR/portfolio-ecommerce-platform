"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { axisLabel, labelledIndexes, monotonePath, revenueAxis } from "./dashboard-rules";

export type ChartPoint = { key: string; axis: string; tip: string; value: number; money: string };

type Props = {
  points: ChartPoint[];
  /** Changes when the period changes, so the drawing fades in once. */
  series: string;
  caption: string;
  emptyText: string;
  headLabel: string;
  headValue: string;
};

const HEIGHT = 196;
const HEIGHT_WIDE = 218;
const WIDE_FROM = 720;
const M = { top: 12, right: 10, bottom: 28, left: 42 };
const LABEL_ROOM = 52;
const TIP_GAP = 14;
/** How far the tooltip may rise above the plot before it would touch the period buttons. */
const TIP_CEILING = -32;

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        setWidth(Math.round(w));
        setMeasured(true);
      }
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width, measured };
}

/** Hand-drawn area chart. It rests on the newest point; hover, touch or the arrow keys move the tooltip. */
export function RevenueChart({ points, series, caption, emptyText, headLabel, headValue }: Props) {
  const { ref, width, measured } = useWidth(640);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipWidth, setTipWidth] = useState(124);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const height = width >= WIDE_FROM ? HEIGHT_WIDE : HEIGHT;
  const plotW = Math.max(40, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const base = M.top + plotH;
  const count = points.length;
  const highest = points.reduce((most, p) => Math.max(most, p.value), 0);
  const axis = useMemo(() => revenueAxis(highest), [highest]);
  const xy = useMemo(
    () => points.map((p, i) => ({ x: M.left + (count === 1 ? plotW : (i / (count - 1)) * plotW), y: base - (p.value / axis.top) * plotH })),
    [points, count, plotW, plotH, base, axis.top],
  );
  const line = useMemo(() => monotonePath(xy), [xy]);
  const area = count > 0 ? `${line}L${xy[count - 1].x},${base}L${xy[0].x},${base}Z` : "";
  const shown = useMemo(() => labelledIndexes(count, plotW / LABEL_ROOM), [count, plotW]);

  const found = hoverKey === null ? -1 : points.findIndex((p) => p.key === hoverKey);
  const active = found >= 0 ? found : count - 1;
  const resting = found < 0;
  const point = points[active];
  const at = xy[active];

  useEffect(() => {
    const w = tipRef.current?.offsetWidth;
    if (w) setTipWidth(w);
  }, [point?.tip, point?.money, measured]);

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left - M.left) / plotW;
    const index = Math.min(count - 1, Math.max(0, Math.round(share * (count - 1))));
    setHoverKey(points[index].key);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setHoverKey(points[event.key === "Home" ? 0 : count - 1].key);
    } else if (step !== 0) {
      event.preventDefault();
      setHoverKey(points[Math.min(count - 1, Math.max(0, active + step))].key);
    }
  };

  const half = tipWidth / 2;
  const tipX = at ? Math.min(width - half, Math.max(half, at.x)) : 0;
  // It floats above the curve across its whole width, so it never hides a peak beside the active point.
  const under = xy.filter((p) => Math.abs(p.x - tipX) <= half + 6).reduce((top, p) => Math.min(top, p.y), at ? at.y : 0);
  const tipY = Math.max(TIP_CEILING + 58, under - TIP_GAP);

  return (
    <div ref={ref} className="db-chart" tabIndex={0} role="group" aria-label={caption} onPointerMove={pick} onPointerLeave={() => setHoverKey(null)} onBlur={() => setHoverKey(null)} onKeyDown={onKey}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="db-chart-svg">
        <defs>
          <linearGradient id={`${uid}a`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={M.top} y2={base}>
            <stop offset="0" stopColor="#6fd3ff" stopOpacity=".42" />
            <stop offset=".5" stopColor="#2f6bff" stopOpacity=".26" />
            <stop offset="1" stopColor="#8c7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}l`} gradientUnits="userSpaceOnUse" x1={M.left} x2={M.left + plotW} y1="0" y2="0">
            <stop offset="0" stopColor="#6fd3ff" />
            <stop offset=".55" stopColor="#2f6bff" />
            <stop offset="1" stopColor="#8c7bff" />
          </linearGradient>
        </defs>
        {axis.ticks.map((tick) => {
          const y = base - (tick / axis.top) * plotH;
          return (
            <g key={tick}>
              <line x1={M.left} x2={M.left + plotW} y1={y} y2={y} className="db-grid" />
              <text x={M.left - 12} y={y + 4} textAnchor="end" className="db-axis">
                {axisLabel(tick)}
              </text>
            </g>
          );
        })}
        {shown.map((i) => {
          const anchor = i === 0 ? "start" : i === count - 1 ? "end" : "middle";
          return (
            <text key={points[i].key} x={xy[i].x} y={height - 6} textAnchor={anchor} className="db-axis">
              {points[i].axis}
            </text>
          );
        })}
        <g key={series} className="db-chart-draw">
          <path d={area} fill={`url(#${uid}a)`} />
          <path d={line} fill="none" stroke={`url(#${uid}l)`} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {at ? (
          <>
            {resting ? null : <line x1={at.x} x2={at.x} y1={at.y} y2={base} className="db-guide" />}
            <circle cx={at.x} cy={at.y} r="5.5" className="db-dot" />
          </>
        ) : null}
      </svg>
      {highest === 0 ? <p className="db-chart-empty type-small">{emptyText}</p> : null}
      {measured && point && at && highest > 0 ? (
        <div ref={tipRef} className="db-tip" style={{ transform: `translate(${tipX}px,${tipY}px) translate(-50%,-100%)` }}>
          <span className="db-tip-when">{point.tip}</span>
          <span className="db-tip-value">{point.money}</span>
        </div>
      ) : null}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{headLabel}</th>
              <th scope="col">{headValue}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{p.tip}</td>
                <td>{p.money}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatChf } from "@/lib/format";
import { roundToFranc, type Slice } from "./dashboard-rules";

type NamedSlice = Slice & { name: string };

type Props = {
  slices: NamedSlice[];
  totalRappen: number;
  caption: string;
  emptyText: string;
  note: string;
  headName: string;
  headShare: string;
  headSales: string;
};

/** Flat palette fills by rank, biggest slice strongest. The same colours fill the legend squares, so a slice and its name match exactly. */
const FILLS = ["#2f6bff", "#8c7bff", "#6fd3ff", "#b9f3ff"];

const SIZE = 184;
const CENTER = SIZE / 2;
const OUTER = 91;
const INNER = 67;
const GAP = 0.018;

function point(radius: number, angle: number): string {
  return `${(CENTER + radius * Math.sin(angle)).toFixed(3)},${(CENTER - radius * Math.cos(angle)).toFixed(3)}`;
}

/** One ring piece, clockwise from the top. */
function sector(from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  return `M${point(OUTER, from)}A${OUTER},${OUTER} 0 ${large} 1 ${point(OUTER, to)}L${point(INNER, to)}A${INNER},${INNER} 0 ${large} 0 ${point(INNER, from)}Z`;
}

export function CollectionDonut({ slices, totalRappen, caption, emptyText, note, headName, headShare, headSales }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const sum = slices.reduce((all, s) => all + s.salesRappen, 0);
  const active = slices.find((s) => s.key === activeKey) ?? null;
  const centerValue = formatChf(roundToFranc(active ? active.salesRappen : totalRappen), { symbol: false }).replace(/\.00$/, "");

  let cursor = 0;
  const arcs = slices.map((slice, i) => {
    const span = sum > 0 ? (slice.salesRappen / sum) * Math.PI * 2 : 0;
    const from = cursor;
    cursor += span;
    const lone = slices.length === 1;
    return { slice, i, d: sector(from + (lone ? 0 : GAP), from + span - (lone ? 0.0001 : GAP)) };
  });

  return (
    <div className="db-donut">
      <div className="db-donut-ring">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {sum === 0 ? <circle cx={CENTER} cy={CENTER} r={(OUTER + INNER) / 2} fill="none" stroke="var(--mist-2)" strokeWidth={OUTER - INNER} /> : null}
          {arcs.map(({ slice, i, d }) => (
            <path key={slice.key} d={d} fill={FILLS[i % FILLS.length]} className="db-slice" data-dim={activeKey !== null && activeKey !== slice.key ? "" : undefined} onPointerEnter={() => setActiveKey(slice.key)} onPointerLeave={() => setActiveKey(null)} />
          ))}
        </svg>
        <div className="db-donut-center">
          <span className="db-donut-value">{centerValue}</span>
          <span className="db-donut-unit">CHF</span>
        </div>
      </div>
      <div className="db-legend-wrap">
        {slices.length === 0 ? (
          <p className="type-small db-muted">{emptyText}</p>
        ) : (
          <ul className="db-legend">
            {slices.map((slice, i) => {
              return (
                <li key={slice.key} onPointerEnter={() => setActiveKey(slice.key)} onPointerLeave={() => setActiveKey(null)}>
                  <span className="db-swatch" style={{ background: FILLS[i % FILLS.length] }} aria-hidden="true" />
                  <span className="db-legend-name">{slice.name}</span>
                  <span className="db-legend-share">{slice.percent}%</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="db-note">{note}</p>
      </div>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{headName}</th>
              <th scope="col">{headSales}</th>
              <th scope="col">{headShare}</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.key}>
                <td>{slice.name}</td>
                <td>{formatChf(slice.salesRappen)}</td>
                <td>{slice.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

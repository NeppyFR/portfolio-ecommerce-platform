"use client";

import { useState, type CSSProperties } from "react";
import { labelEvery, niceTicks } from "./rules";

export type ColumnDatum = {
  key: string;
  label: string;
  value: number;
  /** Tooltip: a small line, the main value, an optional note. */
  tipTitle: string;
  tipValue: string;
  tipNote?: string;
  /** One cell per entry of `columns`, for the hidden table. */
  cells: string[];
};

const LABELS_DESKTOP = 14;
const LABELS_PHONE = 7;

/**
 * Vertical columns with a y axis and a floating value card. It sizes itself with CSS, so the server and the
 * browser render the same thing, and it never draws a bar wider than the card can carry calmly.
 */
export function ColumnChart({ data, caption, columns, height = 220, formatValue = String }: { data: ColumnDatum[]; caption: string; columns: string[]; height?: number; formatValue?: (value: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const largest = max > 0 ? data.find((d) => d.value === max)?.key : undefined;
  const every = labelEvery(data.length, LABELS_DESKTOP);
  const everyPhone = labelEvery(data.length, LABELS_PHONE);
  return (
    <div>
      <div className="cat-cols" style={{ "--h": `${height}px` } as CSSProperties} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        <div className="cat-cols-y">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              {formatValue(tick)}
            </span>
          ))}
        </div>
        <div className="cat-cols-plot">
          {ticks.slice(1).map((tick) => (
            <i key={tick} className="cat-cols-grid" style={{ bottom: `${(tick / top) * 100}%` }} />
          ))}
          {data.map((d, i) => {
            const active = d.key === hover;
            const edge = i < data.length * 0.2 ? "start" : i >= data.length * 0.8 ? "end" : undefined;
            const pct = (d.value / top) * 100;
            return (
              <div key={d.key} className="cat-cols-col" data-active={active || undefined} data-edge={edge} onMouseEnter={() => setHover(d.key)} onClick={() => setHover(active ? null : d.key)}>
                <span className="cat-cols-bar" style={{ height: d.value > 0 ? `max(2px, ${pct}%)` : 0 }}>
                  {!hover && d.key === largest ? <span className="cat-cols-top">{formatValue(d.value)}</span> : null}
                </span>
                {active ? (
                  <span className="cat-cols-tip" style={{ bottom: `${pct}%` }}>
                    <small>{d.tipTitle}</small>
                    <b>{d.tipValue}</b>
                    {d.tipNote ? <small>{d.tipNote}</small> : null}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="cat-cols-x">
          {data.map((d, i) => (
            <span key={d.key} data-hide={i % every !== 0 ? "all" : i % everyPhone !== 0 ? "phone" : undefined}>
              {d.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              {d.cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

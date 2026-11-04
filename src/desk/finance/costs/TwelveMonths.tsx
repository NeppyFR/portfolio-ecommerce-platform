"use client";

import { useMemo } from "react";
import { DEMO_MONTH } from "@/store/clock";
import { fmt, useLang, useT, type Lang } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { formatChf } from "@/lib/format";
import { useStore } from "@/store/core";
import { columnHead } from "../rules/report";
import { lastTwelve } from "../rules/planner";

const short = (month: string, lang: Lang) => `${columnHead(month, lang)} ${month.slice(2, 4)}`;

/** A table from 1100 px up. Below that, one card per cost with twelve small bars, never a sideways-scrolling table. */
export function TwelveMonths({ selected }: { selected: string }) {
  const { costs: t } = useT(finance);
  const lang = useLang();
  const costs = useStore((s) => s.costs);
  const bookings = useStore((s) => s.costBookings);
  const grid = useMemo(() => lastTwelve(costs, bookings, DEMO_MONTH), [costs, bookings]);
  const peak = Math.max(1, ...grid.rows.flatMap((r) => r.cells.map((c) => c ?? 0)));

  return (
    <section className="fin-panel fin-sec">
      <h2 className="fin-h3">{t.last12}</h2>
      <div className="fin-12 mt-2">
        <table>
          <caption className="sr-only">{t.last12}</caption>
          <thead>
            <tr>
              <th scope="col">{t.service}</th>
              {grid.months.map((month) => (
                <th key={month} scope="col" data-sel={month === selected || undefined}>
                  {short(month, lang)}
                </th>
              ))}
              <th scope="col">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.cost.id}>
                <td>{row.cost.label}</td>
                {row.cells.map((cell, i) => (
                  <td key={grid.months[i]} data-sel={grid.months[i] === selected || undefined}>
                    {cell === null ? <span className="fin-faint">–</span> : formatChf(cell, { symbol: false })}
                  </td>
                ))}
                <td>{formatChf(row.total, { symbol: false })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t.total}</td>
              {grid.totals.map((total, i) => (
                <td key={grid.months[i]} data-sel={grid.months[i] === selected || undefined}>
                  {formatChf(total, { symbol: false })}
                </td>
              ))}
              <td>{formatChf(grid.total, { symbol: false })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="fin-12-cards">
        {grid.rows.map((row) => (
          <li key={row.cost.id}>
            <div className="fin-between">
              <b className="type-label">{row.cost.label}</b>
              <span className="type-mono">{fmt(t.twelveTotal, { amount: formatChf(row.total) })}</span>
            </div>
            <div className="fin-12-bars" aria-hidden="true">
              {row.cells.map((cell, i) => (
                <i key={grid.months[i]} data-none={cell === null || cell === 0 || undefined} style={cell ? { transform: `scaleY(${Math.max(0.08, cell / peak)})` } : undefined} />
              ))}
            </div>
          </li>
        ))}
        <li>
          <div className="fin-between">
            <b className="type-label">{t.total}</b>
            <span className="type-mono">{formatChf(grid.total)}</span>
          </div>
        </li>
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";

function SrTable({ caption, rows }: { caption: string; rows: { key: string; label: string; value: string }[] }) {
  const t = useT(common);
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.chartLabel}</th>
            <th scope="col">{t.chartValue}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

const LABEL_AREA = 20;
const TOP = 20;

export type BarDatum = { key: string; label: string; value: number; active?: boolean };
export type BarsProps = { data: BarDatum[]; caption: string; formatValue?: (value: number) => string; className?: string; height?: number };

/** Vertical bars on a baseline. The largest carries its value; the rest show it on hover. */
export function Bars({ data, caption, formatValue = String, className, height = 160 }: BarsProps) {
  const { ref, width } = useWidth<HTMLDivElement>(480);
  const [hover, setHover] = useState<string | null>(null);
  const gradient = `bars${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const gap = Math.min(8, (width / n) * 0.3);
  const bar = Math.max(2, (width - gap * (n - 1)) / n);
  const plot = height - LABEL_AREA - TOP;
  const every = Math.max(1, Math.ceil(44 / (bar + gap)));
  const largest = data.reduce<string | null>((best, d) => (best === null || d.value > (data.find((x) => x.key === best)?.value ?? 0) ? d.key : best), null);
  const bars = data.map((d, i) => {
    const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * plot);
    return { d, x: i * (bar + gap), y: TOP + plot - h, h, r: Math.min(4, bar / 2, h) };
  });
  return (
    <div ref={ref} className={`ui-bars ${className ?? ""}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6fd3ff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
        <line x1="0" x2={width} y1={TOP + plot + 0.5} y2={TOP + plot + 0.5} stroke="var(--line-2)" />
        {bars.map(({ d, x, y, h, r }, i) => {
          const showValue = d.key === hover || (hover === null && d.key === largest);
          const anchor = x + bar / 2 < 30 ? "start" : x + bar / 2 > width - 30 ? "end" : "middle";
          const tx = anchor === "start" ? x : anchor === "end" ? x + bar : x + bar / 2;
          return (
            <g key={d.key} onMouseEnter={() => setHover(d.key)}>
              <rect x={x} y={0} width={bar + gap} height={height} fill="transparent" />
              {h > 0 ? <path d={`M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bar - r}Q${x + bar} ${y} ${x + bar} ${y + r}V${y + h}Z`} fill={d.active ? "var(--ink)" : `url(#${gradient})`} /> : null}
              {showValue ? (
                <text className="ui-chart-value" x={tx} y={Math.max(13, y - 6)} textAnchor={anchor}>
                  {formatValue(d.value)}
                </text>
              ) : null}
              {i % every === 0 ? (
                <text className="ui-chart-axis" x={x + bar / 2} y={height - 5} textAnchor={i === 0 ? "start" : "middle"} dx={i === 0 ? -bar / 2 : 0}>
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <SrTable caption={caption} rows={data.map((d) => ({ key: d.key, label: d.label, value: formatValue(d.value) }))} />
    </div>
  );
}

export type BarListDatum = { key: string; label: string; value: number; display?: string };
export type BarListProps = { data: BarListDatum[]; caption: string; className?: string };

/** Label, value, then a track that fills in blue. */
export function BarList({ data, caption, className }: BarListProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`ui-barlist ${className ?? ""}`}>
      <ul aria-hidden="true">
        {data.map((d) => (
          <li key={d.key}>
            <span className="type-small ui-barlist-label">{d.label}</span>
            <span className="type-mono-s">{d.display ?? d.value}</span>
            <svg className="ui-barlist-track" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
              <rect width="100" height="6" fill="var(--mist-2)" />
              <rect width={(d.value / max) * 100} height="6" fill="var(--blue)" />
            </svg>
          </li>
        ))}
      </ul>
      <SrTable caption={caption} rows={data.map((d) => ({ key: d.key, label: d.label, value: d.display ?? String(d.value) }))} />
    </div>
  );
}

export type SparkProps = { values: number[]; caption: string; className?: string };

/** 56×22, one 1.5 px line. */
export function Spark({ values, caption, className }: SparkProps) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? 54 / (values.length - 1) : 0;
  const points = values.map((v, i) => `${(1 + i * step).toFixed(1)},${(20 - ((v - min) / span) * 18).toFixed(1)}`).join(" ");
  return (
    <span className={`ui-spark ${className ?? ""}`}>
      <svg viewBox="0 0 56 22" width={56} height={22} aria-hidden="true">
        <polyline points={points} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <SrTable caption={caption} rows={values.map((v, i) => ({ key: String(i), label: String(i + 1), value: String(v) }))} />
    </span>
  );
}

export type DeltaProps = {
  percent: number | null;
  /** No good or bad reading, used for discounts. */
  neutral?: boolean;
  /** Rising is the bad direction, used for refunds: rose, with an icon and the word. */
  invert?: boolean;
  className?: string;
};

export function Delta({ percent, neutral, invert, className }: DeltaProps) {
  const t = useT(common);
  if (percent === null) return <span className={`ui-delta type-mono-s ${className ?? ""}`}>{t.noPrior}</span>;
  const flat = percent === 0;
  const Icon = flat ? Minus : percent > 0 ? ArrowUp : ArrowDown;
  const bad = Boolean(invert && percent > 0);
  const tone = neutral || flat ? "neutral" : bad ? "bad" : percent > 0 ? "up" : "down";
  return (
    <span className={`ui-delta type-mono-s ${className ?? ""}`} data-tone={tone}>
      <Icon size={13} aria-hidden="true" />
      <span>{`${percent > 0 ? "+" : percent < 0 ? "−" : ""}${Math.abs(percent)}%`}</span>
      {bad ? <span>{t.rising}</span> : null}
    </span>
  );
}

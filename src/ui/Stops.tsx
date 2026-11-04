"use client";

import { TriangleAlert } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import type { OrderStop } from "@/store/types";

export type StopsProps = { active: OrderStop | null; counts: Partial<Record<OrderStop, number>>; onChange: (stop: OrderStop | null) => void; labels?: Record<OrderStop, string>; className?: string };

export const FLOW_STOPS: OrderStop[] = ["pending", "paid", "packed", "shipped", "delivered"];
export const EXIT_STOPS: OrderStop[] = ["cancelled", "refunded", "attention"];

/** The lifecycle, replacing filter tabs on Orders: pills on a line with counts. Scrolls sideways in its own row. */
export function Stops({ active, counts, onChange, labels, className }: StopsProps) {
  const t = useT(common);
  const names = labels ?? t.status;
  const pill = (s: OrderStop) => (
    <button key={s} type="button" className="ui-stop" data-stop={s} aria-pressed={s === active} onClick={() => onChange(s === active ? null : s)}>
      {s === "attention" ? <TriangleAlert size={14} aria-hidden="true" /> : null}
      <span>{names[s]}</span>
      <span className="ui-stop-count type-mono-s" key={counts[s] ?? 0}>
        {counts[s] ?? 0}
      </span>
    </button>
  );
  return (
    <div className={`ui-stops ${className ?? ""}`} role="group" aria-label={t.orderStops}>
      <div className="ui-stops-flow">{FLOW_STOPS.map(pill)}</div>
      <div className="ui-stops-exits">{EXIT_STOPS.map(pill)}</div>
    </div>
  );
}

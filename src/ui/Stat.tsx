"use client";

import type { ReactNode } from "react";

export type StatProps = { label: ReactNode; value: ReactNode; delta?: ReactNode; aside?: ReactNode; className?: string };

/** Hairline separated when placed side by side in `.ui-stats`, never boxed. */
export function Stat({ label, value, delta, aside, className }: StatProps) {
  return (
    <div className={`ui-stat ${className ?? ""}`}>
      <div className="type-small ui-stat-label">{label}</div>
      <div className="type-stat">{value}</div>
      {delta ? <div className="ui-stat-delta">{delta}</div> : null}
      {aside ? <div className="type-small ui-stat-aside">{aside}</div> : null}
    </div>
  );
}

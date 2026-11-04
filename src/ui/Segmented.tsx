"use client";

import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; disabled?: boolean };
export type SegmentedProps<T extends string> = { options: SegmentedOption<T>[]; value: T | null; onChange: (value: T) => void; "aria-label": string; className?: string };

/** Joined row. A disabled cell is hatched with a slash, which is how a sold-out size reads. */
export function Segmented<T extends string>({ options, value, onChange, className, "aria-label": ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={`ui-seg ${className ?? ""}`}>
      {options.map((o) => (
        <button key={o.value} type="button" className="ui-seg-cell" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

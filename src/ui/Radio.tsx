"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

export function Radio({ label, className, ...rest }: RadioProps) {
  return (
    <label className={`ui-check ${className ?? ""}`}>
      <input type="radio" className="ui-radio" {...rest} />
      {label ? <span className="ui-check-label">{label}</span> : null}
    </label>
  );
}

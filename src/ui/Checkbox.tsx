"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={`ui-check ${className ?? ""}`}>
      <input type="checkbox" className="ui-checkbox" {...rest} />
      {label ? <span className="ui-check-label">{label}</span> : null}
    </label>
  );
}

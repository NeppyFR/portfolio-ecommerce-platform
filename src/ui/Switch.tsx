"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

export function Switch({ label, className, ...rest }: SwitchProps) {
  return (
    <label className={`ui-check ${className ?? ""}`}>
      <input type="checkbox" role="switch" className="ui-switch" {...rest} />
      {label ? <span className="ui-check-label">{label}</span> : null}
    </label>
  );
}

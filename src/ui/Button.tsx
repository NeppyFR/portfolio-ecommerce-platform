"use client";

import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

export type ButtonVariant = "solid" | "outline" | "ghost" | "danger";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean };

/** Height 36, 44 on a phone. `busy` keeps the width by hiding the label under a spinner. */
export function Button({ variant = "solid", busy = false, type = "button", children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button type={type} className={`ui-btn ui-btn-${variant} ${className ?? ""}`} data-variant={variant} data-busy={busy || undefined} aria-busy={busy || undefined} disabled={disabled || busy} {...rest}>
      <span className="ui-btn-label">{children}</span>
      {busy ? <LoaderCircle className="ui-btn-spin" size={16} aria-hidden="true" /> : null}
    </button>
  );
}

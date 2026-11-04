"use client";

import type { ButtonHTMLAttributes } from "react";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string };

export function IconButton({ type = "button", children, className, title, ...rest }: IconButtonProps) {
  return (
    <button type={type} className={`ui-iconbtn ${className ?? ""}`} title={title ?? rest["aria-label"]} {...rest}>
      {children}
    </button>
  );
}

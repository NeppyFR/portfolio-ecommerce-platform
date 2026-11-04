"use client";

import { Check, CircleHelp, Minus, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "@/store/types";

export type StatusProps = { tone: Tone; children: ReactNode; className?: string };

const ICONS: Record<Tone, LucideIcon> = { ok: Check, warn: TriangleAlert, bad: OctagonAlert, unknown: CircleHelp, off: Minus };

/** Icon plus word, always. No state is carried by colour alone. */
export function Status({ tone, children, className }: StatusProps) {
  const Icon = ICONS[tone];
  return (
    <span className={`ui-status ${className ?? ""}`} data-tone={tone}>
      <Icon size={14} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

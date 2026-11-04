"use client";

import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/ui";

export type StepperProps = { value: number; max: number; min?: number; onChange: (value: number) => void; lessLabel: string; moreLabel: string };

export function Stepper({ value, max, min = 0, onChange, lessLabel, moreLabel }: StepperProps) {
  return (
    <span className="or-stepper">
      <IconButton aria-label={lessLabel} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={16} aria-hidden="true" />
      </IconButton>
      <span className="type-mono or-stepper-value" aria-live="polite">
        {value}
      </span>
      <IconButton aria-label={moreLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={16} aria-hidden="true" />
      </IconButton>
    </span>
  );
}

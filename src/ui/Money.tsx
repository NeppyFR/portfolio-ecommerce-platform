"use client";

import { TriangleAlert } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { formatMinor } from "@/lib/format";

export type MoneyProps = {
  value: number;
  currency?: string;
  /** Shows `+` in link blue for gains and U+2212 in ink for losses. */
  signed?: boolean;
  /** A running balance: below zero turns rose with an icon and the word. */
  balance?: boolean;
  className?: string;
};

export function Money({ value, currency = "CHF", signed = false, balance = false, className }: MoneyProps) {
  const t = useT(common);
  const low = balance && value < 0;
  const sign = signed && value > 0 ? "+" : "";
  return (
    <span className={`ui-money type-mono ${className ?? ""}`} data-signed={signed && value !== 0 ? (value > 0 ? "up" : "down") : undefined} data-low={low || undefined}>
      {low ? <TriangleAlert size={14} aria-hidden="true" /> : null}
      <span>
        {sign}
        {formatMinor(value, currency)}
      </span>
      {low ? <span className="type-mono-s">{t.belowZero}</span> : null}
    </span>
  );
}

"use client";

import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import type { OrderStatus as Value } from "@/store/types";

export type OrderStatusProps = { status: Value; label?: string; className?: string };

/** A dot plus the word, so the state never rests on colour alone. */
export function OrderStatus({ status, label, className }: OrderStatusProps) {
  const t = useT(common);
  return (
    <span className={`ui-orderstatus ${className ?? ""}`} data-status={status}>
      <span className="ui-orderstatus-dot" aria-hidden="true" />
      <span>{label ?? t.status[status]}</span>
    </span>
  );
}

"use client";

import { TriangleAlert } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import type { OrderStatus } from "@/store/types";

export type TrackProps = { status: OrderStatus; attention?: boolean; attentionLabel?: string; className?: string };

const REACHED: Record<OrderStatus, number> = { pending: 1, paid: 2, packed: 3, shipped: 4, delivered: 5, cancelled: 0, refunded: 0 };

/** Five dots joined by a hairline, filled up to the status. Cancelled and refunded fill none and say so. */
export function Track({ status, attention, attentionLabel, className }: TrackProps) {
  const t = useT(common);
  const reached = REACHED[status];
  const word = attentionLabel ?? t.status.attention;
  return (
    <span className={`ui-track ${className ?? ""}`} data-status={status} role="img" aria-label={`${t.orderProgress}: ${t.status[status]}${attention ? `, ${word}` : ""}`}>
      <span className="ui-track-dots" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="ui-track-dot" data-on={n <= reached || undefined} />
        ))}
      </span>
      {reached === 0 ? <span className="ui-track-word type-mono-s">{t.status[status]}</span> : null}
      {attention ? (
        <span className="ui-track-attention">
          <TriangleAlert size={14} aria-hidden="true" />
          <span className="type-mono-s">{word}</span>
        </span>
      ) : null}
    </span>
  );
}

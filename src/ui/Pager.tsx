"use client";

import { useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmt, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";

export type PagerProps = { page: number; pages: number; onPage: (page: number) => void; labels?: { page: string; previous: string; next: string }; className?: string };

export const PAGE_SIZE_DESKTOP = 50;
export const PAGE_SIZE_PHONE = 25;

const PHONE = "(max-width: 719px)";
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(PHONE);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

/** 50 rows on a desktop, 25 on a phone. */
export function usePageSize(): number {
  const phone = useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
  return phone ? PAGE_SIZE_PHONE : PAGE_SIZE_DESKTOP;
}

export function Pager({ page, pages, onPage, labels, className }: PagerProps) {
  const t = useT(common);
  const text = labels ?? { page: t.page, previous: t.previous, next: t.next };
  return (
    <nav className={`ui-pager ${className ?? ""}`} aria-label={t.pages}>
      <button type="button" className="ui-btn ui-btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
        <span className="ui-btn-label">{text.previous}</span>
      </button>
      <span className="type-mono-s">{fmt(text.page, { p: page, n: pages })}</span>
      <button type="button" className="ui-btn ui-btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <span className="ui-btn-label">{text.next}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

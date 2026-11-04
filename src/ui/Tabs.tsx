"use client";

import Link from "next/link";
import { Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TabItem = { id: string; label: ReactNode; href?: string; icon?: LucideIcon; locked?: boolean; title?: string };
export type TabsProps = { items: TabItem[]; active: string; onChange?: (id: string) => void; "aria-label": string; className?: string };

/** Underline tabs that scroll in their own row. A locked tab is ink-3 text with a Lock icon and no opacity change. */
export function Tabs({ items, active, onChange, className, "aria-label": ariaLabel }: TabsProps) {
  return (
    <nav aria-label={ariaLabel} className={`ui-tabs ${className ?? ""}`}>
      {items.map((t) => {
        const inner = (
          <>
            {t.icon ? <t.icon size={14} aria-hidden="true" /> : null}
            <span>{t.label}</span>
            {t.locked ? <Lock size={12} aria-hidden="true" /> : null}
          </>
        );
        return t.href ? (
          <Link key={t.id} href={t.href} className="ui-tab" data-locked={t.locked || undefined} data-active={t.id === active || undefined} aria-current={t.id === active ? "page" : undefined} title={t.title}>
            {inner}
          </Link>
        ) : (
          <button key={t.id} type="button" className="ui-tab" data-locked={t.locked || undefined} data-active={t.id === active || undefined} aria-pressed={t.id === active} title={t.title} onClick={() => onChange?.(t.id)}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}

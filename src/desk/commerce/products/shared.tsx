"use client";

import { ArrowRight, CircleAlert, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Checkbox, ProductArt, Input } from "@/ui";
import { parseChf } from "@/lib/format";
import { setParam } from "@/lib/routes";
import type { ArtTone, ProductArtType, Tone } from "@/store/types";
import "./catalogue.css";

const TILE: Record<ArtTone, string> = { ice: "t-sky", sky: "t-ice", azure: "t-pale", dusk: "t-mist", lilac: "t-ice" };

/** A tile that keeps the drawing readable: pale drawings sit on the sky tile, dark ones on a pale one. */
export const tileFor = (tone: ArtTone): string => TILE[tone];

export function ArtThumb({ type, tone, size, printed, title }: { type: ProductArtType; tone: ArtTone; size?: "s" | "l"; printed?: boolean; title?: string }) {
  return (
    <span className={`cat-thumb ${tileFor(tone)}`} data-size={size}>
      <ProductArt type={type} tone={tone} view="mini" printed={printed} title={title} />
    </span>
  );
}

/** Same look as Status, with an icon that says what the state is. */
export function Pill({ tone, icon: Icon, children }: { tone: Tone | "plan"; icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="ui-status" data-tone={tone}>
      <Icon size={14} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

/** The `?open=` sheet parameter, synced through setParam so memory state and scroll survive. */
export function useOpenParam(key = "open"): [string | null, (value: string | null) => void] {
  const params = useSearchParams();
  return [params.get(key), (value) => setParam(key, value)];
}

export function TabLabel({ label, count }: { label: ReactNode; count: number }) {
  return (
    <span className="cat-tabcount">
      {label}
      <b>{count}</b>
    </span>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="cat-error type-small" role="alert">
      <CircleAlert size={14} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export type CheckItem = { id: string; label: ReactNode };

/** A titled list of checkboxes that toggles ids in and out of `selected`. */
export function CheckList({ legend, items, selected, onChange, empty, inline }: { legend: ReactNode; items: CheckItem[]; selected: string[]; onChange: (next: string[]) => void; empty?: ReactNode; inline?: boolean }) {
  return (
    <fieldset className="cat-fieldset">
      <legend>{legend}</legend>
      {items.length === 0 ? (
        <p className="type-small cat-sub">{empty}</p>
      ) : (
        <div className="cat-checks" data-inline={inline || undefined}>
          {items.map((item) => (
            <Checkbox key={item.id} label={item.label} checked={selected.includes(item.id)} onChange={(e) => onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Empty text becomes null; anything else must be a whole number at or above zero, or it comes back as NaN. */
export function parseWhole(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  return /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

export const emptyToNull = (text: string): string | null => (text.trim() ? text.trim() : null);

/** Controls inside a clickable row must not open the row. */
export function NoRowClick({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={className ?? "cat-actions-cell"} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

/** Empty text becomes null; a real amount becomes Rappen; anything else comes back as NaN, so the form can name the field. */
export function parseAmount(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  return parseChf(clean) ?? Number.NaN;
}

/** Amount fields keep what was typed, so a wrong entry is named instead of silently read as empty. */
export function AmountField({ label, hint, error, text, onText, placeholder, currency = "CHF" }: { label: ReactNode; hint?: ReactNode; error?: string | null; text: string; onText: (next: string) => void; placeholder?: string; currency?: string }) {
  return (
    <div className="ui-money-input" data-currency={currency}>
      <Input label={label} hint={hint} error={error} inputMode="decimal" placeholder={placeholder} value={text} onChange={(e) => onText(e.target.value)} />
    </div>
  );
}

/** Text form of an amount, for filling a field. */
export const amountText = (minor: number | null): string => (minor === null ? "" : (minor / 100).toFixed(2));

/** The search box of a list's tools: icon inside, label kept for screen readers. */
export function SearchField({ label, placeholder, value, onChange }: { label: ReactNode; placeholder?: string; value: string; onChange: (next: string) => void }) {
  return (
    <div className="cat-search">
      <Search size={16} aria-hidden="true" />
      <Input type="search" label={label} placeholder={placeholder} value={value} maxLength={60} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** A table in a card, with its tools on top and an optional line under it. */
export function TableCard({ head, foot, children }: { head?: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return (
    <section className="cat-tablecard">
      {head ? <div className="cat-tablecard-head">{head}</div> : null}
      <div className="cat-tablecard-body">{children}</div>
      {foot ? <div className="cat-tablecard-foot type-small">{foot}</div> : null}
    </section>
  );
}

/** A quiet "see all" link with an arrow. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="cat-more" href={href}>
      {children}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

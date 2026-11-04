"use client";

import { useEffect, useState, type ReactNode } from "react";
import { canAccess, hasFullPowers } from "@/lib/features";
import { useLang } from "@/i18n";
import { useStore } from "@/store/core";
import type { LedgerCategory } from "@/store/types";
import { Select } from "@/ui";
import { periodLabel } from "./rules/report";
import "./finance.css";

/** What the signed-in profile may do on the finance screens. */
export function useFinanceAccess() {
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const full = hasFullPowers(profile);
  return {
    profile,
    /** Full tier: price and rate editors, CSV exports. */
    full,
    isSuper: profile === "superUser",
    orders: canAccess(profile, "orders", switches),
    /** Full tier with Finances and Inventory. */
    canCount: full && canAccess(profile, "finances", switches) && canAccess(profile, "inventory", switches),
  };
}

/** A value that fades in from a small nudge whenever its text changes. */
export function Tick({ children, className }: { children: string; className?: string }) {
  return (
    <span key={children} className={`fin-tick ${className ?? ""}`}>
      {children}
    </span>
  );
}

/** Says a live figure once the user stops moving, so a slider never floods a screen reader. */
export function DebouncedLive({ text, delay = 600 }: { text: string; delay?: number }) {
  const [said, setSaid] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSaid(text), delay);
    return () => window.clearTimeout(timer);
  }, [text, delay]);
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {said}
    </div>
  );
}

export function PeriodPicker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (period: string) => void }) {
  const all = options.includes(value) ? options : [value, ...options];
  return (
    <div className="fin-picker">
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {all.map((key) => (
          <option key={key} value={key}>
            {periodLabel(key)}
          </option>
        ))}
      </Select>
    </div>
  );
}

const SEED_COST_DE: Record<string, string> = {
  "App host": "App-Host",
  Database: "Datenbank",
  "File storage": "Dateispeicher",
  "Mail sender": "Mailversand",
  "Inbox assistant": "Inbox-Aufgabe",
  "Code host": "Code-Host",
};

/** A cost's label is store text in one language. The seeded names read in the page's language, and one the user typed stays as typed. */
export function useCostLabel(): (label: string) => string {
  const lang = useLang();
  return (label) => (lang === "de" ? (SEED_COST_DE[label] ?? label) : label);
}

export function useCategoryName(): (category: Pick<LedgerCategory, "nameEn" | "nameDe"> | null | undefined) => string {
  const lang = useLang();
  return (category) => (category ? (lang === "de" ? category.nameDe : category.nameEn) : "");
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`fin-note ${className ?? ""}`}>{children}</p>;
}

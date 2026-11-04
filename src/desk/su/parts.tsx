"use client";

import { Boxes, CalendarDays, ChartColumn, Factory, FolderOpen, Inbox, ListChecks, Megaphone, Package, ReceiptText, Rocket, Tag, Users, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/store/core";
import type { Person, SwitchableFeature } from "@/store/types";

export const FEATURE_ICONS: Record<SwitchableFeature, LucideIcon> = {
  drops: Rocket, products: Package, inventory: Boxes, orders: ReceiptText, customers: Users, discounts: Tag,
  analytics: ChartColumn, marketing: Megaphone, inbox: Inbox,
  files: FolderOpen, calendar: CalendarDays, tasks: ListChecks, production: Factory, finances: Wallet,
};

/** A Team edit shows everywhere the name is printed. */
export function useMemberName(profile: Person): string {
  return useStore((s) => s.team.find((m) => m.profile === profile)?.name ?? profile);
}

export const useOwnerName = () => useMemberName("owner");

export function SuCard({ icon: Icon, title, tone, className, children, aside }: { icon: LucideIcon; title: ReactNode; tone?: "rose"; className?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`pp-panel su-card ${className ?? ""}`}>
      <header className="su-card-head">
        <span className="su-card-icon" data-tone={tone}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <h2 className="type-h4">{title}</h2>
        {aside ? <div className="su-card-aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** A fixed English phrase in a code chip, inside its translated sentence. */
export function PhraseLine({ template, phrase }: { template: string; phrase: string }) {
  const [before, after] = template.split("{phrase}");
  return (
    <p className="type-small">
      {before}
      <code className="pp-code">{phrase}</code>
      {after}
    </p>
  );
}

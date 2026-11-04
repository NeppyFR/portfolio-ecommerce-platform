"use client";

import { Bot, CreditCard, Database, GitBranch, Globe, HardDrive, Mail, Map as MapIcon, Send, Server, ShoppingBag, UserCog, type LucideIcon } from "lucide-react";
import { fmt, useLang, useT } from "@/i18n";
import { shell } from "@/i18n/dict/shell";
import { nodeById, NODES } from "@/map/data";
import type { NodeId } from "@/store/types";

export type TouchesProps = { nodes: NodeId[]; pulse?: number; onHoverChange?: (hovering: boolean) => void; className?: string; max?: number };

const ICONS: Record<NodeId, LucideIcon> = {
  customers: ShoppingBag,
  staff: UserCog,
  mail: Send,
  dns: Globe,
  code: GitBranch,
  payments: CreditCard,
  app: Server,
  files: HardDrive,
  database: Database,
  inbox: Bot,
  mailbox: Mail,
};

function Chip({ icon: Icon, children, pulse, title }: { icon?: LucideIcon; children: React.ReactNode; pulse: number; title?: string }) {
  return (
    <span className="dk-chip" title={title}>
      {Icon ? <Icon size={13} strokeWidth={1.75} aria-hidden="true" /> : null}
      {children}
      <span key={pulse} className="dk-chip-dot" data-pulsing={pulse > 0 ? "" : undefined} aria-hidden="true" />
    </span>
  );
}

/** Which boxes of the real system this screen stands on. A mutation pulses the chip dots. */
export function Touches({ nodes, pulse = 0, onHoverChange, className, max = 4 }: TouchesProps) {
  const lang = useLang();
  const t = useT(shell);
  const all = nodes.length >= NODES.length;
  const shown = all ? [] : nodes.slice(0, max);
  const rest = all ? [] : nodes.slice(max);

  return (
    <div className={className ? `dk-touches ${className}` : "dk-touches"} onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)}>
      <span className="dk-touches-label">{t.touches}</span>
      {all ? (
        <Chip icon={MapIcon} pulse={pulse}>
          {fmt(t.touchesAll, { n: NODES.length })}
        </Chip>
      ) : null}
      {shown.map((id) => (
        <Chip key={id} icon={ICONS[id]} pulse={pulse}>
          {nodeById(id)[lang]}
        </Chip>
      ))}
      {rest.length ? (
        <Chip pulse={pulse} title={rest.map((id) => nodeById(id)[lang]).join(", ")}>
          {fmt(t.touchesMore, { n: rest.length })}
        </Chip>
      ) : null}
    </div>
  );
}

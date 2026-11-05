"use client";

import { Check, EllipsisVertical, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { identityOf } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import type { Lang, Person, TaskPriority } from "@/store/types";

export const PEOPLE: Person[] = ["owner", "finance", "warehouse", "studio"];

/** Everyone who can be assigned right now, plus anyone already on the record. Reads the Team screen's edits. */
export function usePeople(keep: Person[] = []): Person[] {
  const team = useStore((s) => s.team);
  return PEOPLE.filter((p) => keep.includes(p) || identityOf(p, team).isActive);
}

/** A person's initials on the region field. Fixed height, so it never pushes a row. */
export function Avatar({ person, size = 24, title }: { person: Person; size?: 18 | 24 | 28 | 44; title?: string }) {
  const team = useStore((s) => s.team);
  const who = identityOf(person, team);
  return (
    <span className="wk-av" data-size={size} title={title ?? who.name} role="img" aria-label={title ?? who.name}>
      <span aria-hidden="true">{size === 18 ? who.initials?.slice(0, 1) : who.initials}</span>
    </span>
  );
}

export function AvatarStack({ people, size = 24 }: { people: Person[]; size?: 18 | 24 | 28 }) {
  return (
    <span className="wk-stack">
      {people.map((p) => (
        <Avatar key={p} person={p} size={size} />
      ))}
    </span>
  );
}

export const nameOf = (person: Person, team: Parameters<typeof identityOf>[1]) => identityOf(person, team).name;

/** Toggle buttons with a person's initials, name and role. Several can be on. */
export function PersonToggles({ value, onChange, lang, keep }: { value: Person[]; onChange: (next: Person[]) => void; lang: Lang; keep?: Person[] }) {
  const team = useStore((s) => s.team);
  const people = usePeople(keep ?? value);
  return (
    <div className="wk-people">
      {people.map((p) => {
        const who = identityOf(p, team);
        const on = value.includes(p);
        return (
          <button key={p} type="button" className="wk-person" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}>
            <Avatar person={p} size={28} />
            <span className="wk-person-text">
              <span className="type-label">{who.name}</span>
              <span className="type-small">{who.role[lang]}</span>
            </span>
            {on ? <Check size={16} aria-hidden="true" className="wk-person-on" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Three rising bars. High: 3 lit. Normal: 2. Low: 1. The word goes to assistive tech and the tooltip. */
export function PriorityBars({ priority, label }: { priority: TaskPriority; label: string }) {
  const lit = priority === "high" ? 3 : priority === "normal" ? 2 : 1;
  return (
    <span className="wk-prio" data-priority={priority} title={label} role="img" aria-label={label}>
      <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={i * 5} y={8 - i * 4} width="3.5" height={4 + i * 4} rx="1" data-lit={i < lit || undefined} />
        ))}
      </svg>
    </span>
  );
}

export type MenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; disabled?: boolean; danger?: boolean };

/** A small floating menu. Esc and an outside click close it, and focus returns to its button. */
export function Menu({ label, items, icon: Icon = EllipsisVertical }: { label: string; items: MenuItem[]; icon?: LucideIcon }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <span className="wk-menu" ref={root}>
      <button ref={button} type="button" className="ui-iconbtn wk-menu-btn" aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <Icon size={16} aria-hidden="true" />
      </button>
      {open ? (
        <span className="wk-menu-pop" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="wk-menu-item"
              data-danger={item.danger || undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon ? <item.icon size={15} aria-hidden="true" /> : null}
              {item.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** A plain panel head: icon tile, title, one sentence. */
export function PanelTile({ icon: Icon, children }: { icon: LucideIcon; children?: ReactNode }) {
  return (
    <span className="wk-tile" aria-hidden="true">
      <Icon size={20} />
      {children}
    </span>
  );
}

/** Icon tile, one line of title, one line of body, an optional action. */
export function WorkEmpty({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="wk-empty">
      <PanelTile icon={Icon} />
      <h3 className="type-h4">{title}</h3>
      <p className="type-body">{children}</p>
      {action}
    </div>
  );
}

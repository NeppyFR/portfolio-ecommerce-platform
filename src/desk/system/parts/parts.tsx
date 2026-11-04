"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { fmt, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { useFailedSource } from "@/store/actions/system";
import { areaLights, type AreaId, type AreaLight, type Light } from "@/desk/system/rules/lights";
import { formatDateTime } from "@/lib/format";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Tone } from "@/store/types";
import { Button } from "@/ui/Button";
import { Status } from "@/ui/Status";
import "../system.css";

type T = (typeof system)["en"];

export const lightText = (t: T, light: Pick<Light, "key" | "vars">): string => fmt(t.state[light.key], light.vars);

/** The tone and word the Hosting map's services table prints for a box. A box with no light is off. */
export const nodeStatus = (t: T, light: { tone: Tone } | undefined): { tone: Tone; label: string } => {
  const tone = light?.tone ?? "off";
  return { tone, label: t.tone[tone] };
};

/** The eight lights with sentences, including a source failed on purpose. */
export function useLights(): AreaLight[] {
  const state = useStore((s) => s);
  const failed = useFailedSource();
  return useMemo(() => areaLights(state, DEMO_NOW_MS, failed), [state, failed]);
}

export function Intro({ children }: { children: ReactNode }) {
  return <p className="sy-intro type-small">{children}</p>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="sy-note type-small">{children}</p>;
}

export function Mono({ children, small }: { children: ReactNode; small?: boolean }) {
  return <span className={`${small ? "type-mono-s" : "type-mono"} sy-mono`}>{children}</span>;
}

/** A date and time that never breaks over two lines. */
export function Stamp({ at }: { at: string }) {
  return <span className="type-mono-s sy-mono sy-nowrap">{formatDateTime(at)}</span>;
}

export type PanelProps = { icon?: LucideIcon; title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; plain?: boolean };

/** A hairline panel. Never a shadow: only things that float get one. */
export function Panel({ icon: Icon, title, aside, children, className, plain }: PanelProps) {
  return (
    <section className={`${plain ? "sy-plain" : "sy-panel"} ${className ?? ""}`}>
      {title ? (
        <header className="sy-panel-head">
          {Icon ? (
            <span className="sy-tile" aria-hidden="true">
              <Icon size={16} />
            </span>
          ) : null}
          <h2 className="type-h4 sy-panel-title">{title}</h2>
          {aside ? <div className="sy-panel-aside">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type Fact = { label: ReactNode; value: ReactNode; wide?: boolean };

export function Facts({ items, className }: { items: Fact[]; className?: string }) {
  return (
    <dl className={`sy-facts ${className ?? ""}`}>
      {items.map((f, i) => (
        <div key={i} data-wide={f.wide || undefined}>
          <dt className="type-small">{f.label}</dt>
          <dd className="type-body">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The read-only panel most tabs are built from: a title, a list of facts, a footnote. */
export function FactPanel({ icon, title, aside, facts, note, className, children }: { icon?: LucideIcon; title: ReactNode; aside?: ReactNode; facts: Fact[]; note?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <Panel icon={icon} title={title} aside={aside} className={className}>
      <Facts items={facts} />
      {children}
      {note ? <Note>{note}</Note> : null}
    </Panel>
  );
}

/** The first card of a tab: the area's tone, its sentence, and one quiet line on what the tab is for. */
export function AreaLine({ area, intro }: { area: AreaId; intro?: ReactNode }) {
  const t = useT(system);
  const light = useLights().find((l) => l.id === area) as AreaLight;
  return (
    <div className="sy-arealine sy-soft" data-tone={light.tone}>
      <Status tone={light.tone}>{t.tone[light.tone]}</Status>
      <div className="sy-arealine-text">
        <p className="type-body sy-strong">{lightText(t, light)}</p>
        {intro ? <p className="type-small sy-intro">{intro}</p> : null}
      </div>
    </div>
  );
}

export function UnknownNote({ children }: { children: ReactNode }) {
  return <p className="sy-unknown type-body">{children}</p>;
}

/** A failed source hides its own content and nothing else, which is the point of the rule. */
export function SourceGate({ area, children }: { area: AreaId; children: ReactNode }) {
  const t = useT(system);
  const failed = useFailedSource();
  return failed === area ? <UnknownNote>{t.unknownNote}</UnknownNote> : <>{children}</>;
}

/** A card head with the area's light: same tile and size as `Panel`, plus the sentence the light carries. */
export function SectionHead({ icon: Icon, title, light, intro, aside }: { icon?: LucideIcon; title: ReactNode; light?: Light; intro?: ReactNode; aside?: ReactNode }) {
  const t = useT(system);
  return (
    <header className="sy-sectionhead">
      <div className="sy-sectionhead-row">
        {Icon ? (
          <span className="sy-tile" aria-hidden="true">
            <Icon size={16} />
          </span>
        ) : null}
        <h2 className="type-h4 sy-panel-title">{title}</h2>
        {light || aside ? (
          <div className="sy-panel-aside">
            {light ? <Status tone={light.tone}>{t.tone[light.tone]}</Status> : null}
            {aside}
          </div>
        ) : null}
      </div>
      {light ? <p className="type-body">{lightText(t, light)}</p> : null}
      {intro ? <p className="sy-intro type-small">{intro}</p> : null}
    </header>
  );
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <p className="sy-emptybox type-body">{children}</p>;
}

/** Cuts a long read-only list to its first rows, with one button for the rest. */
export function useShowMore<R>(rows: R[], first: number) {
  const [all, setAll] = useState(false);
  const t = useT(system);
  const shown = all || rows.length <= first ? rows : rows.slice(0, first);
  const more =
    rows.length > first ? (
      <div className="sy-more">
        <Button variant="outline" onClick={() => setAll(!all)}>
          {all ? t.showLess : fmt(t.showAll, { n: rows.length })}
        </Button>
      </div>
    ) : null;
  return { shown, more };
}

export type StripCell = { key: string; state: "ok" | "warn" | "bad" | "off"; label?: string };

/** A row of small marks, one per run or check. The sentence beside it says the same in words. */
export function Strip({ cells, caption, className }: { cells: StripCell[]; caption: string; className?: string }) {
  return (
    <div className={`sy-strip ${className ?? ""}`} role="img" aria-label={caption} title={caption}>
      {cells.map((c) => (
        <i key={c.key} data-state={c.state} title={c.label} />
      ))}
    </div>
  );
}

/** A query-only switch on the same page: looks like a link, costs no navigation. */
export const inlineLinkClass = "sy-link sy-linkbtn type-label";

export function TabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="sy-link type-label">
      {children}
    </Link>
  );
}

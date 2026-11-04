"use client";

import type { ReactNode } from "react";
import { useLang } from "@/i18n";
import { nodeById } from "@/map/data";
import type { NodeId, Tone } from "@/store/types";

export type TlProps = { label: ReactNode; date: string; actor?: string; detail?: ReactNode; service?: NodeId; tone?: Tone };

/** One timeline row, an `<li>`: dot, label, `date · actor · detail`, and a chip naming the service. */
export function Tl({ label, date, actor, detail, service, tone }: TlProps) {
  const lang = useLang();
  const node = service ? nodeById(service) : null;
  return (
    <li className="ui-tl" data-tone={tone}>
      <span className="ui-tl-dot" aria-hidden="true" />
      <div className="ui-tl-body">
        <span className="type-label">{label}</span>
        <span className="type-small ui-tl-meta">
          {[date, actor].filter(Boolean).join(" · ")}
          {detail ? <> · {detail}</> : null}
        </span>
      </div>
      {node ? <span className="ui-tl-tag type-mono-s">{lang === "de" ? node.de : node.en}</span> : null}
    </li>
  );
}

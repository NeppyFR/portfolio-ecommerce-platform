"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SCREENS } from "@/desk/registry";
import { fmt, useLang, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import type { NodeId, Tone } from "@/store/types";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { EDGES, nodeById } from "./data";
import { NODE_ICONS } from "./MapCanvas";

export type MapSheetProps = {
  node: NodeId | null;
  onClose: () => void;
  /** The box's live tone and word, where a screen has them. Without it, as on the landing and /built/, no tone word shows. */
  live?: { tone: Tone; label: string };
};

/** Role, provider, state sentence, connections, screens that touch it, jump link. */
export function MapSheet({ node, onClose, live }: MapSheetProps) {
  const t = useT(common).map;
  const lang = useLang();
  const n = node ? nodeById(node) : null;
  const name = n ? (lang === "de" ? n.de : n.en) : "";
  const Icon = n ? NODE_ICONS[n.id] : null;
  const edges = n ? EDGES.filter((e) => e.from === n.id || e.to === n.id) : [];
  const screens = n ? SCREENS.filter((s) => s.touches.includes(n.id) && !s.outsideShell && !s.superUserOnly) : [];
  const stateSentence = !n ? "" : n.id === "customers" ? t.stateShop : n.id === "staff" ? t.stateStaff : n.live ? t.stateLive : t.stateOff;
  const jump = n?.screen ?? null;
  const jumpLabel = n?.id === "customers" ? t.enterShop : n?.id === "staff" ? t.chooseProfile : fmt(t.jump, { screen: name });

  return (
    <Sheet open={Boolean(n)} onClose={onClose} title={name}>
      {n ? (
        <div className="ui-mapsheet">
          <div className="ui-mapsheet-head">
            {Icon ? (
              <span className="ui-mapsheet-tile" aria-hidden="true">
                <Icon size={20} />
              </span>
            ) : null}
            <p className="type-body-l">{lang === "de" ? n.roleDe : n.roleEn}</p>
          </div>
          <dl className="ui-mapsheet-facts">
            {n.provider ? (
              <div>
                <dt className="type-label">{t.provider}</dt>
                <dd>{n.provider}</dd>
              </div>
            ) : null}
            <div>
              <dt className="type-label">{t.state}</dt>
              <dd>
                {live && n.kind !== "person" ? <Status tone={live.tone}>{live.label}</Status> : null}
                <span className="ui-mapsheet-state">{stateSentence}</span>
              </dd>
            </div>
          </dl>
          <section>
            <h3 className="type-h4">{t.connections}</h3>
            <ul className="ui-mapsheet-list">
              {edges.map((e) => {
                const outgoing = e.from === n.id;
                const other = nodeById(outgoing ? e.to : e.from);
                return (
                  <li key={e.id}>
                    <span className="type-label">
                      {outgoing ? t.to : t.from} {lang === "de" ? other.de : other.en}
                    </span>
                    <span className="type-small">{lang === "de" ? e.de : e.en}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h3 className="type-h4">{t.screens}</h3>
            {screens.length ? (
              <ul className="ui-mapsheet-chips">
                {screens.map((s) => (
                  <li key={s.id}>
                    <Link href={s.route} className="ui-chip" onClick={onClose}>
                      <s.icon size={14} aria-hidden="true" />
                      {s[lang]}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-small">{t.noScreens}</p>
            )}
          </section>
          {jump ? (
            <Link href={jump} className="ui-btn ui-btn-outline" onClick={onClose}>
              {jumpLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

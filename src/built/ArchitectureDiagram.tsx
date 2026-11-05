"use client";

import { useId, type ReactNode } from "react";
import type { built } from "@/i18n/dict/built";

type Strings = typeof built.en;

const LEFT = 0;
const SLAB = 720;
const NOTE_X = 780;
const NOTE_W = 320;
const CENTER = LEFT + SLAB / 2;

const ROWS = {
  people: { y: 0, h: 52 },
  door: { y: 84, h: 84 },
  surfaces: { y: 200, h: 142 },
  data: { y: 374, h: 104 },
  rules: { y: 510, h: 104 },
  db: { y: 646, h: 72 },
};
const HEIGHT = ROWS.db.y + ROWS.db.h + 2;

/* The slabs are cards on black; the wires are light, with a black casing where they pass over anything. */
const CARD = "#0b0c10";
const RAISED = "#14161c";
const HAIR = "rgba(255,255,255,.18)";
const WIRE = "#b9f3ff";

/** Text wraps by itself in a foreignObject, which matters because the German runs longer. */
function Copy({ x, y, w, h, title, text, tone }: { x: number; y: number; w: number; h: number; title?: string; text?: string; tone?: "light" }) {
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div className="bt-fo" data-tone={tone}>
        {title ? <strong>{title}</strong> : null}
        {text ? <span>{text}</span> : null}
      </div>
    </foreignObject>
  );
}

function Link({ from, to, id }: { from: number; to: number; id: string }) {
  return (
    <g>
      <path d={`M${CENTER} ${from} V${to}`} stroke="#000" strokeWidth={5} strokeOpacity={0.9} fill="none" />
      <path d={`M${CENTER} ${from} V${to - 1}`} stroke={WIRE} strokeWidth={1.5} fill="none" markerEnd={`url(#${id})`} />
    </g>
  );
}

function Bracket({ y1, y2 }: { y1: number; y2: number }) {
  const x = SLAB + 24;
  return <path d={`M${SLAB + 10} ${y1} H${x} V${y2} H${SLAB + 10}`} fill="none" stroke="#6f7787" strokeWidth={1.5} />;
}

function Layered({ t }: { t: Strings }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrow = `${uid}a`;
  const fill = `${uid}f`;
  const third = (SLAB - 48 - 24) / 3;
  const inner = (i: number) => 24 + i * (third + 12);
  return (
    <svg className="bt-arch-svg" viewBox={`0 0 1100 ${HEIGHT}`} role="img" aria-label={t.archAria}>
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0.8 L9.5,5 L0,9.2 z" fill={WIRE} />
        </marker>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0f2c4a" />
          <stop offset=".46" stopColor="#0b0c10" />
          <stop offset="1" stopColor="#2a2360" />
        </linearGradient>
      </defs>

      <Link from={ROWS.people.y + ROWS.people.h} to={ROWS.door.y} id={arrow} />
      <Link from={ROWS.door.y + ROWS.door.h} to={ROWS.surfaces.y} id={arrow} />
      <Link from={ROWS.surfaces.y + ROWS.surfaces.h} to={ROWS.data.y} id={arrow} />
      <Link from={ROWS.data.y + ROWS.data.h} to={ROWS.rules.y} id={arrow} />
      <Link from={ROWS.rules.y + ROWS.rules.h} to={ROWS.db.y} id={arrow} />

      <rect x={CENTER - 170} y={ROWS.people.y + 1} width={340} height={ROWS.people.h - 2} rx={ROWS.people.h / 2 - 1} fill="#2860ee" />
      <foreignObject x={CENTER - 170} y={ROWS.people.y} width={340} height={ROWS.people.h}>
        <div className="bt-fo-pill">{t.archPeople}</div>
      </foreignObject>

      <rect x={LEFT + 0.75} y={ROWS.door.y} width={SLAB - 1.5} height={ROWS.door.h} rx={14} fill={`url(#${fill})`} stroke={HAIR} />
      <Copy x={LEFT + 24} y={ROWS.door.y} w={SLAB - 48} h={ROWS.door.h} title={t.archDoorTitle} text={t.archDoor} />

      <rect x={LEFT + 0.75} y={ROWS.surfaces.y} width={SLAB - 1.5} height={ROWS.surfaces.h} rx={14} fill={CARD} stroke={HAIR} />
      <Copy x={LEFT + 24} y={ROWS.surfaces.y + 8} w={SLAB - 48} h={30} title={t.archSurfacesTitle} />
      {(
        [
          [t.archShop, t.archShopText],
          [t.archAdmin, t.archAdminText],
          [t.archApi, t.archApiText],
        ] as const
      ).map(([name, text], i) => (
        <g key={name}>
          <rect x={inner(i)} y={ROWS.surfaces.y + 42} width={third} height={86} rx={10} fill={RAISED} stroke={HAIR} />
          <Copy x={inner(i) + 12} y={ROWS.surfaces.y + 42} w={third - 24} h={86} title={name} text={text} />
        </g>
      ))}

      <rect x={LEFT + 0.75} y={ROWS.data.y} width={SLAB - 1.5} height={ROWS.data.h} rx={14} fill={`url(#${fill})`} stroke={HAIR} />
      <Copy x={LEFT + 24} y={ROWS.data.y} w={SLAB - 48} h={ROWS.data.h} title={t.archDataTitle} text={t.archData} />

      <rect x={LEFT + 0.75} y={ROWS.rules.y} width={SLAB - 1.5} height={ROWS.rules.h} rx={14} fill={CARD} stroke={HAIR} />
      <Copy x={LEFT + 24} y={ROWS.rules.y} w={SLAB - 48} h={ROWS.rules.h} title={t.archRulesTitle} text={t.archRules} />

      <rect x={LEFT} y={ROWS.db.y} width={SLAB} height={ROWS.db.h} rx={14} fill="#2860ee" />
      <Copy x={LEFT + 24} y={ROWS.db.y} w={SLAB - 48} h={ROWS.db.h} title={t.archDbTitle} text={t.archDb} tone="light" />

      <Bracket y1={ROWS.door.y + 8} y2={ROWS.data.y + ROWS.data.h - 8} />
      <Copy x={NOTE_X} y={ROWS.door.y + 8} w={NOTE_W} h={ROWS.data.y + ROWS.data.h - ROWS.door.y - 16} title={t.archOneTitle} text={t.archOne} />
      <Bracket y1={ROWS.rules.y + 8} y2={ROWS.db.y + ROWS.db.h - 8} />
      <Copy x={NOTE_X} y={ROWS.rules.y + 8} w={NOTE_W} h={ROWS.db.y + ROWS.db.h - ROWS.rules.y - 16} title={t.archPriceTitle} text={t.archPrice} />
    </svg>
  );
}

function Step({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <li>
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
      {children}
    </li>
  );
}

/** The layered drawing from 1100 px up. Below that the same words as one wire with stops, because scaled text would break the 12 px floor. */
export function ArchitectureDiagram({ t }: { t: Strings }) {
  return (
    <>
      <div className="bt-arch-wide">
        <Layered t={t} />
      </div>
      <div className="bt-arch-low">
        <ol className="bt-arch-list">
          <Step title={t.archPeople} />
          <Step title={t.archDoorTitle} text={t.archDoor} />
          <Step title={t.archSurfacesTitle}>
            <ul>
              <li>
                <strong>{t.archShop}</strong> {t.archShopText}
              </li>
              <li>
                <strong>{t.archAdmin}</strong> {t.archAdminText}
              </li>
              <li>
                <strong>{t.archApi}</strong> {t.archApiText}
              </li>
            </ul>
          </Step>
          <Step title={t.archDataTitle} text={t.archData} />
          <Step title={t.archRulesTitle} text={t.archRules} />
          <Step title={t.archDbTitle} text={t.archDb} />
        </ol>
        <div className="bt-arch-notes">
          <p>
            <strong>{t.archOneTitle}</strong> {t.archOne}
          </p>
          <p>
            <strong>{t.archPriceTitle}</strong> {t.archPrice}
          </p>
        </div>
      </div>
    </>
  );
}

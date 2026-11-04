"use client";

import { useId, type ReactNode } from "react";
import { LABEL } from "@/lib/brand";
import type { GarmentTone, GarmentType, GarmentView } from "@/store/types";

export type GarmentProps = {
  type: GarmentType;
  tone: GarmentTone;
  view?: GarmentView;
  title?: string;
  /** Prints the label name. Tote defaults to on; pass it for the printed tee. */
  printed?: boolean;
  className?: string;
};

const SHADE = "#1b3fc4";
const SEAM = "#0a1a52";
const PALE: GarmentTone[] = ["ice", "lilac"];

type Paint = { tone: string; rib: string; ribDark: string; glow: string; shadeH: string; shadeV: string; mini: boolean; printed: boolean };
type Drawing = { vb: string; cuff: string; hood: string; art: ReactNode };

function Fill({ d, p, rib, tint, shaded }: { d: string; p: Paint; rib?: boolean; tint?: [string, number]; shaded?: boolean }) {
  return (
    <>
      <path d={d} fill={p.tone} stroke={p.mini ? "#7286d0" : undefined} strokeWidth={p.mini ? 9 : undefined} />
      {p.mini ? null : (
        <>
          {rib ? <path d={d} fill={p.rib} /> : null}
          {shaded ? (
            <>
              <path d={d} fill={p.glow} />
              <path d={d} fill={p.shadeH} />
              <path d={d} fill={p.shadeV} />
            </>
          ) : null}
          {tint ? <path d={d} fill={tint[0]} opacity={tint[1]} /> : null}
        </>
      )}
    </>
  );
}

function Mirror({ children }: { children: ReactNode }) {
  return <g transform="translate(400 0) scale(-1 1)">{children}</g>;
}

function hood(p: Paint, zip: boolean): Drawing {
  const sleeve = "M100 108C72 116 56 140 48 176L20 356l50 12 18-152Z";
  const cuff = "M20 356l50 12-4 28c-1 6-6 9-12 8l-32-8c-6-2-9-6-8-12Z";
  const body = "M128 86c22 24 122 24 144 0l28 22c12 8 16 20 16 34l-2 248H86L84 142c0-14 4-26 16-34Z";
  const hem = "M86 388h228v24c0 8-6 12-12 12H98c-6 0-12-4-12-12Z";
  const hoodShape = "M142 96C128 44 168 14 200 14s72 30 58 82c-6 18-110 18-116 0Z";
  const collar = "M128 86c10 30 62 42 72 66 10-24 62-36 72-66-14-14-30 12-72 14-42-2-58-28-72-14Z";
  const side = (
    <>
      <Fill d={sleeve} p={p} tint={[SHADE, 0.14]} />
      {p.mini ? null : <path d="M88 216 70 368" stroke={SEAM} strokeOpacity=".16" fill="none" />}
      <Fill d={cuff} p={p} rib tint={[SEAM, 0.1]} />
    </>
  );
  return {
    vb: "0 0 400 440",
    cuff: "4 300 150 150",
    hood: "110 0 180 180",
    art: (
      <>
        <Fill d={hoodShape} p={p} tint={[SHADE, 0.16]} />
        <path d="M156 94c4-18 22-30 44-30s40 12 44 30c-10 16-78 16-88 0Z" fill={SHADE} opacity=".42" />
        {side}
        <Mirror>{side}</Mirror>
        <Fill d={body} p={p} shaded />
        <Fill d={hem} p={p} rib tint={[SEAM, 0.08]} />
        {p.mini ? (
          zip ? <path d="M200 150V424" stroke={SEAM} strokeWidth="12" /> : null
        ) : (
          <>
            <path d="M100 108c-8 34-12 70-14 110M300 108c8 34 12 70 14 110" stroke={SEAM} strokeOpacity=".14" fill="none" />
            <path d="M120 200c10 60 6 120 -2 180M282 230c-10 50-6 100 2 150" stroke="#fff" strokeOpacity=".28" strokeWidth="3" fill="none" strokeLinecap="round" />
            <Fill d={collar} p={p} tint={[SHADE, 0.1]} />
            <path d="M136 388v-58l24-38h80l24 38v58" fill="#fff" fillOpacity=".1" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
            <path d="M136 330l24-38M264 330l-24-38" stroke={SEAM} strokeOpacity=".28" strokeWidth="1.5" />
            <path d="M182 134c-4 22-2 40-4 62M218 134c4 22 2 40 4 62" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="175" y="194" width="6" height="14" rx="2" fill={SEAM} opacity=".55" />
            <rect x="219" y="194" width="6" height="14" rx="2" fill={SEAM} opacity=".55" />
            {zip ? (
              <>
                <path d="M200 150V424" stroke={SEAM} strokeOpacity=".5" strokeWidth="2.5" />
                <path d="M200 150V424" stroke="#fff" strokeOpacity=".8" strokeWidth="1" strokeDasharray="2 3" />
                <rect x="196" y="156" width="8" height="18" rx="2.5" fill={SEAM} opacity=".75" />
              </>
            ) : null}
          </>
        )}
      </>
    ),
  };
}

function PrintedName({ x, y, size, fill = SEAM }: { x: number; y: number; size: number; fill?: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontStyle="italic" fontSize={size} fill={fill} letterSpacing="-1" style={{ fontFamily: "var(--font-serif)" }}>
      {LABEL.name}
    </text>
  );
}

function tee(p: Paint): Drawing {
  const b = "M130 60c20 20 120 20 140 0l70 36c8 4 12 14 8 22l-26 58c-4 8-14 10-22 6l-16-10 6 248c0 8-6 14-14 14H124c-8 0-14-6-14-14l6-248-16 10c-8 4-18 2-22-6L52 118c-4-8 0-18 8-22Z";
  const neck = "M146 66c14 34 94 34 108 0l16-6c-20 54-120 54-140 0Z";
  return {
    vb: "0 0 400 460",
    cuff: "36 70 130 130",
    hood: "120 40 160 160",
    art: (
      <>
        <Fill d={b} p={p} shaded />
        {p.mini ? null : (
          <>
            <path d="M116 172c-2-34-6-60-14-84M284 172c2-34 6-60 14-84" stroke={SEAM} strokeOpacity=".16" fill="none" />
            <path d={neck} fill={p.tone} />
            <path d={neck} fill={p.ribDark} />
            <path d="M152 70c14 28 82 28 96 0-22 14-74 14-96 0Z" fill={SEAM} opacity=".2" />
            <path d="M111 420h178M111 414h178" stroke="#fff" strokeOpacity=".5" fill="none" strokeDasharray="3 3" />
            <path d="M66 164l36 14M334 164l-36 14" stroke="#fff" strokeOpacity=".5" strokeDasharray="3 3" />
            <path d="M140 180c12 70 6 140-6 220M262 150c-8 80-2 160 8 240" stroke="#fff" strokeOpacity=".24" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {p.printed ? <PrintedName x={200} y={190} size={34} /> : null}
          </>
        )}
      </>
    ),
  };
}

function trousers(p: Paint, cargo: boolean): Drawing {
  const b = "M128 30h144l6 30 24 360c0 8-4 14-12 14h-62c-8 0-12-6-12-14l-14-250h-4l-14 250c0 8-4 14-12 14h-62c-8 0-12-6-12-14l24-360Z";
  const wb = "M128 26h144c3 0 5 2 5 5l3 28H120l3-28c0-3 2-5 5-5Z";
  const hems = "M97 404h82l-2 16c0 8-4 14-12 14h-58c-8 0-12-6-12-14ZM221 404h82l2 16c0 8-4 14-12 14h-58c-8 0-12-6-12-14Z";
  return {
    vb: "0 0 400 460",
    cuff: "84 320 130 130",
    hood: "110 10 180 180",
    art: (
      <>
        <Fill d={b} p={p} shaded />
        <Fill d={wb} p={p} rib tint={[SEAM, 0.1]} />
        <Fill d={hems} p={p} rib tint={[SEAM, 0.12]} />
        {p.mini ? null : (
          <>
            {cargo ? (
              <>
                <path d="M104 212h46l-4 66h-48Z" fill="#fff" fillOpacity=".12" stroke={SEAM} strokeOpacity=".32" strokeWidth="1.5" />
                <path d="M102 212h50v18h-52Z" fill={SEAM} opacity=".1" />
                <path d="M296 212h-46l4 66h48Z" fill="#fff" fillOpacity=".12" stroke={SEAM} strokeOpacity=".32" strokeWidth="1.5" />
                <path d="M298 212h-50v18h52Z" fill={SEAM} opacity=".1" />
              </>
            ) : (
              <>
                <path d="M124 56 102 404" stroke="#fff" strokeWidth="9" opacity=".92" />
                <path d="M276 56 298 404" stroke="#fff" strokeWidth="9" opacity=".92" />
              </>
            )}
            <path d="M190 60c-2 16 2 34-2 46M210 60c2 16-2 34 2 46" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M200 60v108" stroke={SEAM} strokeOpacity=".3" strokeWidth="1.5" />
            <path d="M134 92c16 2 24 12 28 34M266 92c-16 2-24 12-28 34" stroke={SEAM} strokeOpacity=".3" strokeWidth="1.5" fill="none" />
            <path d="M150 150c-6 80-10 170-16 240M250 150c6 80 10 170 16 240" stroke="#fff" strokeOpacity=".22" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}
      </>
    ),
  };
}

function cap(p: Paint): Drawing {
  const c = "M84 244C76 140 142 76 212 80c74 4 124 74 112 164-76-26-168-26-240 0Z";
  const br = "M84 244c72-26 164-26 240 0 34 12 56 34 44 50-8 10-30 4-54-4-66-22-136-20-196 2-18 6-40 10-44-8-4-16 2-32 10-40Z";
  return {
    vb: "30 50 360 270",
    cuff: "60 190 140 110",
    hood: "130 60 160 120",
    art: (
      <>
        <Fill d={c} p={p} shaded />
        {p.mini ? null : (
          <>
            <path d="M206 80c-34 44-54 100-56 150M206 80c34 40 58 90 62 148" stroke={SEAM} strokeOpacity=".26" strokeWidth="1.5" fill="none" />
            <path d="M210 86c-30 44-46 96-48 142M214 88c30 38 44 86 48 138" stroke="#fff" strokeOpacity=".5" strokeDasharray="3 3" fill="none" />
            <ellipse cx="208" cy="80" rx="9" ry="5" fill={p.tone} />
            <ellipse cx="208" cy="80" rx="9" ry="5" fill={SEAM} opacity=".2" />
            <circle cx="132" cy="150" r="3.2" fill={SEAM} opacity=".4" />
            <circle cx="292" cy="160" r="3.2" fill={SEAM} opacity=".4" />
          </>
        )}
        <Fill d={br} p={p} tint={[SEAM, 0.16]} />
        {p.mini ? null : <path d="M78 262c70-24 176-26 256-1M72 276c74-26 190-28 276 2" stroke="#fff" strokeOpacity=".45" strokeDasharray="3 4" fill="none" />}
      </>
    ),
  };
}

function beanie(p: Paint): Drawing {
  const d = "M78 262C72 146 132 92 200 92s128 54 122 170Z";
  const c = "M74 226c50-10 202-10 252 0 8 2 12 8 12 16v70c0 8-4 14-12 16-50 10-202 10-252 0-8-2-12-8-12-16v-70c0-8 4-14 12-16Z";
  return {
    vb: "30 40 340 320",
    cuff: "50 210 150 130",
    hood: "110 50 180 150",
    art: (
      <>
        <Fill d={d} p={p} rib shaded />
        <Fill d={c} p={p} rib tint={[SEAM, 0.12]} />
        {p.mini ? null : (
          <>
            <path d="M64 272c90 10 182 10 272 0" stroke="#fff" strokeOpacity=".28" strokeWidth="3" fill="none" />
            <rect x="185" y="292" width="30" height="16" rx="3" fill="#fff" opacity=".95" />
          </>
        )}
      </>
    ),
  };
}

function tote(p: Paint): Drawing {
  const b = "M88 170h224l16 260c0 8-6 14-14 14H86c-8 0-14-6-14-14Z";
  const backStrap = "M132 182c-6-120 40-150 68-150s74 30 68 150";
  const frontStrap = "M154 188c-2-70 22-110 46-110s48 40 46 110";
  return {
    vb: "0 0 400 460",
    cuff: "130 150 130 130",
    hood: "120 20 160 160",
    art: (
      <>
        <path d={backStrap} fill="none" stroke={p.tone} strokeWidth="15" />
        {p.mini ? <path d={backStrap} fill="none" stroke="#7286d0" strokeWidth="6" /> : <path d={backStrap} fill="none" stroke={SEAM} strokeOpacity=".14" strokeWidth="15" />}
        <Fill d={b} p={p} shaded />
        {p.mini ? null : (
          <>
            <path d={frontStrap} fill="none" stroke={p.tone} strokeWidth="15" />
            <path d={frontStrap} fill="none" stroke={SEAM} strokeOpacity=".06" strokeWidth="15" />
            <path d="M147 172h15v22h-15ZM238 172h15v22h-15Z" fill="none" stroke={SEAM} strokeOpacity=".4" strokeDasharray="2 2" />
            <path d="M147 172l15 22M162 172l-15 22M238 172l15 22M253 172l-15 22" stroke={SEAM} strokeOpacity=".3" />
            <path d="M86 184h228" stroke={SEAM} strokeOpacity=".3" strokeDasharray="3 3" />
            {p.printed ? <PrintedName x={200} y={325} size={42} /> : null}
          </>
        )}
      </>
    ),
  };
}

const DRAW: Record<GarmentType, (p: Paint) => Drawing> = {
  hoodie: (p) => hood(p, false),
  zip: (p) => hood(p, true),
  tee,
  pants: (p) => trousers(p, false),
  cargo: (p) => trousers(p, true),
  cap,
  beanie,
  tote,
};

const STOPS: Record<GarmentTone, { x1: string; x2: string; stops: [string, string][] }> = {
  ice: { x1: ".1", x2: ".9", stops: [["0", "#fff"], [".55", "#e4fbff"], ["1", "#b9f3ff"]] },
  sky: { x1: ".05", x2: ".95", stops: [["0", "#b9f3ff"], [".6", "#6fd3ff"], ["1", "#2f6bff"]] },
  azure: { x1: ".1", x2: ".85", stops: [["0", "#6fd3ff"], [".55", "#2f6bff"], ["1", "#8c7bff"]] },
  dusk: { x1: ".1", x2: ".9", stops: [["0", "#2f6bff"], ["1", "#8c7bff"]] },
  lilac: { x1: ".1", x2: ".9", stops: [["0", "#fff"], [".5", "#cfc8ff"], ["1", "#8c7bff"]] },
};

/** Stylised garment in inline SVG. Every instance carries its own gradient ids, so tones never collide. */
export function Garment({ type, tone, view = "full", title, printed, className }: GarmentProps) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { tone: `g${raw}t`, rib: `g${raw}r`, ribDark: `g${raw}d`, glow: `g${raw}l`, shadeH: `g${raw}h`, shadeV: `g${raw}v` };
  const mini = view === "mini";
  const paint: Paint = {
    tone: `url(#${ids.tone})`,
    rib: `url(#${ids.rib})`,
    ribDark: `url(#${ids.ribDark})`,
    glow: `url(#${ids.glow})`,
    shadeH: `url(#${ids.shadeH})`,
    shadeV: `url(#${ids.shadeV})`,
    mini,
    printed: printed ?? type === "tote",
  };
  const drawing = DRAW[type](paint);
  const crop = view === "crop-cuff" || view === "crop-hood";
  const viewBox = view === "crop-cuff" ? drawing.cuff : view === "crop-hood" ? drawing.hood : drawing.vb;
  const gradient = STOPS[tone];
  const pale = PALE.includes(tone);
  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio={`xMidYMid ${crop ? "slice" : "meet"}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-garment={type}
      data-tone={tone}
      data-view={view}
    >
      <defs>
        <linearGradient id={ids.tone} x1={gradient.x1} y1="0" x2={gradient.x2} y2="1">
          {gradient.stops.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        {mini ? null : (
          <>
            <linearGradient id={ids.shadeH} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={SHADE} stopOpacity=".3" />
              <stop offset=".28" stopColor={SHADE} stopOpacity="0" />
              <stop offset=".72" stopColor={SHADE} stopOpacity="0" />
              <stop offset="1" stopColor={SHADE} stopOpacity=".3" />
            </linearGradient>
            <linearGradient id={ids.shadeV} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={SHADE} stopOpacity="0" />
              <stop offset="1" stopColor={SHADE} stopOpacity=".3" />
            </linearGradient>
            <radialGradient id={ids.glow} cx=".36" cy=".24" r=".7">
              <stop offset="0" stopColor="#fff" stopOpacity=".55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <pattern id={ids.rib} width="5" height="10" patternUnits="userSpaceOnUse">
              <rect width="1.3" height="10" fill={pale ? "#2f6bff" : "#fff"} opacity={pale ? 0.14 : 0.55} />
            </pattern>
            <pattern id={ids.ribDark} width="5" height="10" patternUnits="userSpaceOnUse">
              <rect width="1.3" height="10" fill={SEAM} opacity=".16" />
            </pattern>
          </>
        )}
      </defs>
      {drawing.art}
    </svg>
  );
}

export type GlyphClusterProps = { items: { type: GarmentType; tone: GarmentTone }[]; className?: string; label?: string };

/** Up to three minis for an order row. */
export function GlyphCluster({ items, className, label }: GlyphClusterProps) {
  const shown = items.slice(0, 3);
  const extra = items.length - shown.length;
  return (
    <span className={`ui-cluster ${className ?? ""}`} role={label ? "img" : undefined} aria-label={label}>
      {shown.map((g, i) => (
        <span className="ui-cluster-item" key={i}>
          <Garment type={g.type} tone={g.tone} view="mini" />
        </span>
      ))}
      {extra > 0 ? <span className="ui-cluster-more type-mono-s">+{extra}</span> : null}
    </span>
  );
}

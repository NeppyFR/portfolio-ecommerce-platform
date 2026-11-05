"use client";

import { useId, type ReactNode } from "react";
import { LABEL } from "@/lib/brand";
import type { ArtTone, ArtView, ProductArtType } from "@/store/types";

export type ProductArtProps = {
  type: ProductArtType;
  tone: ArtTone;
  view?: ArtView;
  title?: string;
  /** Prints the store name. The notebook defaults to on; pass it for the printed mug. */
  printed?: boolean;
  className?: string;
};

const SHADE = "#1b3fc4";
const INK = "#0a1a52";
/* A mini sits on a near-black row with no shading to hold its edge, so the rim is the palette's palest blue. */
const RIM = "#b9f3ff";
const PALE: ArtTone[] = ["ice", "lilac"];

type Paint = { tone: string; grain: string; grainDark: string; glow: string; shadeH: string; shadeV: string; flame: string; halo: string; beam: string; mini: boolean; printed: boolean; printInk: string };
type Drawing = { vb: string; detail: string; top: string; art: ReactNode };

function Fill({ d, p, grain, tint, shaded }: { d: string; p: Paint; grain?: boolean; tint?: [string, number]; shaded?: boolean }) {
  return (
    <>
      <path d={d} fill={p.tone} stroke={p.mini ? RIM : undefined} strokeWidth={p.mini ? 9 : undefined} />
      {p.mini ? null : (
        <>
          {grain ? <path d={d} fill={p.grain} /> : null}
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

/** A thick line in the product's tone: a handle, a loop, a stem. */
function Band({ d, p, width, shade = 0.16 }: { d: string; p: Paint; width: number; shade?: number }) {
  return (
    <>
      {p.mini ? <path d={d} fill="none" stroke={RIM} strokeWidth={width + 9} strokeLinecap="round" /> : null}
      <path d={d} fill="none" stroke={p.tone} strokeWidth={width} strokeLinecap="round" />
      {p.mini ? null : <path d={d} fill="none" stroke={SHADE} strokeOpacity={shade} strokeWidth={width} strokeLinecap="round" />}
    </>
  );
}

function Shine({ d, opacity = 0.34, width = 5 }: { d: string; opacity?: number; width?: number }) {
  return <path d={d} stroke="#fff" strokeOpacity={opacity} strokeWidth={width} fill="none" strokeLinecap="round" />;
}

function PrintedName({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontStyle="italic" fontSize={size} fill={fill} letterSpacing="-1" style={{ fontFamily: "var(--font-serif)" }}>
      {LABEL.name}
    </text>
  );
}

function mug(p: Paint): Drawing {
  const body = "M70 110V336C70 372 126 392 190 392S310 372 310 336V110Z";
  const lip = "M70 110a120 28 0 1 0 240 0a120 28 0 1 0-240 0Z";
  const opening = "M86 110a104 20 0 1 0 208 0a104 20 0 1 0-208 0Z";
  const handle = "M312 172C378 160 400 198 396 238C392 284 352 306 312 304";
  return {
    vb: "40 37 400 400",
    detail: "292 150 124 124",
    top: "78 70 150 150",
    art: (
      <>
        <Band d={handle} p={p} width={30} />
        {p.mini ? null : <Shine d="M330 164C368 160 388 188 386 228" opacity={0.42} width={4} />}
        <Fill d={body} p={p} shaded />
        <Fill d={lip} p={p} tint={[SHADE, 0.08]} />
        <path d={opening} fill={INK} opacity={p.mini ? 1 : 0.62} />
        {p.mini ? null : (
          <>
            <path d="M104 114c26 12 146 12 172 0c-14 10-158 10-172 0Z" fill="#fff" opacity=".22" />
            <path d="M70 318C70 346 126 368 190 368S310 346 310 318V336C310 372 254 392 190 392S70 372 70 336Z" fill={INK} opacity=".12" />
            <Shine d="M104 156C96 214 96 286 108 346" opacity={0.42} width={8} />
            <Shine d="M284 158C290 214 288 288 280 340" opacity={0.16} width={5} />
            <path d={lip} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
            {p.printed ? <PrintedName x={190} y={268} size={40} fill={p.printInk} /> : null}
          </>
        )}
      </>
    ),
  };
}

function bottle(p: Paint): Drawing {
  const body = "M172 98h56c0 26 62 30 62 86v216c0 26-18 42-42 42h-96c-24 0-42-16-42-42V184c0-56 62-60 62-86Z";
  const cap = "M162 32a12 12 0 0 1 12-12h52a12 12 0 0 1 12 12v50h-76Z";
  return {
    vb: "0 -8 400 470",
    detail: "104 336 110 110",
    top: "122 -4 156 156",
    art: (
      <>
        <Band d="M178 22c0-22 44-22 44 0" p={p} width={9} />
        <Fill d={body} p={p} shaded />
        <Fill d={cap} p={p} grain tint={[INK, 0.14]} />
        {p.mini ? null : (
          <>
            <path d="M172 82h56v18h-56Z" fill={INK} opacity=".3" />
            <path d="M110 254h180v74H110Z" fill="#fff" fillOpacity=".12" />
            <path d="M110 254h180M110 328h180" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
            <path d="M110 386v14c0 26 18 42 42 42h96c24 0 42-16 42-42v-14Z" fill={INK} opacity=".14" />
            <Shine d="M138 186C130 240 130 340 136 398" opacity={0.46} width={8} />
            <Shine d="M264 196c4 60 4 130 0 196" opacity={0.16} />
          </>
        )}
      </>
    ),
  };
}

function lamp(p: Paint): Drawing {
  const shade = "M146 44h108c6 0 11 3 13 9l49 148c3 9-3 17-12 17H96c-9 0-15-8-12-17l49-148c2-6 7-9 13-9Z";
  const base = "M118 430c0-28 38-44 82-44s82 16 82 44c0 8-6 14-14 14H132c-8 0-14-6-14-14Z";
  return {
    vb: "0 0 400 460",
    detail: "112 338 116 116",
    top: "116 36 168 168",
    art: (
      <>
        {p.mini ? null : <path d="M100 222 46 440H354L300 222Z" fill={p.beam} />}
        <Fill d="M191 226h18v176h-18Z" p={p} tint={[INK, 0.16]} />
        <Fill d={base} p={p} shaded />
        <Fill d={shade} p={p} grain shaded />
        {p.mini ? null : (
          <>
            <path d="M92 218h216c-22 14-194 14-216 0Z" fill="#fff" opacity=".92" />
            <circle cx="200" cy="244" r="13" fill={p.tone} />
            <circle cx="200" cy="244" r="13" fill={INK} opacity=".2" />
            <circle cx="200" cy="326" r="9" fill={p.tone} />
            <circle cx="200" cy="326" r="9" fill={INK} opacity=".2" />
            <path d="M264 230v56" stroke="#fff" strokeOpacity=".75" strokeWidth="2.5" />
            <circle cx="264" cy="292" r="6.5" fill={RIM} />
            <Shine d="M160 60 124 196" opacity={0.5} width={6} />
            <Shine d="M138 414c10-8 30-14 44-14" opacity={0.42} width={4} />
          </>
        )}
      </>
    ),
  };
}

function notebook(p: Paint): Drawing {
  const pages = "M100 40h212a12 12 0 0 1 12 12v356a12 12 0 0 1-12 12H100Z";
  const cover = "M78 30h222a14 14 0 0 1 14 14v372a14 14 0 0 1-14 14H78a14 14 0 0 1-14-14V44a14 14 0 0 1 14-14Z";
  const spine = "M78 30h30v400H78a14 14 0 0 1-14-14V44a14 14 0 0 1 14-14Z";
  return {
    vb: "0 0 400 460",
    detail: "110 346 116 116",
    top: "54 22 170 170",
    art: (
      <>
        <path d={pages} fill="#e4fbff" stroke={p.mini ? RIM : undefined} strokeWidth={p.mini ? 9 : undefined} />
        {p.mini ? null : <path d="M318 56v348M321 60v340" stroke="#2f6bff" strokeOpacity=".35" strokeWidth="1" />}
        <path d="M148 430v24l9-8 9 8v-24Z" fill="#8c7bff" />
        <Fill d={cover} p={p} shaded />
        <Fill d={spine} p={p} grain tint={[INK, 0.14]} />
        <path d="M274 30h12v400h-12Z" fill={INK} opacity={p.mini ? 1 : 0.55} />
        {p.mini ? null : (
          <>
            <path d="M108 30v400" stroke={INK} strokeOpacity=".22" strokeWidth="1.5" />
            <path d="M130 66h126v44H130Z" fill="#fff" fillOpacity=".12" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
            <path d="M144 84h98M144 94h62" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
            <Shine d="M126 132C122 220 122 320 128 408" opacity={0.26} width={6} />
            {p.printed ? <PrintedName x={192} y={262} size={38} fill={p.printInk} /> : null}
          </>
        )}
      </>
    ),
  };
}

function candle(p: Paint): Drawing {
  const jar = "M100 170a100 20 0 0 1 200 0V392c0 26-18 42-42 42H142c-24 0-42-16-42-42Z";
  const lip = "M100 170a100 20 0 1 0 200 0a100 20 0 1 0-200 0Z";
  const flame = "M200 34C228 82 238 104 232 126C228 146 214 156 200 156C186 156 172 146 168 126C162 104 172 82 200 34Z";
  return {
    vb: "0 0 400 460",
    detail: "126 240 148 148",
    top: "112 22 176 176",
    art: (
      <>
        {p.mini ? null : <circle cx="200" cy="100" r="104" fill={p.halo} />}
        <Fill d={jar} p={p} shaded />
        <Fill d={lip} p={p} tint={[SHADE, 0.08]} />
        <path d="M114 170a86 14 0 1 0 172 0a86 14 0 1 0-172 0Z" fill={p.mini ? INK : "#fff"} opacity={p.mini ? 1 : 0.86} />
        <path d="M200 174v-26" stroke={INK} strokeWidth={p.mini ? 9 : 5} strokeLinecap="round" />
        <path d={flame} fill={p.mini ? "#fff" : p.flame} stroke={p.mini ? RIM : undefined} strokeWidth={p.mini ? 9 : undefined} />
        {p.mini ? null : (
          <>
            <path d="M200 86C214 110 218 120 216 130C214 142 208 148 200 148C192 148 186 142 184 130C182 120 186 110 200 86Z" fill="#fff" />
            <path d="M100 214c44 16 156 16 200 0" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" fill="none" />
            <path d="M136 262h128v92H136Z" fill="#fff" fillOpacity=".16" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
            <path d="M152 288h96M152 304h96M152 320h56" stroke="#fff" strokeOpacity=".62" strokeWidth="2.5" />
            <path d="M100 396c0 22 18 38 42 38h116c24 0 42-16 42-38v-6c-30 18-170 18-200 0Z" fill={INK} opacity=".14" />
            <Shine d="M118 212C114 268 114 330 120 388" opacity={0.46} width={7} />
          </>
        )}
      </>
    ),
  };
}

function planter(p: Paint): Drawing {
  const rim = "M92 226h216a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H92a10 10 0 0 1-10-10v-28a10 10 0 0 1 10-10Z";
  const pot = "M100 274h200l-20 152c-2 12-10 18-22 18H142c-12 0-20-6-22-18Z";
  const centre = "M200 228C166 170 168 84 204 18C238 84 238 170 200 228Z";
  const left = "M188 230C134 216 78 170 56 92C124 108 178 156 188 230Z";
  const right = "M212 230C266 216 322 170 344 92C276 108 222 156 212 230Z";
  const lowLeft = "M176 232C132 238 82 220 50 176C100 170 152 188 176 232Z";
  const lowRight = "M224 232C268 238 318 220 350 176C300 170 248 188 224 232Z";
  return {
    vb: "0 0 400 460",
    detail: "84 218 136 136",
    top: "116 8 168 168",
    art: (
      <>
        <Fill d={lowLeft} p={p} tint={[SHADE, 0.3]} />
        <Fill d={lowRight} p={p} tint={[SHADE, 0.3]} />
        <Fill d={left} p={p} tint={[SHADE, 0.16]} />
        <Fill d={right} p={p} tint={[SHADE, 0.16]} />
        <Fill d={centre} p={p} shaded />
        {p.mini ? null : (
          <>
            <path d="M200 216C196 160 198 92 204 40" stroke="#fff" strokeOpacity=".62" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M184 222C150 188 106 150 72 108" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M216 222C250 188 294 150 328 108" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M170 228C136 218 98 204 66 182M230 228C264 218 302 204 334 182" stroke="#fff" strokeOpacity=".36" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )}
        <Fill d={pot} p={p} shaded />
        <Fill d={rim} p={p} grain tint={[INK, 0.1]} />
        {p.mini ? null : (
          <>
            <path d="M104 274h192l-1 10H105Z" fill={INK} opacity=".2" />
            <Shine d="M126 292 142 420" opacity={0.42} width={7} />
            <Shine d="M274 300 264 408" opacity={0.16} />
            <Shine d="M98 240h120" opacity={0.5} width={3} />
          </>
        )}
      </>
    ),
  };
}

function speaker(p: Paint): Drawing {
  const box = "M112 24h176c20 0 34 14 34 34v344c0 20-14 34-34 34H112c-20 0-34-14-34-34V58c0-20 14-34 34-34Z";
  return {
    vb: "0 0 400 460",
    detail: "112 202 176 176",
    top: "128 44 144 144",
    art: (
      <>
        <path d="M112 432h40v14h-40ZM248 432h40v14h-40Z" fill={p.tone} stroke={p.mini ? RIM : undefined} strokeWidth={p.mini ? 6 : undefined} />
        <Fill d={box} p={p} shaded />
        {p.mini ? null : <path d={box} fill={p.grainDark} />}
        <circle cx="200" cy="112" r={p.mini ? 34 : 40} fill={INK} opacity={p.mini ? 1 : 0.72} />
        <circle cx="200" cy="290" r={p.mini ? 82 : 92} fill={INK} opacity={p.mini ? 1 : 0.72} />
        {p.mini ? null : (
          <>
            <circle cx="200" cy="112" r="28" fill={p.tone} />
            <circle cx="200" cy="112" r="28" fill={p.glow} />
            <circle cx="200" cy="112" r="39" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
            <circle cx="200" cy="290" r="78" fill={p.tone} />
            <circle cx="200" cy="290" r="78" fill={SHADE} opacity=".3" />
            <circle cx="200" cy="290" r="62" fill={INK} opacity=".5" />
            <circle cx="200" cy="290" r="44" fill={INK} opacity=".3" />
            <circle cx="200" cy="290" r="28" fill={p.tone} />
            <circle cx="200" cy="290" r="28" fill={p.glow} />
            <circle cx="200" cy="290" r="91" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
            <Shine d="M136 248a76 76 0 0 1 48-34" opacity={0.56} width={4} />
            <Shine d="M186 96a22 22 0 0 1 16-6" opacity={0.7} width={3} />
            <Shine d="M96 68V392" opacity={0.3} width={5} />
            <circle cx="200" cy="412" r="5" fill={RIM} />
          </>
        )}
      </>
    ),
  };
}

function pouch(p: Paint): Drawing {
  const body = "M64 156C64 140 76 130 92 130H308C324 130 336 140 336 156L350 346C352 366 338 380 318 380H82C62 380 48 366 50 346Z";
  return {
    vb: "-2 56 400 400",
    detail: "244 122 112 112",
    top: "14 118 170 170",
    art: (
      <>
        <Band d="M318 160C326 120 356 98 378 106C396 114 390 142 336 166" p={p} width={11} shade={0.24} />
        <Fill d={body} p={p} grain shaded />
        {p.mini ? null : <path d="M63 150H337L339 192H60Z" fill={INK} opacity=".2" />}
        <path d="M66 171H334" stroke={INK} strokeWidth={p.mini ? 12 : 6} strokeOpacity={p.mini ? 1 : 0.62} />
        {p.mini ? null : (
          <>
            <path d="M66 171H334" stroke="#fff" strokeOpacity=".85" strokeWidth="2" strokeDasharray="2 3" />
            <circle cx="292" cy="171" r="8" fill="none" stroke={RIM} strokeWidth="3" />
            <path d="M285 176h14l3 42a8 8 0 0 1-20 0Z" fill={RIM} />
            <path d="M56 330c70 22 218 22 288 0" stroke={INK} strokeOpacity=".2" strokeWidth="2.5" fill="none" />
            <Shine d="M88 214C82 250 80 290 78 330" opacity={0.42} width={7} />
          </>
        )}
      </>
    ),
  };
}

const DRAW: Record<ProductArtType, (p: Paint) => Drawing> = { mug, bottle, lamp, notebook, candle, planter, speaker, pouch };

const STOPS: Record<ArtTone, { x1: string; x2: string; stops: [string, string][] }> = {
  ice: { x1: ".1", x2: ".9", stops: [["0", "#fff"], [".55", "#e4fbff"], ["1", "#b9f3ff"]] },
  sky: { x1: ".05", x2: ".95", stops: [["0", "#b9f3ff"], [".6", "#6fd3ff"], ["1", "#2f6bff"]] },
  azure: { x1: ".1", x2: ".85", stops: [["0", "#6fd3ff"], [".55", "#2f6bff"], ["1", "#8c7bff"]] },
  dusk: { x1: ".1", x2: ".9", stops: [["0", "#2f6bff"], ["1", "#8c7bff"]] },
  lilac: { x1: ".1", x2: ".9", stops: [["0", "#fff"], [".5", "#cfc8ff"], ["1", "#8c7bff"]] },
};

/** A product drawn in inline SVG. Every instance carries its own gradient ids, so tones never collide. */
export function ProductArt({ type, tone, view = "full", title, printed, className }: ProductArtProps) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { tone: `a${raw}t`, grain: `a${raw}r`, grainDark: `a${raw}d`, glow: `a${raw}l`, shadeH: `a${raw}h`, shadeV: `a${raw}v`, flame: `a${raw}f`, halo: `a${raw}o`, beam: `a${raw}b` };
  const mini = view === "mini";
  const pale = PALE.includes(tone);
  const paint: Paint = {
    tone: `url(#${ids.tone})`,
    grain: `url(#${ids.grain})`,
    grainDark: `url(#${ids.grainDark})`,
    glow: `url(#${ids.glow})`,
    shadeH: `url(#${ids.shadeH})`,
    shadeV: `url(#${ids.shadeV})`,
    flame: `url(#${ids.flame})`,
    halo: `url(#${ids.halo})`,
    beam: `url(#${ids.beam})`,
    mini,
    printed: printed ?? type === "notebook",
    printInk: pale ? INK : "#fff",
  };
  const drawing = DRAW[type](paint);
  const crop = view === "crop-detail" || view === "crop-top";
  const viewBox = view === "crop-detail" ? drawing.detail : view === "crop-top" ? drawing.top : drawing.vb;
  const gradient = STOPS[tone];
  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio={`xMidYMid ${crop ? "slice" : "meet"}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-art={type}
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
            <linearGradient id={ids.flame} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#8c7bff" />
              <stop offset=".5" stopColor="#6fd3ff" />
              <stop offset="1" stopColor="#b9f3ff" />
            </linearGradient>
            <linearGradient id={ids.beam} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={ids.halo}>
              <stop offset="0" stopColor="#b9f3ff" stopOpacity=".5" />
              <stop offset="1" stopColor="#b9f3ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={ids.glow} cx=".36" cy=".24" r=".7">
              <stop offset="0" stopColor="#fff" stopOpacity=".55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <pattern id={ids.grain} width="5" height="10" patternUnits="userSpaceOnUse">
              <rect width="1.3" height="10" fill={pale ? "#2f6bff" : "#fff"} opacity={pale ? 0.14 : 0.55} />
            </pattern>
            <pattern id={ids.grainDark} width="5" height="10" patternUnits="userSpaceOnUse">
              <rect width="1.3" height="10" fill={INK} opacity=".16" />
            </pattern>
          </>
        )}
      </defs>
      {drawing.art}
    </svg>
  );
}

export type GlyphClusterProps = { items: { type: ProductArtType; tone: ArtTone }[]; className?: string; label?: string };

/** Up to three minis for an order row. */
export function GlyphCluster({ items, className, label }: GlyphClusterProps) {
  const shown = items.slice(0, 3);
  const extra = items.length - shown.length;
  return (
    <span className={`ui-cluster ${className ?? ""}`} role={label ? "img" : undefined} aria-label={label}>
      {shown.map((g, i) => (
        <span className="ui-cluster-item" key={i}>
          <ProductArt type={g.type} tone={g.tone} view="mini" />
        </span>
      ))}
      {extra > 0 ? <span className="ui-cluster-more type-mono-s">+{extra}</span> : null}
    </span>
  );
}

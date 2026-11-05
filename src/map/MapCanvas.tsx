"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { Bot, CreditCard, Database, GitBranch, Globe, HardDrive, Mail, Send, Server, UserCog, Users, type LucideIcon } from "lucide-react";
import { useLang } from "@/i18n";
import type { NodeId } from "@/store/types";
import { EDGES, NODES, VIEWBOX, edgePath, labelAt, nodeBox, nodeById, type EdgeId, type MapEdge, type MapMode, type MapNode } from "./data";

export type MapCanvasProps = {
  mode: MapMode;
  /** Wire labels. The phone map has none. */
  labels?: boolean;
  /** The map itself is static. Its moving packets render in this slot, driven by packets.ts. */
  animated?: boolean;
  onNode?: (id: NodeId) => void;
  /** Lights these nodes and the wires between them; the rest dim. */
  lit?: NodeId[];
  className?: string;
  /** Override the frame. */
  viewBox?: string;
  /**
   * The wire labels stay away until a pointer is on a box or a wire, or one of them has keyboard focus.
   * Then only the labels of what is pointed at show, and everything else falls back.
   */
  hoverLabels?: boolean;
  /** Told which wires are in play while something is pointed at, null when nothing is. */
  onInvolved?: (edges: ReadonlySet<EdgeId> | null) => void;
  svgRef?: Ref<SVGSVGElement>;
  /** Drawn between the wires and the nodes, so packets pass under the boxes. */
  packets?: ReactNode;
  ariaLabel?: string;
};

export const NODE_ICONS: Record<NodeId, LucideIcon> = {
  customers: Users,
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

/** A first guess at a character's width, for the first render only: the plates are then fitted to the drawn text. */
const CHAR = 6.25;
const LINE = 15;
/** The air between a label's text and the edge of its plate, on each side. */
const PLATE_AIR = 10;

function WireText({ lines }: { lines: string[] }) {
  return (
    <text textAnchor="middle">
      {lines.map((line, i) => (
        <tspan key={i} x="0" y={(i - (lines.length - 1) / 2) * LINE + 4.3}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** What the pointer or the keyboard is on. */
type Pointed = { node: NodeId } | { edge: EdgeId };

const pointedAt = (target: EventTarget | null): Pointed | null => {
  if (!(target instanceof Element)) return null;
  const hit = target.closest<SVGElement>("[data-hit],[data-node]");
  if (!hit) return null;
  if (hit.dataset.hit) return { edge: hit.dataset.hit as EdgeId };
  return { node: hit.dataset.node as NodeId };
};

const edgesOf = (pointed: Pointed | null): Set<EdgeId> | null => {
  if (!pointed) return null;
  if ("edge" in pointed) return new Set([pointed.edge]);
  return new Set(EDGES.filter((e) => e.from === pointed.node || e.to === pointed.node).map((e) => e.id));
};

function WireLabel({ edge, mode, lines, dimmed, on }: { edge: MapEdge; mode: MapMode; lines: string[]; dimmed: boolean; on?: boolean }) {
  const width = Math.max(...lines.map((l) => l.length)) * CHAR + 2 * PLATE_AIR;
  const height = lines.length * LINE + 5;
  const at = labelAt(edge, mode);
  return (
    <g className="ui-map-label" data-label={edge.id} data-dim={dimmed || undefined} data-on={on || undefined} transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={height > 24 ? 8 : height / 2} />
      <WireText lines={lines} />
    </g>
  );
}

function Box({ node, mode, onNode, dimmed, faded, name, second }: { node: MapNode; mode: MapMode; onNode?: (id: NodeId) => void; dimmed: boolean; faded: boolean; name: string; second: string }) {
  const b = nodeBox(node, mode);
  const person = node.kind === "person";
  const phoneService = mode === "phone" && !person;
  const tile = phoneService ? 18 : person ? 32 : 28;
  const tx = phoneService ? 6 : person ? 12 : 10;
  const gap = phoneService ? 5 : 9;
  const Icon = NODE_ICONS[node.id];
  const x = b.x - b.w / 2;
  const y = b.y - b.h / 2;
  const nameY = phoneService ? b.h / 2 + 4.6 : b.h / 2 - 2;
  const interactive = Boolean(onNode);
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNode?.(node.id);
    }
  };
  return (
    <g
      className="ui-map-node"
      data-node={node.id}
      data-kind={node.kind}
      data-dim={dimmed || undefined}
      data-fade={faded || undefined}
      data-interactive={interactive || undefined}
      transform={`translate(${x} ${y})`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${name}: ${second}` : undefined}
      onClick={interactive ? () => onNode?.(node.id) : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
    >
      <rect className="ui-map-pulse" width={b.w} height={b.h} rx={12} />
      <rect className="ui-map-ring" x={-3} y={-3} width={b.w + 6} height={b.h + 6} rx={(person ? b.h / 2 : 12) + 3} />
      <rect className="ui-map-box" width={b.w} height={b.h} rx={person ? b.h / 2 : 12} />
      <rect className="ui-map-tile" x={tx} y={(b.h - tile) / 2} width={tile} height={tile} rx={person ? tile / 2 : 8} />
      <Icon className="ui-map-icon" x={tx + tile * 0.2} y={(b.h - tile) / 2 + tile * 0.2} width={tile * 0.6} height={tile * 0.6} aria-hidden="true" />
      <text className="ui-map-name" x={tx + tile + gap} y={nameY}>
        {name}
      </text>
      {phoneService ? null : (
        <text className="ui-map-second" x={tx + tile + gap} y={b.h / 2 + 13}>
          {second}
        </text>
      )}
    </g>
  );
}

const edgeLit = (edge: MapEdge, lit?: NodeId[]) => !lit || (lit.includes(edge.from) && lit.includes(edge.to));

export function MapCanvas({ mode, labels = mode !== "phone", animated = false, onNode, lit, className, viewBox, svgRef, packets, ariaLabel, hoverLabels = false, onInvolved }: MapCanvasProps) {
  const lang = useLang();
  const arrow = `arr${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const showLabels = labels && mode !== "phone";
  const hovering = hoverLabels && showLabels;
  const [overIt, setOverIt] = useState<Pointed | null>(null);
  const [focused, setFocused] = useState<Pointed | null>(null);
  const labelLayer = useRef<SVGGElement>(null);
  /* The last thing to touch the map was a pointer. Focus the dialog hands back after that stays quiet, even when Esc closed it. */
  const byPointer = useRef(false);
  const pointed = overIt ?? focused;
  const pointedKey = pointed ? ("edge" in pointed ? `e:${pointed.edge}` : `n:${pointed.node}`) : "";
  const involved = useMemo(() => edgesOf(pointed), [pointedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const involvedNodes = useMemo(() => {
    if (!involved) return null;
    const out = new Set<NodeId>();
    for (const e of EDGES) {
      if (involved.has(e.id)) {
        out.add(e.from);
        out.add(e.to);
      }
    }
    return out;
  }, [involved]);

  useEffect(() => {
    onInvolved?.(involved);
  }, [involved, onInvolved]);

  useEffect(() => {
    if (!hovering) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Enter" || e.key === " ") byPointer.current = false;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovering]);

  /* Each plate takes the width of its text as drawn, which moves with the language, the font and the text size of the moment. */
  useLayoutEffect(() => {
    const layer = labelLayer.current;
    const drawing = layer?.ownerSVGElement;
    if (!layer || !drawing) return;
    const fit = () => {
      /* A map the layout has hidden has no drawn text to read. The observer calls again when it shows. */
      if (!drawing.getBoundingClientRect().width) return;
      layer.querySelectorAll<SVGGElement>(".ui-map-label").forEach((label) => {
        const text = label.querySelector("text");
        const plate = label.querySelector("rect");
        if (!text || !plate) return;
        const width = text.getBBox().width + 2 * PLATE_AIR;
        plate.setAttribute("x", String(-width / 2));
        plate.setAttribute("width", String(width));
      });
    };
    fit();
    void document.fonts?.ready.then(fit);
    const resized = new ResizeObserver(fit);
    resized.observe(drawing);
    return () => resized.disconnect();
  }, [lang, showLabels]);

  const pointerProps = hovering
    ? {
        onPointerOver: (e: PointerEvent<SVGSVGElement>) => {
          /* A finger has no hover: a tap on a box opens its sheet, with the connections in it. */
          if (e.pointerType !== "touch") setOverIt(pointedAt(e.target));
        },
        onPointerLeave: () => setOverIt(null),
        onPointerDown: () => {
          byPointer.current = true;
        },
        onFocus: (e: FocusEvent<SVGSVGElement>) => {
          if (!byPointer.current && e.target.matches(":focus-visible")) setFocused(pointedAt(e.target));
        },
        onBlur: () => setFocused(null),
      }
    : null;

  return (
    <svg
      ref={svgRef}
      className={`ui-map ${className ?? ""}`}
      data-mode={mode === "phone" ? "phone" : "wide"}
      data-drawing={mode}
      data-animated={animated || undefined}
      data-hover-labels={hovering || undefined}
      viewBox={viewBox ?? VIEWBOX[mode]}
      role="group"
      aria-label={ariaLabel ?? (lang === "de" ? "Hosting-Karte" : "Hosting map")}
      preserveAspectRatio="xMidYMid meet"
      {...pointerProps}
    >
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0.8 L9.5,5 L0,9.2 z" fill="#b9f3ff" />
        </marker>
      </defs>
      <g data-layer="casing">
        {EDGES.map((e) => (
          <path key={e.id} className="ui-map-casing" data-edge-casing={e.id} data-dim={!edgeLit(e, lit) || undefined} data-fade={(involved && !involved.has(e.id)) || undefined} d={edgePath(e, mode)} />
        ))}
      </g>
      <g data-layer="wires">
        {EDGES.map((e) => (
          <path
            key={e.id}
            id={`${arrow}-${e.id satisfies EdgeId}`}
            className="ui-map-core"
            data-edge={e.id}
            data-slow={e.slow || undefined}
            data-dashed={e.dashed || undefined}
            data-state={e.state}
            data-dim={!edgeLit(e, lit) || undefined}
            data-fade={(involved && !involved.has(e.id)) || undefined}
            data-on={involved?.has(e.id) || undefined}
            d={edgePath(e, mode)}
            markerEnd={mode !== "phone" ? `url(#${arrow})` : undefined}
          />
        ))}
      </g>
      <g data-layer="packets">{packets}</g>
      {showLabels ? (
        <g ref={labelLayer} data-layer="labels" aria-hidden={hovering || undefined}>
          {EDGES.map((e) => (
            <WireLabel mode={mode} key={e.id} edge={e} lines={lang === "de" ? e.linesDe : e.linesEn} dimmed={!edgeLit(e, lit)} on={involved?.has(e.id)} />
          ))}
        </g>
      ) : null}
      <g data-layer="nodes">
        {NODES.map((n) => (
          <Box key={n.id} node={n} mode={mode} onNode={onNode} dimmed={Boolean(lit && !lit.includes(n.id))} faded={Boolean(involvedNodes && !involvedNodes.has(n.id))} name={lang === "de" ? n.de : n.en} second={lang === "de" ? n.secondDe : n.second} />
        ))}
      </g>
      {hovering ? (
        <g data-layer="hits">
          {EDGES.map((e) => {
            const a = nodeById(e.from);
            const b = nodeById(e.to);
            const route = lang === "de" ? `${a.de} zu ${b.de}` : `${a.en} to ${b.en}`;
            return <path key={e.id} className="ui-map-hit" data-hit={e.id} d={edgePath(e, mode)} tabIndex={0} role="img" aria-label={`${route}: ${lang === "de" ? e.de : e.en}`} />;
          })}
        </g>
      ) : null}
    </svg>
  );
}

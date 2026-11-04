"use client";

import { useId, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Bot, CreditCard, Database, GitBranch, Globe, HardDrive, Mail, Send, Server, Shirt, UserCog, type LucideIcon } from "lucide-react";
import { useLang } from "@/i18n";
import type { NodeId } from "@/store/types";
import { EDGES, NODES, VIEWBOX, edgePath, labelAt, nodeBox, type EdgeId, type MapEdge, type MapMode, type MapNode } from "./data";

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
  /** Override the frame, for example WIDE_FRAME on the landing. */
  viewBox?: string;
  svgRef?: Ref<SVGSVGElement>;
  /** Drawn between the wires and the nodes, so packets pass under the boxes. */
  packets?: ReactNode;
  ariaLabel?: string;
};

export const NODE_ICONS: Record<NodeId, LucideIcon> = {
  customers: Shirt,
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

const CHAR = 6.25;
const LINE = 15;

function WireLabel({ edge, mode, lines, dimmed }: { edge: MapEdge; mode: MapMode; lines: string[]; dimmed: boolean }) {
  const width = Math.max(...lines.map((l) => l.length)) * CHAR + 12;
  const height = lines.length * LINE + 5;
  const at = labelAt(edge, mode);
  return (
    <g className="ui-map-label" data-label={edge.id} data-dim={dimmed || undefined} transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={height > 24 ? 8 : height / 2} />
      <text textAnchor="middle">
        {lines.map((line, i) => (
          <tspan key={i} x="0" y={(i - (lines.length - 1) / 2) * LINE + 4.3}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function Box({ node, mode, onNode, dimmed, name, second }: { node: MapNode; mode: MapMode; onNode?: (id: NodeId) => void; dimmed: boolean; name: string; second: string }) {
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
      data-interactive={interactive || undefined}
      transform={`translate(${x} ${y})`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${name}: ${second}` : undefined}
      onClick={interactive ? () => onNode?.(node.id) : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
    >
      <rect className="ui-map-pulse" width={b.w} height={b.h} rx={12} />
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

export function MapCanvas({ mode, labels = mode !== "phone", animated = false, onNode, lit, className, viewBox, svgRef, packets, ariaLabel }: MapCanvasProps) {
  const lang = useLang();
  const arrow = `arr${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const showLabels = labels && mode !== "phone";
  return (
    <svg
      ref={svgRef}
      className={`ui-map ${className ?? ""}`}
      data-mode={mode === "phone" ? "phone" : "wide"}
      data-animated={animated || undefined}
      viewBox={viewBox ?? VIEWBOX[mode]}
      role="group"
      aria-label={ariaLabel ?? (lang === "de" ? "Hosting-Karte" : "Hosting map")}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0.8 L9.5,5 L0,9.2 z" fill="#143bb0" />
        </marker>
      </defs>
      <g data-layer="casing">
        {EDGES.map((e) => (
          <path key={e.id} className="ui-map-casing" data-edge-casing={e.id} data-dim={!edgeLit(e, lit) || undefined} d={edgePath(e, mode)} />
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
            d={edgePath(e, mode)}
            markerEnd={mode !== "phone" ? `url(#${arrow})` : undefined}
          />
        ))}
      </g>
      <g data-layer="packets">{packets}</g>
      {showLabels ? (
        <g data-layer="labels">
          {EDGES.map((e) => (
            <WireLabel mode={mode} key={e.id} edge={e} lines={lang === "de" ? e.linesDe : e.linesEn} dimmed={!edgeLit(e, lit)} />
          ))}
        </g>
      ) : null}
      <g data-layer="nodes">
        {NODES.map((n) => (
          <Box key={n.id} node={n} mode={mode} onNode={onNode} dimmed={Boolean(lit && !lit.includes(n.id))} name={lang === "de" ? n.de : n.en} second={lang === "de" ? n.secondDe : n.second} />
        ))}
      </g>
    </svg>
  );
}

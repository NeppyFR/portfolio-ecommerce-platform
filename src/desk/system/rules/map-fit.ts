import { EDGES, type MapEdge } from "@/map/data";
import type { NodeId } from "@/store/types";

/** Nothing below 12 px, drawn text included: how much a drawing's text must grow at a given width. */
export function fitScale(frameWidth: number, boxWidth: number): number {
  if (boxWidth <= 0) return 1;
  return Math.max(1, Math.ceil((frameWidth / boxWidth) * 100) / 100);
}

/** Past this growth the wire labels no longer fit between the boxes, so they move out of the drawing. */
export const LABELS_FIT_UP_TO = 1.1;
export const labelsFit = (scale: number): boolean => scale <= LABELS_FIT_UP_TO;

/** Wire labels are drawn at 12.5 units, so they need a little less than the 12-unit second lines. */
export const labelScale = (scale: number): number => Math.max(1, Math.ceil(((12.05 * scale) / 12.5) * 100) / 100);

/** How far a box moves once it has grown, so neighbours keep a gap. Drawing units, at 1.3 growth. */
const NODE_NUDGE: Partial<Record<NodeId, [number, number]>> = { payments: [-8, 0] };

export function nodeFit(box: { x: number; y: number; w: number; h: number }, id: NodeId, scale: number): { x: number; y: number } {
  const [dx, dy] = NODE_NUDGE[id] ?? [0, 0];
  const grow = Math.min(1, Math.max(0, (scale - 1) / 0.3));
  return {
    x: Math.round(box.x + dx * grow - (box.w * scale) / 2),
    y: Math.round(box.y + dy * grow - (box.h * scale) / 2),
  };
}

/** One box and everything wired to it: lights the box's wires and lists them. */
export function neighbourhood(id: NodeId): { lit: NodeId[]; edges: MapEdge[] } {
  const edges = EDGES.filter((e) => e.from === id || e.to === id);
  const lit = new Set<NodeId>([id]);
  for (const e of edges) {
    lit.add(e.from);
    lit.add(e.to);
  }
  return { lit: [...lit], edges };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fitScale, labelScale, labelsFit, nodeFit } from "@/desk/system/rules/map-fit";
import { nodeLights } from "@/desk/system/rules/lights";
import { NODES, nodeBox, type MapNode } from "@/map/data";
import { MapCanvas, type MapCanvasProps } from "@/map/MapCanvas";
import { useFailedSource } from "@/store/actions/system";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Tone } from "@/store/types";

const STROKE: Record<Tone, string> = { ok: "var(--ok)", warn: "var(--amber)", bad: "var(--rose)", unknown: "var(--unknown)", off: "#b6cbfa" };

/**
 * MapCanvas draws every box alike, so the live colours go on from here, keyed by `data-node`.
 * The sentences and the words for the same states are in the Services table.
 */
function liveCss(lights: Partial<Record<string, { tone: Tone }>>, scope: string): string {
  return Object.entries(lights)
    .map(([node, light]) => {
      if (!light) return "";
      const dash = light.tone === "unknown" ? "stroke-dasharray:5 4;" : "";
      const hub = node === "database";
      const width = light.tone === "warn" || light.tone === "bad" ? 3 : 2;
      return `.${scope} [data-node="${node}"] .ui-map-box{stroke:${STROKE[light.tone]};stroke-width:${width};${dash}${hub ? "" : "fill:#fff;"}}`;
    })
    .join("");
}

/** Grows boxes and wire labels so their text holds the 12 px floor when the drawing is scaled down. */
function fitCss(scale: number, scope: string): string {
  if (scale <= 1) return "";
  const boxes = NODES.map((node: MapNode) => {
    const fit = nodeFit(nodeBox(node, "wide"), node.id, scale);
    return `.${scope} [data-node="${node.id}"]{transform:translate(${fit.x}px,${fit.y}px) scale(${scale})}`;
  }).join("");
  const k = labelScale(scale);
  return `${boxes}.${scope} .ui-map-label rect,.${scope} .ui-map-label text{transform:scale(${k})}`;
}

export type SystemMapProps = MapCanvasProps & {
  scope: string;
  /** Keep the wide drawing's text at the 12 px floor. Needs `viewBox`. */
  fit?: boolean;
  /** Told whether the wire labels fit at this width, so the screen can carry them in words instead. */
  onLabelsFit?: (fits: boolean) => void;
};

export function SystemMap({ scope, fit = false, onLabelsFit, ...props }: SystemMapProps) {
  const state = useStore((s) => s);
  const failed = useFailedSource();
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const frameWidth = Number((props.viewBox ?? "").split(" ")[2]) || 0;

  useEffect(() => {
    const el = holder.current;
    if (!fit || !el || !frameWidth) return;
    const measure = () => {
      if (el.clientWidth <= 0) return;
      const next = fitScale(frameWidth, el.clientWidth);
      setScale(next);
      onLabelsFit?.(labelsFit(next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, frameWidth, onLabelsFit]);

  const css = useMemo(() => liveCss(nodeLights(state, DEMO_NOW_MS, failed) as Partial<Record<string, { tone: Tone }>>, scope) + (fit ? fitCss(scale, scope) : ""), [state, failed, scope, fit, scale]);
  return (
    <div className={scope} ref={holder}>
      <style>{css}</style>
      <MapCanvas {...props} labels={fit ? labelsFit(scale) : props.labels} />
    </div>
  );
}

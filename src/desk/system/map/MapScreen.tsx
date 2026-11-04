"use client";

import Link from "next/link";
import { useMemo, useState, type SyntheticEvent } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { Intro, Panel, lightText, nodeStatus, Stamp } from "@/desk/system/parts/parts";
import { SystemMap } from "@/desk/system/parts/SystemMap";
import { edgeLastSeen, nodeLights, whenOf } from "@/desk/system/rules/lights";
import { neighbourhood } from "@/desk/system/rules/map-fit";
import { fmt, useLang, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { EDGES, NODES, nodeById, type MapEdge, type MapNode } from "@/map/data";
import { MapSheet } from "@/map/MapSheet";
import { useFailedSource } from "@/store/actions/system";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { NodeId, Tone } from "@/store/types";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";

const TONES: Tone[] = ["ok", "warn", "bad", "unknown", "off"];
/** The hover words only make sense where the wide drawing shows; the phone drawing keeps the short hint. */
function WideOnly({ hint, short }: { hint: string; short: string }) {
  return (
    <>
      <span className="sy-map-wide">{hint}</span>
      <span className="sy-map-phone">{short}</span>
    </>
  );
}

/** Services first, then the two groups of people, as in the source. */
const ORDERED: MapNode[] = [...NODES.filter((n) => n.kind !== "person"), ...NODES.filter((n) => n.kind === "person")];

export function MapScreen() {
  const t = useT(system);
  const lang = useLang();
  const state = useStore((s) => s);
  const failed = useFailedSource();
  const [node, setNode] = useState<NodeId | null>(null);
  const [pointed, setPointed] = useState<NodeId | null>(null);
  const [labelsFit, setLabelsFit] = useState(true);
  const near = useMemo(() => (pointed ? neighbourhood(pointed) : null), [pointed]);
  const pointAt = (e: SyntheticEvent) => {
    const id = (e.target as Element).closest?.("[data-node]")?.getAttribute("data-node");
    setPointed((id as NodeId | null | undefined) ?? null);
  };
  const lights = useMemo(() => nodeLights(state, DEMO_NOW_MS, failed), [state, failed]);
  const seen = useMemo(() => edgeLastSeen(state), [state]);
  const name = (n: MapNode) => (lang === "de" ? n.de : n.en);
  const role = (n: MapNode) => (lang === "de" ? n.roleDe : n.roleEn);

  const stateCell = (n: MapNode) => {
    if (n.kind === "person") return <span className="type-small sy-muted">{t.map.browser}</span>;
    const light = lights[n.id];
    const status = nodeStatus(t, light);
    return (
      <div className="sy-stack-cell">
        <Status tone={status.tone}>{status.label}</Status>
        <span className="type-small sy-muted">{light ? lightText(t, light) : t.state.notConnected}</span>
      </div>
    );
  };
  const tabCell = (n: MapNode) =>
    n.screen ? (
      <Link href={n.screen} className="sy-link type-label">
        {name(n)}
      </Link>
    ) : (
      <span className="sy-muted">{t.none}</span>
    );

  const serviceColumns: Column<MapNode>[] = [
    {
      key: "service",
      header: t.map.colService,
      width: "18%",
      cell: (n) => (
        <div className="sy-stack-cell">
          <span style={{ fontWeight: 500 }}>{name(n)}</span>
          {n.provider ? <span className="type-mono-s sy-muted">{n.provider}</span> : null}
        </div>
      ),
    },
    { key: "role", header: t.map.colRole, width: "34%", cell: (n) => <span className="sy-muted">{role(n)}</span> },
    { key: "state", header: t.map.colState, cell: stateCell },
    { key: "tab", header: t.map.colTab, width: "14%", cell: tabCell },
  ];
  const edgeWhat = (e: MapEdge) => (lang === "de" ? e.de : e.en);
  const edgeSeen = (e: MapEdge) => {
    const at = seen[e.id];
    return at ? <Stamp at={at} /> : <span className="sy-muted">{t.none}</span>;
  };
  const edgeColumns: Column<MapEdge>[] = [
    { key: "from", header: t.map.colFrom, cell: (e) => name(nodeById(e.from)) },
    { key: "to", header: t.map.colTo, cell: (e) => name(nodeById(e.to)) },
    { key: "what", header: t.map.colWhat, cell: edgeWhat },
    { key: "seen", header: t.map.colLastSeen, align: "right", cell: edgeSeen },
  ];

  return (
    <div className="sy-page">
      <PageHead id="map" title={t.map.title} rule={<Intro>{t.map.intro}</Intro>} />
      <div className="sy-mapgrid">
        <section className="sy-mapstage" aria-label={t.map.title}>
          <div className="sy-map-wide" onMouseOver={pointAt} onMouseLeave={() => setPointed(null)} onFocus={pointAt} onBlur={() => setPointed(null)}>
            <SystemMap scope="sy-map-full" mode="wide" viewBox="26 346 1414 490" onNode={setNode} lit={near?.lit} onLabelsFit={setLabelsFit} fit />
          </div>
          <div className="sy-map-phone">
            <SystemMap scope="sy-map-full-phone" mode="phone" onNode={setNode} />
          </div>
          <div className="sy-mapcaption" aria-live="polite">
            {near && !labelsFit ? (
              <ul className="sy-wires type-small">
                {near.edges.map((e) => (
                  <li key={e.id}>{fmt(t.map.wireLine, { from: name(nodeById(e.from)), to: name(nodeById(e.to)), what: edgeWhat(e) })}</li>
                ))}
              </ul>
            ) : (
              <p className="sy-maphint type-small">{labelsFit ? t.map.hint : <WideOnly hint={t.map.hoverHint} short={t.map.hint} />}</p>
            )}
          </div>
        </section>
        <Panel title={t.map.legend}>
          <ul className="sy-legend type-small">
            {TONES.map((tone) => (
              <li key={tone}>
                <span className="sy-swatch" data-kind={tone} aria-hidden="true" />
                <span>
                  <b>{t.tone[tone]}</b>: {t.toneMeaning[tone]}
                </span>
              </li>
            ))}
            <li>
              <span className="sy-swatch" data-kind="people" aria-hidden="true" />
              <span>{t.map.legendPeople}</span>
            </li>
            <li>
              <span className="sy-swatch" data-kind="hub" aria-hidden="true" />
              <span>{t.map.legendHub}</span>
            </li>
            <li>
              <span className="sy-swatch" data-kind="dashed" aria-hidden="true" />
              <span>{t.map.legendDashed}</span>
            </li>
            <li>
              <span className="sy-swatch" data-kind="dotted" aria-hidden="true" />
              <span>{t.map.legendDotted}</span>
            </li>
          </ul>
        </Panel>
      </div>
      <Panel title={t.map.services} plain>
        <Table
          columns={serviceColumns}
          rows={ORDERED}
          rowKey={(n) => n.id}
          caption={t.map.services}
          phoneRow={(n) => (
            <div className="sy-prow">
              <div className="sy-prow-top">
                <div className="sy-stack-cell">
                  <span style={{ fontWeight: 500 }}>{name(n)}</span>
                  {n.provider ? <span className="type-mono-s sy-muted">{n.provider}</span> : null}
                </div>
                {tabCell(n)}
              </div>
              <span className="type-small sy-muted">{role(n)}</span>
              {stateCell(n)}
            </div>
          )}
        />
      </Panel>
      <Panel title={t.map.connections} plain>
        <Table
          columns={edgeColumns}
          rows={EDGES}
          rowKey={(e) => e.id}
          caption={t.map.connections}
          phoneRow={(e) => (
            <div className="sy-prow">
              <span style={{ fontWeight: 500 }}>
                {name(nodeById(e.from))} → {name(nodeById(e.to))}
              </span>
              <span className="type-small sy-muted">{edgeWhat(e)}</span>
              {seen[e.id] ? <span className="type-mono-s sy-muted">{whenOf(seen[e.id] as string, DEMO_NOW_MS)}</span> : null}
            </div>
          )}
        />
      </Panel>
      <MapSheet node={node} live={node ? nodeStatus(t, lights[node]) : undefined} onClose={() => setNode(null)} />
    </div>
  );
}

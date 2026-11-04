"use client";

import { useMemo } from "react";
import { Rocket, Server, ShieldCheck } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, EmptyBox, FactPanel, Mono, Note, Panel, SourceGate, Strip, type StripCell, Stamp } from "@/desk/system/parts/parts";
import { mainHead, productionDeploy, whenOf } from "@/desk/system/rules/lights";
import { fmt, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { PROJECT } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Deploy, DeployState, Tone } from "@/store/types";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";

const STATE_TONE: Record<DeployState, Tone> = { ready: "ok", building: "unknown", queued: "off", error: "bad", blocked: "bad", canceled: "off" };
const STRIP_STATE: Record<Tone, StripCell["state"]> = { ok: "ok", warn: "warn", bad: "bad", unknown: "off", off: "off" };
const seconds = (n: number) => `${n} s`;

export function DeploysScreen() {
  const t = useT(system);
  const deploys = useStore((s) => s.deploys);
  const runs = useStore((s) => s.ciRuns);
  const prod = useMemo(() => productionDeploy(deploys), [deploys]);
  const head = useMemo(() => mainHead(runs), [runs]);
  const rows = useMemo(() => deploys.slice(0, 20), [deploys]);
  const upToDate = Boolean(prod && head && prod.commit === head);

  const commitCell = (d: Deploy) => (
    <div className="sy-stack-cell">
      <span>
        <Mono small>{d.commit}</Mono> <span className="type-mono-s sy-muted">{d.branch}</span>
      </span>
      <span className="type-small sy-muted sy-wrap">{d.title}</span>
    </div>
  );
  const columns: Column<Deploy>[] = [
    { key: "created", header: t.deploys.colCreated, width: "150px", cell: (d) => <Stamp at={d.at} /> },
    { key: "target", header: t.deploys.colTarget, width: "116px", cell: (d) => t.deploys.target[d.target] },
    { key: "state", header: t.deploys.colState, width: "130px", cell: (d) => <Status tone={STATE_TONE[d.state]}>{t.deploys.stateName[d.state]}</Status> },
    { key: "commit", header: t.deploys.colCommit, cell: commitCell },
    { key: "build", header: t.deploys.colDuration, width: "72px", align: "right", cell: (d) => <Mono small>{seconds(d.durationSec)}</Mono> },
  ];

  return (
    <div className="sy-page">
      <PageHead id="deploys" title={fmt(t.deploys.title, { ready: rows.filter((d) => d.state === "ready").length, n: rows.length })} />
      <AreaLine area="deploys" intro={t.deploys.intro} />
      <SourceGate area="deploys">
        <div className="sy-split">
          <FactPanel
            icon={Rocket}
            className="sy-fill"
            title={t.deploys.production}
            facts={[
              { label: t.deploys.prodCommit, value: prod ? <span className="type-stat">{prod.commit}</span> : t.deploys.prodNone },
              { label: t.deploys.deployedAt, value: prod ? whenOf(prod.at, DEMO_NOW_MS) : t.none },
              {
                label: t.deploys.mainCommit,
                wide: true,
                value: head ? (
                  <span className="sy-commitline">
                    <Mono>{head}</Mono>
                    <Status tone={upToDate ? "ok" : "warn"}>{upToDate ? t.deploys.upToDate : t.deploys.behind}</Status>
                  </span>
                ) : (
                  t.deploys.mainUnknown
                ),
              },
            ]}
          >
            <div className="sy-foot">
              <p className="type-small sy-muted mb-1">{t.deploys.list}</p>
              <Strip cells={rows.map((d) => ({ key: d.id, state: STRIP_STATE[STATE_TONE[d.state]], label: d.commit }))} caption={t.deploys.list} />
            </div>
          </FactPanel>
          <div className="sy-stack">
            <FactPanel
              icon={ShieldCheck}
              title={t.deploys.protection}
              facts={[
                { label: t.deploys.hostAuth, value: t.deploys.scopeStandard },
                { label: t.deploys.password, value: t.deploys.scopeOff },
              ]}
            />
            <FactPanel
              icon={Server}
              title={t.deploys.server}
              facts={[
                { label: t.deploys.env, value: t.pay.envName.production },
                { label: t.deploys.commit, value: <Mono>{prod?.commit ?? t.none}</Mono> },
                { label: t.deploys.repo, value: <Mono small>{PROJECT.repo}</Mono> },
              ]}
            />
          </div>
        </div>
        <Panel title={t.deploys.list} plain>
          <Table
            columns={columns}
            className="sy-tight-2"
            rows={rows}
            rowKey={(d) => d.id}
            caption={t.deploys.list}
            empty={<EmptyBox>{t.deploys.listEmpty}</EmptyBox>}
            phoneRow={(d) => (
              <div className="sy-prow">
                <div className="sy-prow-top">
                  <span>
                    <Mono small>{d.commit}</Mono> <span className="type-small sy-muted">{t.deploys.target[d.target]}</span>
                  </span>
                  <Status tone={STATE_TONE[d.state]}>{t.deploys.stateName[d.state]}</Status>
                </div>
                <span className="type-small sy-wrap">{d.title}</span>
                <span className="type-mono-s sy-muted">
                  {formatDateTime(d.at)} · {d.branch}
                </span>
              </div>
            )}
          />
          <Note>{t.deploys.note}</Note>
        </Panel>
      </SourceGate>
    </div>
  );
}

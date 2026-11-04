"use client";

import { useMemo } from "react";
import { GitBranch, GitMerge, GitPullRequest } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, EmptyBox, Mono, Note, Panel, SourceGate, Stamp } from "@/desk/system/parts/parts";
import { latestPerWorkflow, whenOf } from "@/desk/system/rules/lights";
import { fmt, plural, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { formatDateTime } from "@/lib/format";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { CiConclusion, CiRun, PullRequestRow, Tone } from "@/store/types";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";

const RUN_TONE: Record<CiConclusion, Tone> = { success: "ok", failure: "bad", running: "unknown", cancelled: "off", skipped: "off" };
const CHECK_TONE: Record<PullRequestRow["checks"], Tone> = { passing: "ok", failing: "bad", pending: "unknown" };
const TRIGGER = "push";

export function CiScreen() {
  const t = useT(system);
  const runs = useStore((s) => s.ciRuns);
  const pulls = useStore((s) => s.pullRequests);
  const deploys = useStore((s) => s.deploys);
  const latest = useMemo(() => latestPerWorkflow(runs), [runs]);
  const onMain = useMemo(() => runs.filter((r) => r.branch === "main").slice(0, 15), [runs]);
  const open = useMemo(() => pulls.filter((p) => p.state === "open"), [pulls]);
  const merged = useMemo(() => pulls.filter((p) => p.state === "merged"), [pulls]);
  const titleOf = useMemo(() => new Map(deploys.map((d) => [d.commit, d.title])), [deploys]);

  const runColumns: Column<CiRun>[] = [
    { key: "started", header: t.ci.colStarted, width: "150px", cell: (r) => <Stamp at={r.at} /> },
    { key: "workflow", header: t.ci.colWorkflow, width: "150px", cell: (r) => r.workflow },
    { key: "status", header: t.ci.colStatus, width: "130px", cell: (r) => <Status tone={RUN_TONE[r.conclusion]}>{t.ci.status[r.conclusion]}</Status> },
    { key: "event", header: t.ci.colEvent, width: "76px", cell: () => <Mono small>{TRIGGER}</Mono> },
    {
      key: "commit",
      header: t.ci.colCommit,
      cell: (r) => (
        <span className="sy-wrap">
          <Mono small>{r.commit}</Mono> <span className="type-small sy-muted">{titleOf.get(r.commit) ?? ""}</span>
        </span>
      ),
    },
  ];
  const pullColumns: Column<PullRequestRow>[] = [
    {
      key: "pr",
      header: t.ci.colPr,
      cell: (p) => (
        <div className="sy-stack-cell">
          <span style={{ fontWeight: 500 }}>{p.title}</span>
          <span className="type-mono-s sy-muted">{p.branch}</span>
        </div>
      ),
    },
    { key: "checks", header: t.ci.colChecks, width: "130px", cell: (p) => <Status tone={CHECK_TONE[p.checks]}>{t.ci.checks[p.checks]}</Status> },
    { key: "updated", header: t.ci.colUpdated, width: "150px", cell: (p) => <Stamp at={p.at} /> },
  ];
  const pullCard = (p: PullRequestRow) => (
    <div className="sy-prow">
      <span className="type-small" style={{ fontWeight: 500 }}>
        {p.title}
      </span>
      <div className="sy-prow-top">
        <span className="type-mono-s sy-muted">{p.branch}</span>
        <Status tone={CHECK_TONE[p.checks]}>{t.ci.checks[p.checks]}</Status>
      </div>
      <span className="type-mono-s sy-muted">{formatDateTime(p.at)}</span>
    </div>
  );

  return (
    <div className="sy-page">
      <PageHead
        id="ci"
        title={fmt(t.ci.title, {
          prs: fmt(plural(open.length, t.ci.prsOne, t.ci.prsOther), { n: open.length }),
          runs: fmt(plural(onMain.length, t.ci.runsOne, t.ci.runsOther), { n: onMain.length }),
        })}
      />
      <AreaLine area="ci" intro={t.ci.intro} />
      <SourceGate area="ci">
        <Panel icon={GitBranch} title={t.ci.latest}>
          {latest.length === 0 ? (
            <p className="type-body">{t.ci.latestEmpty}</p>
          ) : (
            <ul className="sy-tiles">
              {latest.map((run) => (
                <li key={run.id} className="sy-tile-run">
                  <div className="sy-tile-run-head">
                    <span className="type-h4">{run.workflow}</span>
                    <Status tone={RUN_TONE[run.conclusion]}>{t.ci.status[run.conclusion]}</Status>
                  </div>
                  <span className="type-mono-s sy-muted">
                    {whenOf(run.at, DEMO_NOW_MS)} · {TRIGGER}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel icon={GitPullRequest} title={t.ci.pulls} plain>
          <Table columns={pullColumns} rows={open} rowKey={(p) => p.id} caption={t.ci.pulls} empty={<EmptyBox>{t.ci.pullsEmpty}</EmptyBox>} phoneRow={pullCard} />
          <Note>{t.ci.note}</Note>
        </Panel>
        {onMain.length ? (
          <Panel title={t.ci.runs} plain>
            <Table
              columns={runColumns}
              className="sy-hide-4"
              rows={onMain}
              rowKey={(r) => r.id}
              caption={t.ci.runs}
              phoneRow={(r) => (
                <div className="sy-prow">
                  <div className="sy-prow-top">
                    <span className="type-small" style={{ fontWeight: 500 }}>
                      {r.workflow}
                    </span>
                    <Status tone={RUN_TONE[r.conclusion]}>{t.ci.status[r.conclusion]}</Status>
                  </div>
                  <span className="type-small sy-muted sy-wrap">{titleOf.get(r.commit) ?? r.commit}</span>
                  <span className="type-mono-s sy-muted">
                    {formatDateTime(r.at)} · {r.commit} · {TRIGGER}
                  </span>
                </div>
              )}
            />
          </Panel>
        ) : null}
        {merged.length ? (
          <Panel icon={GitMerge} title={t.ci.merged} plain>
            <Table columns={pullColumns} rows={merged} rowKey={(p) => p.id} caption={t.ci.merged} phoneRow={pullCard} />
          </Panel>
        ) : null}
      </SourceGate>
    </div>
  );
}

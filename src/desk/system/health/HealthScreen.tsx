"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, HeartPulse, Info } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, Facts, Mono, Note, Panel, SourceGate, Strip, type StripCell, Stamp, useShowMore } from "@/desk/system/parts/parts";
import { countChecks, whenOf } from "@/desk/system/rules/lights";
import { fmt, plural, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { runHealthChecks } from "@/store/actions/system";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import { healthSummary, liveStatus } from "@/store/selectors";
import type { CheckStatus, HealthCheck, HealthRun, Tone } from "@/store/types";
import { Button } from "@/ui/Button";
import { RuleLine } from "@/ui/RuleLine";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";
import { toast } from "@/ui/Toast";

const RUN_DELAY_MS = 900;
const CHECK_TONE: Record<CheckStatus, Tone> = { pass: "ok", warn: "warn", fail: "bad", skip: "off" };
const SORT: Record<CheckStatus, number> = { fail: 0, warn: 1, skip: 2, pass: 3 };
const stripState = (status: CheckStatus): StripCell["state"] => (status === "pass" ? "ok" : status === "warn" ? "warn" : status === "fail" ? "bad" : "off");

const seconds = (run: HealthRun) => (run.finishedAt ? `${((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000).toFixed(1)} s` : "–");

export function HealthScreen() {
  const t = useT(system);
  const state = useStore((s) => s);
  const summary = useStore(healthSummary);
  const live = useStore(liveStatus);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const run = state.healthRuns[0] ?? null;
  const counts = run ? countChecks(run.checks) : null;
  const checks = useMemo(() => (run ? [...run.checks].sort((a, b) => SORT[a.status] - SORT[b.status]) : []), [run]);
  const overallTone: Tone = run ? CHECK_TONE[run.overall] : "off";
  const history = useShowMore(useMemo(() => state.healthRuns.slice(0, 20), [state.healthRuns]), 8);

  const start = () => {
    setRunning(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const result = runHealthChecks();
      setRunning(false);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      const c = countChecks(result.data.checks);
      const summaryText = fmt(plural(c.warn, t.health.summaryOne, t.health.summaryOther), { pass: c.pass, warn: c.warn, fail: c.fail, skip: c.skip });
      const lead = result.data.overall === "fail" ? t.health.toastFail : result.data.overall === "warn" ? t.health.toastWarn : t.health.toastPass;
      toast(fmt(lead, { summary: summaryText }));
    }, RUN_DELAY_MS);
  };

  const checkColumns: Column<HealthCheck>[] = [
    { key: "status", header: t.health.status, width: "116px", cell: (c) => <Status tone={CHECK_TONE[c.status]}>{t.health.statusName[c.status]}</Status> },
    { key: "check", header: t.health.check, width: "27%", cell: (c) => <Mono>{c.id}</Mono> },
    { key: "reason", header: t.health.result, cell: (c) => <span className="sy-muted">{c.reason}</span> },
    { key: "time", header: t.health.time, align: "right", width: "84px", cell: (c) => <Mono small>{c.ms} ms</Mono> },
  ];
  const runCols: Column<HealthRun>[] = [
    { key: "started", header: t.health.started, cell: (r) => <Stamp at={r.startedAt} /> },
    { key: "source", header: t.health.source, cell: (r) => t.health.sourceName[r.source] },
    { key: "result", header: t.health.result, cell: (r) => <Status tone={CHECK_TONE[r.overall]}>{t.overall[r.overall]}</Status> },
    {
      key: "counts",
      header: t.health.countsHeader,
      cell: (r) => {
        const c = countChecks(r.checks);
        return <Mono small>{`${c.pass} / ${c.warn} / ${c.fail} / ${c.skip}`}</Mono>;
      },
    },
    { key: "duration", header: t.health.duration, align: "right", cell: (r) => <Mono small>{seconds(r)}</Mono> },
  ];

  return (
    <div className="sy-page">
      <PageHead
        id="health"
        title={fmt(t.health.title, { pass: summary.pass })}
      />
      <AreaLine area="health" intro={t.health.intro} />
      <SourceGate area="health">
        <div className="sy-split">
          <Panel
            icon={HeartPulse}
            className="sy-fill"
            title={t.health.latest}
            aside={
              <>
                {run ? <Status tone={overallTone}>{t.health.live[live.state]}</Status> : null}
                <Button onClick={start} busy={running} aria-live="polite">
                  <Activity size={16} aria-hidden="true" />
                  {running ? t.health.running : t.health.run}
                </Button>
              </>
            }
          >
            {run && counts ? (
              <>
                <Facts
                  items={[
                    { label: t.health.started, value: whenOf(run.startedAt, DEMO_NOW_MS) },
                    { label: t.health.source, value: t.health.sourceName[run.source] },
                    { label: t.health.result, value: fmt(t.health.counts, { pass: counts.pass, warn: counts.warn, fail: counts.fail, skip: counts.skip }), wide: true },
                    { label: t.health.target, value: <span className="type-mono">{run.target ?? t.health.noTarget}</span>, wide: true },
                  ]}
                />
                <div className="sy-foot">
                  <Strip cells={run.checks.map((c) => ({ key: c.id, state: stripState(c.status), label: c.id }))} caption={t.health.dots} />
                  <div className="mt-3">
                    <RuleLine>{t.health.runRule}</RuleLine>
                  </div>
                </div>
              </>
            ) : (
              <p className="type-body">{t.health.empty}</p>
            )}
          </Panel>
          <Panel icon={Info} title={t.health.meaningTitle}>
            <ul className="sy-meaning">
              {(["pass", "warn", "fail", "skip"] as const).map((status) => (
                <li key={status}>
                  <Status tone={CHECK_TONE[status]}>{t.health.statusName[status]}</Status>
                  <span className="type-small">{t.health.meaning[status]}</span>
                </li>
              ))}
            </ul>
            <Note>{t.health.reasonsNote}</Note>
          </Panel>
        </div>
        {run ? (
          <Panel title={t.health.checksTitle} plain>
            <Table
              columns={checkColumns}
              rows={checks}
              rowKey={(c) => c.id}
              caption={t.health.checksTitle}
              phoneRow={(c) => (
                <div className="sy-prow">
                  <div className="sy-prow-top">
                    <Mono>{c.id}</Mono>
                    <Status tone={CHECK_TONE[c.status]}>{t.health.statusName[c.status]}</Status>
                  </div>
                  <span className="type-small sy-muted">{c.reason}</span>
                </div>
              )}
            />
          </Panel>
        ) : null}
        <Panel title={t.health.history} plain>
          <Table
            columns={runCols}
            rows={history.shown}
            rowKey={(r) => r.id}
            caption={t.health.history}
            selectedKey={run?.id}
            empty={<p className="type-body">{t.health.noRuns}</p>}
            phoneRow={(r) => {
              const c = countChecks(r.checks);
              return (
                <div className="sy-prow">
                  <div className="sy-prow-top">
                    <Stamp at={r.startedAt} />
                    <Status tone={CHECK_TONE[r.overall]}>{t.overall[r.overall]}</Status>
                  </div>
                  <span className="type-small sy-muted">
                    {t.health.sourceName[r.source]} · {`${c.pass} / ${c.warn} / ${c.fail} / ${c.skip}`} · {seconds(r)}
                  </span>
                </div>
              );
            }}
          />
          {history.more}
        </Panel>
      </SourceGate>
    </div>
  );
}

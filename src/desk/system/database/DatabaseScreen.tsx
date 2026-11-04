"use client";

import { useMemo } from "react";
import { Boxes, Database, GitCompareArrows, HardDrive, ListChecks } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, FactPanel, Mono, Note, Panel, SourceGate, useShowMore } from "@/desk/system/parts/parts";
import { tableFacts } from "@/desk/system/rules/db-tables";
import { latestCheck } from "@/desk/system/rules/lights";
import { fmt, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { formatBytes, formatDate } from "@/lib/format";
import { useStore } from "@/store/core";
import { INVARIANTS } from "@/store/seed/system";
import type { DbTable, Migration, StorageBucket, Tone } from "@/store/types";
import { BarList } from "@/ui/charts";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";

const MIGRATION_TONE: Record<Migration["state"], Tone> = { applied: "ok", pending: "bad", extra: "warn" };
type Invariant = (typeof INVARIANTS)[number];
const INVARIANT_TONE: Record<Invariant["severity"], Tone> = { fail: "bad", warn: "warn", "fail / warn": "bad" };

export function DatabaseScreen() {
  const t = useT(system);
  const state = useStore((s) => s);
  const applied = state.migrations.filter((m) => m.state === "applied").length;
  const invariantCheck = latestCheck(state, "db.invariants");
  const violated = invariantCheck && invariantCheck.status !== "pass";
  const facts = useMemo(() => tableFacts(state), [state]);
  const largest = facts.slice(0, 6);
  const migrations = useShowMore(state.migrations, 10);
  const tables = useShowMore(facts, 10);
  const invariants = useShowMore(INVARIANTS, 6);

  const migrationCols: Column<Migration>[] = [
    { key: "name", header: t.db.colMigration, cell: (m) => <Mono small>{m.name}</Mono> },
    { key: "state", header: t.db.colState, width: "130px", cell: (m) => <Status tone={MIGRATION_TONE[m.state]}>{t.db.stateName[m.state]}</Status> },
    { key: "on", header: t.db.colVersion, width: "108px", align: "right", cell: (m) => <Mono small>{formatDate(m.appliedOn)}</Mono> },
  ];
  const tableCols: Column<DbTable>[] = [
    { key: "name", header: t.db.colTable, cell: (r) => <Mono small>{r.name}</Mono> },
    { key: "size", header: t.db.colSize, align: "right", cell: (r) => <Mono small>{formatBytes(r.sizeBytes)}</Mono> },
    { key: "rows", header: t.db.colRows, align: "right", cell: (r) => <span className="sy-muted"><Mono small>{r.rows}</Mono></span> },
  ];
  const bucketCols: Column<StorageBucket>[] = [
    { key: "name", header: t.db.colBucket, cell: (b) => <Mono small>{b.name}</Mono> },
    { key: "access", header: t.db.colAccess, cell: (b) => (b.isPublic ? t.db.accessPublic : t.db.accessPrivate) },
    { key: "objects", header: t.db.colObjects, align: "right", cell: (b) => <Mono small>{b.objects}</Mono> },
    { key: "size", header: t.db.colSize, align: "right", cell: (b) => <Mono small>{formatBytes(b.sizeBytes)}</Mono> },
  ];
  const invariantCols: Column<Invariant>[] = [
    { key: "id", header: t.db.colId, width: "64px", cell: (i) => <Mono small>{i.id}</Mono> },
    { key: "severity", header: t.db.colSeverity, width: "170px", cell: (i) => <Status tone={INVARIANT_TONE[i.severity]}>{t.db.severity[i.severity]}</Status> },
    { key: "meaning", header: t.db.colMeaning, cell: (i) => <span className="sy-muted">{i.meaning}</span> },
  ];

  return (
    <div className="sy-page">
      <PageHead id="database" title={fmt(t.db.title, { tables: facts.length, applied, files: state.migrations.length })} />
      <AreaLine area="database" intro={t.db.intro} />
      <SourceGate area="database">
        <div className="sy-split">
          <FactPanel
            icon={Database}
            className="sy-fill"
            title={t.db.facts}
            facts={[
              { label: t.db.size, value: <span className="type-stat">{formatBytes(state.dbFacts.sizeBytes)}</span> },
              { label: t.db.connections, value: fmt(t.db.connectionsValue, { used: state.dbFacts.connectionsUsed, max: state.dbFacts.connectionsMax }) },
              { label: t.db.invariants, value: violated ? <Status tone="warn">{invariantCheck.reason}</Status> : <Status tone="ok">{t.db.invariantsNone}</Status> },
              { label: t.db.demo, value: state.dbFacts.demoLoaded ? t.db.demoYes : t.db.demoNo },
            ]}
            note={t.db.connectionsNote}
          />
          <Panel icon={HardDrive} title={t.db.largest}>
            <BarList caption={t.db.largest} data={largest.map((r) => ({ key: r.name, label: r.name, value: r.sizeBytes, display: formatBytes(r.sizeBytes) }))} />
          </Panel>
        </div>
        <div className="sy-two">
          <Panel icon={GitCompareArrows} title={t.db.migrations} aside={<span className="type-mono-s sy-muted">{fmt(t.db.migrationsSummary, { applied, files: state.migrations.length })}</span>} plain>
            <Table
              columns={migrationCols}
              rows={migrations.shown}
              rowKey={(m) => m.id}
              caption={t.db.migrations}
              phoneRow={(m) => (
                <div className="sy-prow">
                  <div className="sy-prow-top">
                    <Mono small>{m.name}</Mono>
                    <Status tone={MIGRATION_TONE[m.state]}>{t.db.stateName[m.state]}</Status>
                  </div>
                  <span className="type-mono-s sy-muted">{formatDate(m.appliedOn)}</span>
                </div>
              )}
            />
            {migrations.more}
          </Panel>
          <Panel icon={HardDrive} title={t.db.tables} aside={<span className="type-mono-s sy-muted">{fmt(t.db.tablesSummary, { count: facts.length })}</span>} plain>
            <Table
              columns={tableCols}
              rows={tables.shown}
              rowKey={(r) => r.name}
              caption={t.db.tables}
              phoneRow={(r) => (
                <div className="sy-prow-top">
                  <Mono small>{r.name}</Mono>
                  <span className="type-mono-s sy-muted sy-nowrap">
                    {formatBytes(r.sizeBytes)} · {r.rows}
                  </span>
                </div>
              )}
            />
            {tables.more}
            <Note>{t.db.rowsNote}</Note>
          </Panel>
        </div>
        <Panel icon={ListChecks} title={t.db.invariantsTitle} plain>
          <p className="sy-intro type-small mb-2">{t.db.invariantsIntro}</p>
          <Table
            columns={invariantCols}
            rows={invariants.shown}
            rowKey={(i) => i.id}
            caption={t.db.invariantsTitle}
            phoneRow={(i) => (
              <div className="sy-prow">
                <div className="sy-prow-top">
                  <Mono small>{i.id}</Mono>
                  <Status tone={INVARIANT_TONE[i.severity]}>{t.db.severity[i.severity]}</Status>
                </div>
                <span className="type-small sy-muted">{i.meaning}</span>
              </div>
            )}
          />
          {invariants.more}
        </Panel>
        <Panel icon={Boxes} title={t.db.storage} plain>
          <Table columns={bucketCols} rows={state.buckets} rowKey={(b) => b.name} caption={t.db.storage} empty={<p className="type-body">{t.db.storageEmpty}</p>} />
          <Note>{t.db.storageNote}</Note>
        </Panel>
      </SourceGate>
    </div>
  );
}

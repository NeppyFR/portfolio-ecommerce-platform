"use client";

import { useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, Mono, Panel, SourceGate, useShowMore } from "@/desk/system/parts/parts";
import { idList } from "@/desk/system/rules/lights";
import { fmt, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { formatDate } from "@/lib/format";
import { ROTATION_DAYS, rotationRows, rotationSummary, type RotationRow } from "@/lib/security-rules";
import { setRotationDate } from "@/store/actions/system";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { ConfigVar, Tone } from "@/store/types";
import { Button } from "@/ui/Button";
import { DateInput, Select } from "@/ui/Field";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";
import { toast } from "@/ui/Toast";

type T = (typeof system)["en"];

const ROTATION_TONE: Record<RotationRow["status"], Tone> = { ok: "ok", due: "warn", none: "off" };
const SERVER = "production";

/** Missing and required is bad, missing and recommended is a warning, present is OK, the rest is off. */
function varTone(v: ConfigVar): Tone {
  if (v.status === "present") return "ok";
  if (v.need === "required") return "bad";
  return v.need === "recommended" ? "warn" : "off";
}

function needWord(t: T, v: ConfigVar): string {
  if (v.need !== "later") return t.cfg.need[v.need];
  return v.phase === "later" ? t.cfg.needLater : fmt(t.cfg.need.later, { phase: v.phase });
}

/** One form for all secrets: a date field on every row would make the table about the fields. */
function RotationForm({ rows, t }: { rows: RotationRow[]; t: T }) {
  const first = rows.find((r) => r.status === "due") ?? rows[0];
  const [name, setName] = useState(first.name);
  const [day, setDay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const row = rows.find((r) => r.name === name) ?? first;
  const unchanged = day === "" || day === row.rotatedOn;
  const save = () => {
    const result = setRotationDate(row.name, day);
    if (!result.ok) {
      setError(result.code === "too_early" ? t.rot.errEarly : result.code === "future" ? t.rot.errFuture : t.rot.errInvalid);
      return;
    }
    setError(null);
    setDay("");
    toast(t.rot.saved);
  };
  return (
    <form
      className="sy-rotate"
      onSubmit={(e) => {
        e.preventDefault();
        if (!unchanged) save();
      }}
    >
      <Select
        label={t.rot.colName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
      >
        {rows.map((r) => (
          <option key={r.name} value={r.name}>
            {r.name}
          </option>
        ))}
      </Select>
      <DateInput
        label={t.rot.colRecord}
        value={day}
        min="2020-01-01"
        max={DEMO_TODAY}
        error={error}
        onChange={(e) => {
          setDay(e.target.value);
          setError(null);
        }}
      />
      <Button type="submit" variant="outline" disabled={unchanged}>
        {t.rot.save}
      </Button>
    </form>
  );
}

function rotationSentence(t: T, summary: ReturnType<typeof rotationSummary>): string {
  if (summary.due.length) return fmt(t.rot.stateDue, { ids: idList(summary.due) });
  if (!summary.next) return fmt(t.rot.stateUndated, { days: ROTATION_DAYS });
  const vars = { days: ROTATION_DAYS, name: summary.next.name, date: formatDate(summary.next.dueOn as string) };
  return summary.undated.length ? fmt(t.rot.stateOkUndated, { ...vars, undated: idList(summary.undated) }) : fmt(t.rot.stateOk, vars);
}

export function ConfigScreen() {
  const t = useT(system);
  const vars = useStore((s) => s.configVars);
  const rows = useMemo(() => rotationRows(vars, DEMO_TODAY), [vars]);
  const summary = useMemo(() => rotationSummary(rows), [rows]);
  const present = vars.filter((v) => v.status === "present").length;
  const shownVars = useShowMore(vars, 12);
  const headTone: Tone = summary.due.length ? "warn" : summary.next ? "ok" : "off";
  const headWord = summary.due.length ? t.rot.statusName.due : summary.next ? t.rot.statusName.ok : t.rot.statusName.none;

  const varColumns: Column<ConfigVar>[] = [
    { key: "name", header: t.cfg.colName, cell: (v) => <Mono small>{v.name}</Mono> },
    { key: "kind", header: t.cfg.colKind, width: "120px", cell: (v) => t.cfg.kind[v.kind] },
    { key: "need", header: t.cfg.colNeed, width: "150px", cell: (v) => needWord(t, v) },
    { key: "status", header: t.cfg.colStatus, width: "156px", cell: (v) => <Status tone={varTone(v)}>{t.cfg.statusName[v.status]}</Status> },
  ];
  const rotColumns: Column<RotationRow>[] = [
    { key: "name", header: t.rot.colName, cell: (r) => <Mono small>{r.name}</Mono> },
    { key: "rotated", header: t.rot.colRotated, width: "120px", cell: (r) => <Mono small>{r.rotatedOn ? formatDate(r.rotatedOn) : t.none}</Mono> },
    { key: "due", header: t.rot.colDue, width: "120px", cell: (r) => <Mono small>{r.dueOn ? formatDate(r.dueOn) : t.none}</Mono> },
    { key: "status", header: t.rot.colStatus, width: "130px", cell: (r) => <Status tone={ROTATION_TONE[r.status]}>{t.rot.statusName[r.status]}</Status> },
  ];

  return (
    <div className="sy-page">
      <PageHead id="config" title={fmt(t.cfg.title, { present, total: vars.length })} />
      <AreaLine area="config" intro={t.cfg.intro} />
      <SourceGate area="config">
        <Panel icon={RotateCcw} title={t.rot.heading}>
          <p className="type-body sy-intro">{fmt(t.rot.intro, { days: ROTATION_DAYS })}</p>
          {rows.length === 0 ? (
            <p className="type-body mt-3">{t.rot.none}</p>
          ) : (
            <p className="sy-rotstate">
              <Status tone={headTone}>{headWord}</Status>
              <span className="type-body">{rotationSentence(t, summary)}</span>
            </p>
          )}
          {rows.length ? <RotationForm rows={rows} t={t} /> : null}
          {rows.length ? (
          <Table
            columns={rotColumns}
            rows={rows}
            rowKey={(r) => r.name}
            caption={t.rot.heading}
            phoneRow={(r) => (
              <div className="sy-prow">
                <div className="sy-prow-top">
                  <Mono small>{r.name}</Mono>
                  <Status tone={ROTATION_TONE[r.status]}>{t.rot.statusName[r.status]}</Status>
                </div>
                <span className="type-small sy-muted">
                  {t.rot.colRotated}: {r.rotatedOn ? formatDate(r.rotatedOn) : t.none} · {t.rot.colDue}: {r.dueOn ? formatDate(r.dueOn) : t.none}
                </span>
              </div>
            )}
          />
          ) : null}
        </Panel>
        <Panel icon={SlidersHorizontal} title={t.cfg.variables} aside={<span className="type-mono-s sy-muted">{`${fmt(t.cfg.server, { env: SERVER })} · ${fmt(t.cfg.summary, { present, total: vars.length })}`}</span>} plain>
          <Table
            columns={varColumns}
            rows={shownVars.shown}
            rowKey={(v) => v.name}
            caption={t.cfg.variables}
            phoneRow={(v) => (
              <div className="sy-prow">
                <Mono small>{v.name}</Mono>
                <div className="sy-prow-top">
                  <span className="type-small sy-muted">
                    {t.cfg.kind[v.kind]} · {needWord(t, v)}
                  </span>
                  <Status tone={varTone(v)}>{t.cfg.statusName[v.status]}</Status>
                </div>
              </div>
            )}
          />
          {shownVars.more}
        </Panel>
      </SourceGate>
    </div>
  );
}

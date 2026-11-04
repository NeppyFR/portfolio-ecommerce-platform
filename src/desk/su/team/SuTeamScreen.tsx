"use client";

import { KeyRound, ShieldUser } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/desk/shell/Avatar";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { superuser as dict } from "@/i18n/dict/superuser";
import { formatDate } from "@/lib/format";
import { rotationRows, type RotationRow } from "@/lib/security-rules";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Profile } from "@/store/types";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";
import "@/desk/settings/people.css";
import { SuCard, useOwnerName } from "../parts";
import { attemptStats, runningSessions, signedInCount } from "../sessions";
import "../su.css";

type T = typeof dict.en;
type Row = { profile: Profile; name: string; role: string; on: boolean; lastSignIn: string | null; signedIn: number };

const SHARED_VAR = "ADMIN_PASSWORD_HASH";
const SUPER_VAR = "ADMIN_OWNER_PASSWORD_HASH";

function PasswordCard({ icon, title, first, row, steps, t }: { icon: typeof KeyRound; title: string; first: string; row: RotationRow | undefined; steps: string[]; t: T }) {
  return (
    <SuCard icon={icon} title={title}>
      <p className="type-small">{first}</p>
      <div className="su-card-lines">
        {row ? <Status tone={row.status === "due" ? "warn" : "ok"}>{t.pw.configured}</Status> : <Status tone="warn">{t.pw.notSet}</Status>}
        <p className="su-faint">{t.pw.cost}</p>
        {row?.rotatedOn ? <p>{fmt(t.pw.rotated, { day: formatDate(row.rotatedOn) })}</p> : <p className="su-faint">{t.pw.notRecorded}</p>}
        {row?.dueOn ? <p className={row.status === "due" ? "su-amber" : "su-faint"}>{fmt(row.status === "due" ? t.pw.due : t.pw.nextDue, { day: formatDate(row.dueOn) })}</p> : null}
      </div>
      <details className="su-howto">
        <summary>{t.pw.howTo}</summary>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
    </SuCard>
  );
}

export function SuTeamScreen() {
  const t = useT(dict);
  const lang = useLang();
  const owner = useOwnerName();
  const team = useStore((s) => s.team);
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const signIns = useStore((s) => s.signIns);
  const configVars = useStore((s) => s.configVars);

  const running = useMemo(() => runningSessions({ sessions, profile }), [sessions, profile]);
  const lastSuper = useMemo(() => attemptStats(signIns, DEMO_NOW_MS).lastSuper, [signIns]);
  const rotation = useMemo(() => rotationRows(configVars, DEMO_TODAY), [configVars]);

  const rows: Row[] = [
    ...team.map((m) => ({ profile: m.profile, name: m.name, role: lang === "de" ? m.roleDe : m.roleEn, on: m.isActive, lastSignIn: m.lastSignInAt, signedIn: signedInCount(running, m.profile) })),
    { profile: "superUser" as const, name: "superUser", role: t.team.superRole, on: true, lastSignIn: lastSuper, signedIn: signedInCount(running, "superUser") },
  ];

  const passwordWord = (row: Row) => (row.profile === "superUser" ? t.team.pwSu : t.team.pwNone);
  const signedIn = (row: Row) =>
    row.signedIn > 0 ? (
      <Link className="pp-link su-mono" href="/desk/su/security/">
        {row.signedIn}
      </Link>
    ) : (
      <span className="su-mono su-faint">0</span>
    );
  const status = (row: Row) => <Status tone={row.on ? "ok" : "warn"}>{row.on ? t.team.on : t.team.off}</Status>;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t.team.col.name,
      cell: (row) => (
        <span className="su-who">
          <Avatar profile={row.profile} />
          <b style={{ fontWeight: 500 }}>{row.name}</b>
        </span>
      ),
    },
    { key: "role", header: t.team.col.role, cell: (row) => row.role || "–" },
    { key: "status", header: t.team.col.status, width: "96px", cell: status },
    { key: "password", header: t.team.col.password, cell: (row) => <span className="su-mono">{passwordWord(row)}</span> },
    { key: "last", header: t.team.col.lastSignIn, cell: (row) => <span className="su-mono">{row.lastSignIn ? formatDate(row.lastSignIn) : t.team.never}</span> },
    { key: "signedIn", header: t.team.col.signedIn, align: "right", cell: signedIn },
  ];

  return (
    <div className="pp-page">
      <PageHead id="su-team" title={t.team.title} />
      <p className="su-intro type-body pp-prose">
        {fmt(t.team.intro, { owner })}{" "}
        <Link className="pp-link" href="/desk/settings/team/">
          {t.team.edit}
        </Link>
      </p>

      <section className="pp-panel su-table-panel" aria-label={t.team.caption}>
        <Table
          columns={columns}
          rows={rows}
          rowKey={(row) => row.profile}
          caption={t.team.caption}
          phoneRow={(row) => (
            <div className="su-card-lines">
              <div className="su-person-top">
                <span className="su-who">
                  <Avatar profile={row.profile} />
                  <b style={{ fontWeight: 500 }}>{row.name}</b>
                </span>
                {status(row)}
              </div>
              <p className="su-faint">{row.role || "–"}</p>
              <p className="su-mono">
                {t.team.col.password}: {passwordWord(row)}
              </p>
              <p className="su-mono">
                {t.team.col.lastSignIn}: {row.lastSignIn ? formatDate(row.lastSignIn) : t.team.never} · {t.team.col.signedIn}: {signedIn(row)}
              </p>
            </div>
          )}
        />
      </section>

      <h2 className="type-h3 su-section-head">{t.pw.title}</h2>
      <p className="type-small su-faint pp-prose mt-1">{t.pw.lead}</p>
      <div className="su-pw-grid">
        <PasswordCard icon={KeyRound} title={t.pw.sharedTitle} first={t.pw.sharedFirst} row={rotation.find((r) => r.name === SHARED_VAR)} steps={t.pw.sharedSteps} t={t} />
        <PasswordCard icon={ShieldUser} title={t.pw.suTitle} first={t.pw.suFirst} row={rotation.find((r) => r.name === SUPER_VAR)} steps={t.pw.suSteps} t={t} />
      </div>
      <div className="su-after">
        <p>{fmt(t.pw.owner, { owner })}</p>
        <p>{t.pw.partners}</p>
        <p>
          <Link className="pp-link" href="/desk/system/config/">
            {t.pw.configLink}
          </Link>
        </p>
      </div>
    </div>
  );
}

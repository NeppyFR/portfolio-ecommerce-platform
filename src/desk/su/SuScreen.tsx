"use client";

import { Database, History, KeyRound, MonitorSmartphone, ShieldUser, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/desk/shell/Avatar";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useT } from "@/i18n";
import { superuser as dict } from "@/i18n/dict/superuser";
import { isSwitchActive } from "@/lib/features";
import { formatDate, formatDateTime, formatStamp, formatTime } from "@/lib/format";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import { Tl } from "@/ui/Tl";
import "@/desk/settings/people.css";
import { endsSoon, SWITCH_PROFILES } from "./access/access-model";
import { sessionOrders } from "./danger/danger-rules";
import { SuCard, useOwnerName } from "./parts";
import { attemptStats, describeRecent, groupSessions, recentChanges, recentKind, runningSessions, type RecentWords } from "./sessions";
import "./su.css";

const SUPER_MODE_MS = 2 * 60 * 60_000;

export function SuScreen() {
  const t = useT(dict);
  const owner = useOwnerName();
  const switches = useStore((s) => s.featureSwitches);
  const team = useStore((s) => s.team);
  const rawSessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const signIns = useStore((s) => s.signIns);
  const orders = useStore((s) => s.orders);
  const activity = useStore((s) => s.activity);

  const groups = useMemo(() => groupSessions(runningSessions({ sessions: rawSessions, profile })), [rawSessions, profile]);
  const attempts = useMemo(() => attemptStats(signIns, DEMO_NOW_MS), [signIns]);
  const local = useMemo(() => sessionOrders({ orders }).length, [orders]);
  const recent = useMemo(() => recentChanges(activity), [activity]);
  const recentWords: RecentWords = {
    feature: (key) => (t.features as Record<string, { name: string } | undefined>)[key]?.name,
    person: (who) => nameOf(who),
    on: t.access.on,
    off: t.access.off,
    until: t.access.until,
    day: formatDate,
    ...t.recent.details,
  };
  const active = switches.filter((row) => isSwitchActive(row, DEMO_TODAY));
  const nameOf = (person: string | null) => (person === null ? t.sessions.noProfile : (team.find((m) => m.profile === person)?.name ?? person));

  return (
    <div className="pp-page">
      <PageHead id="su" title={t.title} />
      <p className="su-intro type-body pp-prose">{t.intro}</p>
      <div className="su-grid">
        <div className="su-col">
          <section className="pp-panel pp-corner su-card su-status-card">
            <header className="su-card-head">
              <span className="su-card-icon">
                <ShieldUser size={16} aria-hidden="true" />
              </span>
              <h2 className="type-h4">{t.status.title}</h2>
            </header>
            <p className="type-stat">{fmt(t.status.until, { time: formatTime(new Date(DEMO_NOW_MS + SUPER_MODE_MS)) })}</p>
            <p className="type-small">{t.status.note}</p>
            <p className="type-small">
              {fmt(t.status.ownerOpen, { owner })}{" "}
              <Link className="pp-link su-yes" href="/desk/su/team/">
                {t.status.teamLink}
              </Link>
            </p>
          </section>

          <SuCard
            icon={SlidersHorizontal}
            title={t.access.title}
            aside={
              <Link className="pp-link type-small" href="/desk/su/access/">
                {t.access.manage}
              </Link>
            }
          >
            {active.length === 0 ? (
              <p className="type-small su-faint">{t.access.none}</p>
            ) : (
              <div>
                {SWITCH_PROFILES.filter((p) => active.some((row) => row.profile === p)).map((p) => (
                  <p key={p} className="su-switch-row">
                    <b>{nameOf(p)}:</b>
                    {active
                      .filter((row) => row.profile === p)
                      .map((row) => {
                        const soon = row.until !== null && endsSoon(row.until, DEMO_TODAY);
                        return (
                          <span key={row.feature} className={soon ? "su-amber" : undefined}>
                            {fmt(row.on ? t.access.on : t.access.off, { feature: t.features[row.feature].name })}
                            {row.until ? ` ${fmt(t.access.until, { day: formatDate(row.until) })}` : ""}
                            {soon ? ` (${t.access.soon})` : ""}
                          </span>
                        );
                      })}
                  </p>
                ))}
              </div>
            )}
          </SuCard>

          <SuCard icon={History} title={t.recent.title}>
            {recent.length === 0 ? (
              <p className="type-small su-faint">{t.recent.none}</p>
            ) : (
              <ul className="su-recent">
                {recent.map((row) => {
                  const kind = recentKind(row.action);
                  return <Tl key={row.id} label={kind ? t.recent.labels[kind] : row.action} date={formatStamp(row.at)} actor={row.actor} detail={describeRecent(row.detail, recentWords)} tone={kind === "danger" ? "warn" : undefined} />;
                })}
              </ul>
            )}
          </SuCard>
        </div>

        <div className="su-col">
          <SuCard
            icon={MonitorSmartphone}
            title={t.sessions.title}
            aside={
              <Link className="pp-link type-small" href="/desk/su/security/">
                {t.sessions.manage}
              </Link>
            }
          >
            <p className="type-mono-s su-faint">{fmt(t.sessions.namespace, { ns: t.namespace })}</p>
            {groups.length === 0 ? (
              <p className="type-small su-faint">{t.sessions.none}</p>
            ) : (
              <ul className="su-rows">
                {groups.map((g) => (
                  <li key={g.profile ?? "none"}>
                    <span className="su-who">
                      {g.profile ? <Avatar profile={g.profile} /> : null}
                      <span className={g.profile ? undefined : "su-faint"}>{nameOf(g.profile)}</span>
                    </span>
                    <span className="type-mono-s">{fmt(plural(g.sessions.length, t.sessions.one, t.sessions.other), { count: g.sessions.length })}</span>
                  </li>
                ))}
              </ul>
            )}
          </SuCard>

          <SuCard icon={KeyRound} title={t.password.title}>
            <div className="su-card-lines">
              <p className={attempts.day > 0 ? "su-amber" : undefined}>{fmt(t.password.failures, { day: attempts.day, week: attempts.week })}</p>
              <p className="su-faint">{attempts.lastSuper ? fmt(t.password.lastSignIn, { when: formatDateTime(attempts.lastSuper) }) : t.password.never}</p>
            </div>
          </SuCard>

          <SuCard
            icon={Database}
            title={t.demo.title}
            aside={
              <Link className="pp-link type-small" href="/desk/su/danger/">
                {t.demo.link}
              </Link>
            }
          >
            <div className="su-card-lines">
              <p>{t.demo.present}</p>
              {local > 0 ? <p className="su-amber">{fmt(plural(local, t.demo.localOne, t.demo.localOther), { count: local })}</p> : null}
            </div>
          </SuCard>
        </div>
      </div>
    </div>
  );
}

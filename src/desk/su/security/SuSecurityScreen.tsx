"use client";

import { KeyRound, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/desk/shell/Avatar";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useT } from "@/i18n";
import { superuser as dict } from "@/i18n/dict/superuser";
import { formatDateTime, formatStamp } from "@/lib/format";
import { GLOBAL_LIMIT, LOCK_WINDOW_MS, lockStatus } from "@/lib/security-rules";
import { signOutEveryoneElse, signOutProfile, signOutSession } from "@/store/actions/team";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Profile, StaffSession } from "@/store/types";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Input } from "@/ui/Field";
import { toast } from "@/ui/Toast";
import "@/desk/settings/people.css";
import { SIGN_OUT_PHRASE, phraseMatches } from "../danger/danger-rules";
import { PhraseLine, SuCard } from "../parts";
import { attemptStats, deviceLabel, groupSessions, runningSessions } from "../sessions";
import "../su.css";

type T = typeof dict.en;

const signedOutWord = (count: number, t: T) => fmt(plural(count, t.sec.signedOutOne, t.sec.signedOutOther), { count });

function report(result: { ok: true; data: { count: number } } | { ok: false; message: string }, t: T): void {
  toast(result.ok ? signedOutWord(result.data.count, t) : result.message);
}

/** Arm to confirm: the first click turns it red and asks, the second runs it, leaving it disarms it. */
function ArmedButton({ label, sure, onRun }: { label: string; sure: string; onRun: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={armed ? "danger" : "outline"}
      onBlur={() => setArmed(false)}
      onMouseLeave={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onRun();
        } else setArmed(true);
      }}
    >
      <span className="su-arm">
        <span data-on={!armed}>{label}</span>
        <span data-on={armed}>{sure}</span>
      </span>
    </Button>
  );
}

function SessionRow({ session, t }: { session: StaffSession; t: T }) {
  return (
    <li className="su-session">
      <span className="su-session-cell su-session-main">
        <span className="su-session-label">{t.sec.device}</span>
        <span>
          {deviceLabel(session.device, t.sec.deviceWords)} {session.isThisBrowser ? <span className="pp-chip">{t.sec.thisBrowser}</span> : null}
        </span>
      </span>
      <span className="su-session-cell">
        <span className="su-session-label">{t.sec.since}</span>
        <span className="su-mono">{formatStamp(session.startedAt)}</span>
      </span>
      <span className="su-session-cell">
        <span className="su-session-label">{t.sec.ends}</span>
        <span className="su-mono">{formatStamp(session.expiresAt)}</span>
      </span>
      <span className="su-session-cell">
        <span className="su-session-label">{t.sec.session}</span>
        <span className="su-mono">{session.id.slice(0, 8)}</span>
      </span>
      <span className="su-session-action">
        {session.isThisBrowser ? <span className="type-small su-faint">{t.sec.self}</span> : <ArmedButton label={t.sec.signOut} sure={t.sec.signOutSure} onRun={() => report(signOutSession(session.id), t)} />}
      </span>
    </li>
  );
}

export function SuSecurityScreen() {
  const t = useT(dict);
  const sessions = useStore((s) => s.sessions);
  const profile = useStore((s) => s.profile);
  const team = useStore((s) => s.team);
  const signIns = useStore((s) => s.signIns);
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");

  const running = useMemo(() => runningSessions({ sessions, profile }), [sessions, profile]);
  const groups = useMemo(() => groupSessions(running), [running]);
  const others = running.filter((x) => !x.isThisBrowser);
  const lock = useMemo(() => lockStatus(signIns, DEMO_NOW_MS), [signIns]);
  const attempts = useMemo(() => attemptStats(signIns, DEMO_NOW_MS), [signIns]);
  const nameOf = (who: Profile | null) => (who === null ? t.sec.noProfile : (team.find((m) => m.profile === who)?.name ?? who));

  const close = () => {
    setAsking(false);
    setTyped("");
  };

  return (
    <div className="pp-page">
      <PageHead id="su-security" title={t.sec.title} />
      <div className="su-sec-grid">
        <SuCard icon={MonitorSmartphone} title={fmt(t.sec.sessionsTitle, { ns: t.namespace })}>
          {others.length === 0 ? <p className="type-small su-faint">{t.sec.none}</p> : null}
          <div>
            <div className="su-session su-session-head" aria-hidden="true">
              <span>{t.sec.device}</span>
              <span>{t.sec.since}</span>
              <span>{t.sec.ends}</span>
              <span>{t.sec.session}</span>
              <span />
            </div>
            {groups.map((group) => {
              const name = nameOf(group.profile);
              const canSignOut = group.sessions.some((x) => !x.isThisBrowser);
              return (
                <section key={group.profile ?? "none"} className="su-group" aria-label={name}>
                  <header className="su-group-head">
                    <span className="su-group-name">
                      {group.profile ? <Avatar profile={group.profile} /> : null}
                      <span className={group.profile ? undefined : "su-faint"}>{name}</span>
                    </span>
                    {canSignOut ? <ArmedButton label={group.profile ? fmt(t.sec.signOutProfile, { name }) : t.sec.signOutNoProfile} sure={t.sec.signOutSure} onRun={() => report(signOutProfile(group.profile), t)} /> : null}
                  </header>
                  <ul className="su-group-rows">
                    {group.sessions.map((session) => (
                      <SessionRow key={session.id} session={session} t={t} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <div className="su-others">
            <Button variant="danger" disabled={others.length === 0} onClick={() => setAsking(true)}>
              {t.sec.others}
            </Button>
          </div>
        </SuCard>

        <div className="su-col">
          <SuCard icon={KeyRound} title={t.sec.attemptsTitle}>
            <p className={`type-small ${lock.failures >= GLOBAL_LIMIT ? "su-limit-bad" : ""}`}>{fmt(t.sec.global, { used: lock.failures, max: GLOBAL_LIMIT, min: LOCK_WINDOW_MS / 60_000 })}</p>
            {lock.prefixes.length === 0 ? (
              <p className="type-small su-faint">{t.sec.fullNone}</p>
            ) : (
              <ul className="su-stamps su-amber">
                {lock.prefixes.map((key) => (
                  <li key={key}>{fmt(t.sec.fullKey, { key })}</li>
                ))}
              </ul>
            )}
            <div>
              <h3 className="type-label">{t.sec.failures}</h3>
              {attempts.recent.length === 0 ? (
                <p className="type-small su-faint mt-1">{t.sec.failuresNone}</p>
              ) : (
                <ul className="su-stamps mt-1">
                  {attempts.recent.map((attempt) => (
                    <li key={attempt.id}>{formatDateTime(attempt.at)}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="su-note">{t.sec.noClear}</p>
          </SuCard>
          <p className="type-small su-faint">
            {t.sec.links}{" "}
            <Link className="pp-link" href="/desk/system/security/?tab=access">
              {t.sec.linkAccess}
            </Link>
          </p>
        </div>
      </div>

      <Dialog
        open={asking}
        onClose={close}
        title={t.sec.othersTitle}
        danger
        cancelLabel={t.sec.cancel}
        confirmLabel={t.sec.others}
        confirmDisabled={!phraseMatches(typed, SIGN_OUT_PHRASE)}
        onConfirm={() => {
          report(signOutEveryoneElse(), t);
          close();
        }}
      >
        <p className="type-body">{fmt(t.sec.othersBody, { ns: t.namespace })}</p>
        <PhraseLine template={t.sec.phrase} phrase={SIGN_OUT_PHRASE} />
        <Input className="su-phrase-input" label={t.sec.phraseLabel} autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Dialog>
    </div>
  );
}

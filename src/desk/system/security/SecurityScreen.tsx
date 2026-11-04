"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { KeyRound, Lock, LockOpen, LogIn, ShieldCheck, Unlock } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, EmptyBox, Mono, Note, Panel, SourceGate, Stamp, inlineLinkClass, useShowMore } from "@/desk/system/parts/parts";
import { setParams } from "@/lib/routes";
import { loginSummary } from "@/desk/system/rules/lights";
import { fmt, plural, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { formatDateTime } from "@/lib/format";
import { GLOBAL_LIMIT, PER_ADDRESS_LIMIT, lockStatus, type LockStatus } from "@/lib/security-rules";
import { clearLockout, logEveryoneOut, simulateWrongTries } from "@/store/actions/system";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { SignInAttempt, SignInOutcome, State } from "@/store/types";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Table, type Column } from "@/ui/Table";
import { toast } from "@/ui/Toast";

type TabId = "signins" | "access";
type T = (typeof system)["en"];

const ATTEMPTS_SHOWN = 50;
const ATTEMPTS_COUNTED = 200;
const NAMESPACE = "production";
const OUTCOME_CLASS: Record<SignInOutcome, string> = { success: "sy-text-ok", failure: "sy-text-bad", pending: "sy-text-warn" };

const LAYERS = ["host", "proxy", "recheck", "rls", "secret"] as const;

function outcomeWord(t: T, outcome: SignInOutcome): string {
  return outcome === "success" ? t.sec.success : outcome === "failure" ? t.sec.failure : t.sec.pending;
}

function LockIcon({ locked }: { locked: boolean }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span className="sy-seclock-icon" data-locked={locked} aria-hidden="true">
      <Icon size={18} />
    </span>
  );
}

function SignInsTab({ state, lock, t }: { state: State; lock: LockStatus; t: T }) {
  const day = loginSummary(state.signIns, DEMO_NOW_MS);
  const tiles: { key: SignInOutcome; value: number }[] = [
    { key: "success", value: day.success },
    { key: "failure", value: day.failure },
    { key: "pending", value: day.pending },
  ];
  const sentence = lock.global ? fmt(t.sec.lockGlobal, { n: lock.failures }) : lock.locked ? fmt(t.sec.lockSome, { count: lock.prefixes.length }) : fmt(t.sec.lockNone, { n: lock.failures });
  return (
    <div className="sy-stack">
      <div className="sy-split">
        <Panel icon={LogIn} title={t.sec.logins}>
          <dl className="sy-counts sy-counts-tight">
            {tiles.map((tile) => (
              <div key={tile.key}>
                <dt className={`type-label ${OUTCOME_CLASS[tile.key]}`}>{outcomeWord(t, tile.key)}</dt>
                <dd className="type-stat">{tile.value}</dd>
              </div>
            ))}
          </dl>
          <Note>{fmt(t.sec.loginsNote, { n: ATTEMPTS_COUNTED, ns: NAMESPACE })}</Note>
        </Panel>
        <Panel icon={KeyRound} title={t.sec.sessions}>
          <p className="type-stat">{state.sessions.length}</p>
          <Note>{t.sec.sessionsNote}</Note>
        </Panel>
      </div>
      <Panel title={t.sec.lock}>
        <div className="sy-seclock">
          <LockIcon locked={lock.locked} />
          <div className="sy-prow">
            <p className="type-body">
              {sentence} {lock.liftsAt ? fmt(t.sec.lockLifts, { at: formatDateTime(lock.liftsAt) }) : null}
            </p>
            <div>
              <button type="button" className={inlineLinkClass} onClick={() => setParams({ tab: "access" })}>
                {t.sec.openAccess}
              </button>
            </div>
          </div>
        </div>
      </Panel>
      <Note>{t.sec.demoNote}</Note>
    </div>
  );
}

function AccessTab({ state, lock, t }: { state: State; lock: LockStatus; t: T }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const attempts = useMemo(() => state.signIns.slice(0, ATTEMPTS_SHOWN), [state.signIns]);
  const shownAttempts = useShowMore(attempts, 12);
  const count = state.sessions.length;

  const lockSentence = lock.global
    ? fmt(t.access.lockedAll, { count: lock.failures })
    : lock.locked
      ? fmt(plural(lock.prefixes.length, t.access.lockedOne, t.access.lockedOther), { count: lock.prefixes.length, list: lock.prefixes.join(", ") })
      : fmt(plural(lock.failures, t.access.notLockedOne, t.access.notLockedOther), { count: lock.failures });

  const clear = () => {
    const result = clearLockout();
    if (!result.ok) {
      toast(t.access.noRecentFailures);
      return;
    }
    toast(fmt(plural(result.data.removed, t.access.clearedOne, t.access.clearedOther), { count: result.data.removed }));
  };
  const simulate = () => {
    const result = simulateWrongTries();
    if (result.ok) toast(t.access.simulated);
  };
  const logout = () => {
    const result = logEveryoneOut();
    setConfirming(false);
    if (!result.ok) return;
    toast(fmt(t.access.logoutDone, { count: result.data.ended }));
    router.push("/desk/enter/");
  };

  const columns: Column<SignInAttempt>[] = [
    { key: "time", header: t.access.time, cell: (a) => <Stamp at={a.at} /> },
    { key: "outcome", header: t.access.outcome, cell: (a) => <span className={`type-label ${OUTCOME_CLASS[a.outcome]}`}>{outcomeWord(t, a.outcome)}</span> },
    { key: "hash", header: t.access.addressHash, cell: (a) => <Mono small>{a.addressHash}</Mono> },
  ];

  return (
    <div className="sy-stack">
      <div className="sy-split">
        <Panel icon={ShieldCheck} title={t.access.howLocked}>
          <ol className="sy-layers">
            {LAYERS.map((layer) => (
              <li key={layer} className="type-body">
                {t.access.layer[layer]}
              </li>
            ))}
          </ol>
          <Note>{fmt(t.access.limit, { perIp: PER_ADDRESS_LIMIT, all: GLOBAL_LIMIT })}</Note>
        </Panel>
        <div className="sy-stack">
          <Panel title={fmt(t.access.lockTitle, { namespace: NAMESPACE })}>
            <div className="sy-seclock">
              <LockIcon locked={lock.locked} />
              <p className="type-body">
                {lockSentence} {lock.liftsAt ? fmt(t.access.liftsAt, { at: formatDateTime(lock.liftsAt) }) : null}
              </p>
            </div>
            <div className="sy-actions">
              <Button variant="outline" onClick={clear} disabled={lock.failures === 0} title={lock.failures === 0 ? t.access.noRecentFailures : undefined}>
                <Unlock size={16} aria-hidden="true" />
                {t.access.clearLockout}
              </Button>
              <Button variant="ghost" onClick={simulate}>
                {t.access.simulate}
              </Button>
            </div>
            <Note>{t.access.simulateNote}</Note>
          </Panel>
          <Panel icon={KeyRound} title={t.access.logoutAll} className="sy-danger">
            <p className="type-body">{fmt(t.access.logoutAllText, { count })}</p>
            <div className="sy-actions">
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {t.access.logoutAll}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
      <Panel title={fmt(plural(attempts.length, t.access.attemptsOne, t.access.attemptsOther), { count: attempts.length })} plain>
        <Table
          columns={columns}
          rows={shownAttempts.shown}
          rowKey={(a) => a.id}
          caption={t.access.outcome}
          empty={<EmptyBox>{t.access.noAttempts}</EmptyBox>}
          phoneRow={(a) => (
            <div className="sy-prow">
              <div className="sy-prow-top">
                <span className={`type-label ${OUTCOME_CLASS[a.outcome]}`}>{outcomeWord(t, a.outcome)}</span>
                <Mono small>{a.addressHash}</Mono>
              </div>
              <span className="type-mono-s sy-muted">{formatDateTime(a.at)}</span>
            </div>
          )}
        />
        {shownAttempts.more}
        <Note>{t.access.hashNote}</Note>
      </Panel>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t.access.logoutAllTitle} confirmLabel={t.access.logoutAll} cancelLabel={t.access.cancel} danger onConfirm={logout}>
        <p className="type-body">{t.access.logoutAllDescription}</p>
        {count > 0 ? <p className="type-small sy-muted mt-2">{fmt(t.access.logoutAllSessions, { count })}</p> : null}
      </Dialog>
    </div>
  );
}

export function SecurityScreen() {
  const t = useT(system);
  const state = useStore((s) => s);
  const params = useSearchParams();
  const tab: TabId = params.get("tab") === "access" ? "access" : "signins";
  const lock = useMemo(() => lockStatus(state.signIns, DEMO_NOW_MS), [state.signIns]);
  const dayFailures = useMemo(() => loginSummary(state.signIns, DEMO_NOW_MS).failure, [state.signIns]);
  const pills = [
    { id: "signins", label: t.sec.tabSignIns, onSelect: () => setParams({ tab: null }) },
    { id: "access", label: t.sec.tabAccess, onSelect: () => setParams({ tab: "access" }) },
  ];
  return (
    <div className="sy-page">
      <PageHead
        id="security"
        title={fmt(t.sec.title, {
          sessions: fmt(plural(state.sessions.length, t.sec.sessionsOne, t.sec.sessionsOther), { n: state.sessions.length }),
          failed: fmt(plural(dayFailures, t.sec.failedOne, t.sec.failedOther), { n: dayFailures }),
        })}
        pills={pills}
        activePill={tab}
      />
      <AreaLine area="security" intro={tab === "access" ? t.access.intro : t.sec.intro} />
      <SourceGate area="security">{tab === "access" ? <AccessTab state={state} lock={lock} t={t} /> : <SignInsTab state={state} lock={lock} t={t} />}</SourceGate>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { CreditCard, Hourglass, PackageCheck, ShoppingCart, Undo2, Webhook } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, EmptyBox, FactPanel, Mono, Note, Panel, SectionHead, SourceGate, useShowMore, Stamp } from "@/desk/system/parts/parts";
import { gapLight, holdsLight, isLateRelease, latestCheck, releasesLight, whenOf } from "@/desk/system/rules/lights";
import { fmt, plural, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { ACCOUNT_ID } from "@/lib/brand";
import { formatChf, formatDateTime } from "@/lib/format";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import type { CheckStatus, Hold, HoldRelease, StripeEvent, StripeEventStatus, Tone } from "@/store/types";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";

const OUTCOME_TONE: Record<StripeEventStatus, Tone> = { processed: "ok", duplicate: "off", failed: "bad", pending: "warn" };
const CHECK_TONE: Record<CheckStatus, Tone> = { pass: "ok", warn: "warn", fail: "bad", skip: "off" };
const DAY = 24 * 3_600_000;
const minutesApart = (a: string, b: number) => Math.abs(Math.round((Date.parse(a) - b) / 60_000));

export function PaymentsScreen() {
  const t = useT(system);
  const state = useStore((s) => s);
  const gapCheck = latestCheck(state, "stripe.fulfilment_gap");
  const holds = useMemo(() => [...state.holds].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)), [state.holds]);
  const releases = useMemo(() => [...state.releases].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)).slice(0, 50), [state.releases]);
  const events = useMemo(() => state.stripeEvents.slice(0, 50), [state.stripeEvents]);
  const moreEvents = useShowMore(events, 12);
  const dayReleases = releases.filter((r) => DEMO_NOW_MS - Date.parse(r.releasedAt) < DAY);
  const lastJob = releases.find((r) => r.reason === "expired");
  const count = (status: StripeEventStatus) => events.filter((e) => e.status === status).length;

  const expiresCell = (h: Hold) => {
    const past = Date.parse(h.expiresAt) < DEMO_NOW_MS;
    const min = minutesApart(h.expiresAt, DEMO_NOW_MS);
    return (
      <span className="sy-nowrap">
        <Stamp at={h.expiresAt} />{" "}
        <span className={`type-small ${h.overdue ? "sy-text-warn" : "sy-muted"}`}>({fmt(past ? t.pay.holdPast : t.pay.holdIn, { min })})</span>
      </span>
    );
  };
  const holdCols: Column<Hold>[] = [
    { key: "expires", header: t.pay.colExpires, cell: expiresCell },
    { key: "status", header: t.pay.colStatus, cell: (h) => (h.overdue ? <Status tone="warn">{t.pay.checkoutStatus[h.status]}</Status> : t.pay.checkoutStatus[h.status]) },
    { key: "items", header: t.pay.colItems, align: "right", cell: (h) => <Mono small>{h.units}</Mono> },
    { key: "total", header: t.pay.colTotal, align: "right", cell: (h) => <Mono small>{formatChf(h.totalRappen)}</Mono> },
    { key: "created", header: t.pay.colStarted, cell: (h) => <Stamp at={h.createdAt} /> },
    { key: "env", header: t.pay.colEnv, cell: () => t.pay.envName.production },
    { key: "ref", header: t.pay.colRef, cell: (h) => <Mono small>{h.ref}</Mono> },
  ];
  const delayCell = (r: HoldRelease) => {
    if (r.reason !== "expired") return <span className="sy-muted">{t.none}</span>;
    const min = Math.round((Date.parse(r.releasedAt) - Date.parse(r.expiredAt)) / 60_000);
    return <span className={isLateRelease(r) ? "sy-text-warn" : undefined}>{fmt(t.pay.delay, { min })}</span>;
  };
  const releaseCols: Column<HoldRelease>[] = [
    { key: "released", header: t.pay.colReleased, cell: (r) => <Stamp at={r.releasedAt} /> },
    { key: "why", header: t.pay.colWhy, cell: (r) => t.pay.reason[r.reason] },
    { key: "delay", header: t.pay.colDelay, cell: delayCell },
    { key: "items", header: t.pay.colItems, align: "right", cell: (r) => <Mono small>{r.units}</Mono> },
    { key: "total", header: t.pay.colTotal, align: "right", cell: (r) => <Mono small>{formatChf(r.totalRappen)}</Mono> },
    { key: "env", header: t.pay.colEnv, cell: () => t.pay.envName.production },
    { key: "ref", header: t.pay.colRef, cell: (r) => <Mono small>{r.ref}</Mono> },
  ];
  const eventCols: Column<StripeEvent>[] = [
    { key: "at", header: t.pay.colReceived, cell: (e) => <Stamp at={e.createdAt} /> },
    { key: "type", header: t.pay.colType, cell: (e) => <Mono small>{e.type}</Mono> },
    { key: "outcome", header: t.pay.colOutcome, cell: (e) => <Status tone={OUTCOME_TONE[e.status]}>{t.pay.outcome[e.status]}</Status> },
    { key: "env", header: t.pay.colEnv, cell: () => t.pay.envName[state.stripeEvents[0]?.env ?? "production"] },
    { key: "mode", header: t.pay.colMode, cell: () => t.pay.modeTest },
  ];

  return (
    <div className="sy-page">
      <PageHead
        id="payments"
        title={fmt(t.pay.title, {
          holds: fmt(plural(holds.length, t.pay.holdsOpenOne, t.pay.holdsOpenOther), { n: holds.length }),
          webhooks: fmt(plural(count("failed"), t.pay.webhooksFailedOne, t.pay.webhooksFailedOther), { n: count("failed") }),
        })}
      />
      <AreaLine area="payments" intro={t.pay.intro} />
      <SourceGate area="payments">
        <div className="sy-two">
          <FactPanel
            icon={CreditCard}
            title={t.pay.testMode}
            facts={[
              { label: t.pay.colMode, value: <Status tone="ok">{t.pay.testModeTest}</Status>, wide: true },
              { label: t.pay.account, value: <Mono>{ACCOUNT_ID}</Mono> },
            ]}
          />
          <FactPanel icon={ShoppingCart} title={t.pay.checkout} facts={[{ label: t.pay.colStatus, value: <Status tone="ok">{t.pay.checkoutOn}</Status> }]} />
        </div>

        <section className="sy-panel">
          <SectionHead icon={PackageCheck} title={t.pay.gap} light={gapLight(state)} intro={t.pay.gapIntro} />
          <div className="sy-two">
            <div className="sy-prow">
              <h3 className="type-label mb-1">{t.pay.gapWatchdog}</h3>
              {gapCheck ? (
                <>
                  <div>
                    <Status tone={CHECK_TONE[gapCheck.status]}>{t.pay.checkName[gapCheck.status]}</Status>
                  </div>
                  <span className="type-body">{gapCheck.reason}</span>
                  <span className="type-small sy-muted">{fmt(t.pay.gapRan, { when: whenOf(gapCheck.run.startedAt, DEMO_NOW_MS) })}</span>
                </>
              ) : (
                <p className="type-body">{t.pay.gapNever}</p>
              )}
            </div>
            <div className="sy-prow">
              <h3 className="type-label mb-1">{t.pay.gapDb}</h3>
              <EmptyBox>{t.pay.gapNone}</EmptyBox>
            </div>
          </div>
        </section>

        <section className="sy-panel">
          <SectionHead icon={Hourglass} title={t.pay.holds} light={holdsLight(state)} intro={t.pay.holdsIntro} />
          <Table
            columns={holdCols}
            className="sy-hide-5 sy-hide-6"
            rows={holds}
            rowKey={(h) => h.id}
            caption={t.pay.holds}
            empty={<EmptyBox>{t.pay.holdsEmpty}</EmptyBox>}
            phoneRow={(h) => (
              <div className="sy-prow">
                <div className="sy-prow-top">
                  <Mono small>{h.ref}</Mono>
                  <Mono small>{formatChf(h.totalRappen)}</Mono>
                </div>
                <span className="type-small">{h.overdue ? <Status tone="warn">{t.pay.checkoutStatus[h.status]}</Status> : t.pay.checkoutStatus[h.status]}</span>
                <span className="type-small sy-muted">{expiresCell(h)}</span>
              </div>
            )}
          />
        </section>

        <section className="sy-panel">
          <SectionHead icon={Undo2} title={t.pay.releases} light={releasesLight(state, DEMO_NOW_MS)} intro={t.pay.releasesIntro} />
          <p className="type-small sy-muted">
            {fmt(t.pay.releasesDay, {
              expired: dayReleases.filter((r) => r.reason === "expired").length,
              cancelled: dayReleases.filter((r) => r.reason === "cancelled").length,
              failed: dayReleases.filter((r) => r.reason === "failed").length,
            })}
          </p>
          <p className="type-small sy-muted mb-2">{lastJob ? fmt(t.pay.releasesLastJob, { when: whenOf(lastJob.releasedAt, DEMO_NOW_MS) }) : t.pay.releasesLastJobNone}</p>
          <Table
            columns={releaseCols}
            className="sy-hide-6"
            rows={releases}
            rowKey={(r) => r.id}
            caption={t.pay.releases}
            empty={<EmptyBox>{t.pay.releasesEmpty}</EmptyBox>}
            phoneRow={(r) => (
              <div className="sy-prow">
                <div className="sy-prow-top">
                  <span className="type-small">{t.pay.reason[r.reason]}</span>
                  <Mono small>{formatChf(r.totalRappen)}</Mono>
                </div>
                <span className="type-mono-s sy-muted">
                  {formatDateTime(r.releasedAt)} · {r.ref}
                </span>
              </div>
            )}
          />
        </section>

        <section className="sy-panel">
          <SectionHead icon={Webhook} title={t.pay.events} />
          {events.length === 0 ? (
            <EmptyBox>{t.pay.eventsEmpty}</EmptyBox>
          ) : (
            <>
              <p className="type-small sy-muted mb-2">{fmt(t.pay.eventsSummary, { total: events.length, processed: count("processed"), duplicate: count("duplicate"), failed: count("failed"), pending: count("pending") })}</p>
              <Table
                columns={eventCols}
                className="sy-hide-4 sy-hide-5"
                rows={moreEvents.shown}
                rowKey={(e) => e.id}
                caption={t.pay.events}
                phoneRow={(e) => (
                  <div className="sy-prow">
                    <Mono small>{e.type}</Mono>
                    <div className="sy-prow-top">
                      <span className="type-mono-s sy-muted">{formatDateTime(e.createdAt)}</span>
                      <Status tone={OUTCOME_TONE[e.status]}>{t.pay.outcome[e.status]}</Status>
                    </div>
                  </div>
                )}
              />
              {moreEvents.more}
            </>
          )}
          <Note>{t.pay.note}</Note>
        </section>
      </SourceGate>
    </div>
  );
}

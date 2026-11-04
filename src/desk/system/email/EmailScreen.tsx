"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { History, Inbox, Mail, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { AreaLine, EmptyBox, Facts, Mono, Note, Panel, SourceGate, TabLink, inlineLinkClass, Stamp } from "@/desk/system/parts/parts";
import { staleQueued, whenOf } from "@/desk/system/rules/lights";
import { SEARCH_MAX, filterOutbox, isRetryable, outboxBase, outboxCounts, pageOf, waitingToRender } from "@/desk/system/rules/logs";
import { fmt, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";
import { orderHref, setParams } from "@/lib/routes";
import { retentionProblem, retryEmail, setRetentionDays } from "@/store/actions/system";
import { DEMO_NOW_MS } from "@/store/clock";
import { useStore } from "@/store/core";
import { renderEmailParts } from "@/store/emails";
import { emailHtml } from "@/store/flows";
import type { EmailStatus, EmailTemplate, OutboxEmail, State, Tone } from "@/store/types";
import { Button } from "@/ui/Button";
import { Input, Select } from "@/ui/Field";
import { Pager, usePageSize } from "@/ui/Pager";
import { RuleLine } from "@/ui/RuleLine";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Table, type Column } from "@/ui/Table";
import { toast } from "@/ui/Toast";

type TabId = "overview" | "outbox" | "inbox";
type T = (typeof system)["en"];

const STATUS_TONE: Record<EmailStatus, Tone> = { queued: "warn", rendered: "ok", failed: "bad", skipped: "off" };
const STATUS_ORDER: EmailStatus[] = ["queued", "rendered", "failed", "skipped"];
const RETRY_DELAY_MS = 500;
const PROMPT_VERSION = "2026-12-01.1";
const OPEN_OUTBOX = () => setParams({ tab: "outbox", open: null });
const OPEN_INBOX = () => setParams({ tab: "inbox", open: null });

const sourceWord = (source: string, t: T) => (source === "hourly task" ? t.email.sourceHourly : source);

const asTab = (value: string | null): TabId => (value === "outbox" || value === "inbox" ? value : "overview");

function CountTiles({ state, t }: { state: State; t: T }) {
  const counts = outboxCounts(state.outbox);
  return (
    <dl className="sy-counts">
      {(["all", "queued", "rendered", "sent", "failed", "skipped"] as const).map((key) => (
        <div key={key}>
          <dt className="type-small">{t.email.status[key]}</dt>
          <dd className="type-stat">{counts[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

function OverviewTab({ state, t }: { state: State; t: T }) {
  const ingest = state.inboxIngest;
  return (
    <div className="sy-two">
      <Panel icon={Mail} title={t.email.outbox}>
        <Facts items={[{ label: t.email.provider, value: t.email.providerDev }]} />
        <CountTiles state={state} t={t} />
        <Note>{fmt(t.email.staleQueued, { n: staleQueued(state, DEMO_NOW_MS) })}</Note>
        <div className="sy-actions">
          <button type="button" className={inlineLinkClass} onClick={OPEN_OUTBOX}>
            {t.email.openOutbox}
          </button>
        </div>
      </Panel>
      <Panel icon={Inbox} title={t.email.inbox}>
        <Facts
          items={[
            { label: t.email.mailbox, value: fmt(t.email.mailboxCount, { n: ingest.mailboxes }) },
            { label: t.email.lastIngest, value: whenOf(ingest.lastRunAt, DEMO_NOW_MS) },
            { label: t.email.ingestSource, value: sourceWord(ingest.source, t) },
            { label: t.email.ingestInserted, value: <Mono>{ingest.inserted}</Mono> },
            { label: t.email.ingestDuplicates, value: <Mono>{ingest.duplicates}</Mono> },
            { label: t.email.ingestClassified, value: <Mono>{ingest.classified}</Mono> },
            { label: t.email.ingestRejected, value: <Mono>{ingest.rejected}</Mono> },
          ]}
        />
        <div className="sy-actions">
          <button type="button" className={inlineLinkClass} onClick={OPEN_INBOX}>
            {t.email.openInbox}
          </button>
        </div>
      </Panel>
    </div>
  );
}

function OutboxTab({ state, t, selected }: { state: State; t: T; selected: string | null }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<EmailTemplate | "">("");
  const [status, setStatus] = useState<EmailStatus | "">("");
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const base = useMemo(() => outboxBase(state.outbox, { q, type }), [state.outbox, q, type]);
  const counts = useMemo(() => outboxCounts(base), [base]);
  const filtered = useMemo(() => filterOutbox(state.outbox, { q, type, status }), [state.outbox, q, type, status]);
  const current = pageOf(filtered, page, size);
  const isFiltered = q !== "" || type !== "" || status !== "";
  const open = (mail: OutboxEmail) => setParams({ open: mail.id });
  const clear = () => {
    setQ("");
    setType("");
    setStatus("");
    setPage(1);
  };

  const columns: Column<OutboxEmail>[] = [
    { key: "created", header: t.email.fieldCreated, width: "150px", cell: (m) => <Stamp at={m.createdAt} /> },
    { key: "type", header: t.email.typeField, cell: (m) => t.email.type[m.template] },
    { key: "order", header: t.email.fieldOrder, width: "84px", cell: (m) => <Mono small>{m.orderNumber ?? t.none}</Mono> },
    {
      key: "to",
      header: t.email.fieldTo,
      cell: (m) => (
        <div className="sy-stack-cell sy-to">
          <span className="sy-truncate">{m.to}</span>
          <span className="type-mono-s sy-muted">{m.locale.toUpperCase()}</span>
        </div>
      ),
    },
    { key: "status", header: t.email.fieldStatus, width: "136px", cell: (m) => <Status tone={STATUS_TONE[m.status]}>{t.email.status[m.status]}</Status> },
    { key: "provider", header: t.email.fieldProvider, width: "76px", cell: (m) => <Mono small>{m.provider}</Mono> },
    { key: "rendered", header: t.email.fieldRendered, width: "150px", cell: (m) => (m.renderedAt ? <Stamp at={m.renderedAt} /> : <span className="sy-muted">{t.none}</span>) },
  ];

  return (
    <Panel>
        <div className="sy-filters">
          <Input
            label={t.email.search}
            type="search"
            value={q}
            maxLength={SEARCH_MAX}
            placeholder={t.email.searchPlaceholder}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label={t.email.typeField}
            value={type}
            onChange={(e) => {
              setType(e.target.value as EmailTemplate | "");
              setPage(1);
            }}
          >
            <option value="">{t.email.allTypes}</option>
            <option value="order_confirmation">{t.email.type.order_confirmation}</option>
            <option value="shipping_notification">{t.email.type.shipping_notification}</option>
          </Select>
          {isFiltered ? (
            <Button variant="ghost" onClick={clear}>
              {t.email.clear}
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
        <div className="sy-chips" role="group" aria-label={t.email.statusNav}>
          <button
            type="button"
            className="sy-chip"
            aria-pressed={status === ""}
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
          >
            {t.email.status.all} <span className="type-mono-s">{counts.all}</span>
          </button>
          {STATUS_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              className="sy-chip"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {t.email.status[value]} <span className="type-mono-s">{counts[value]}</span>
            </button>
          ))}
        </div>
        <Table
          columns={columns}
          rows={current.rows}
          className="sy-hide-6 sy-hide-7 sy-tight-2"
          rowKey={(m) => m.id}
          caption={t.email.tabOutbox}
          selectedKey={selected}
          onRowClick={open}
          empty={<EmptyBox>{isFiltered ? t.email.emptyFiltered : t.email.empty}</EmptyBox>}
          phoneRow={(m) => (
            <div className="sy-prow">
              <div className="sy-prow-top">
                <span className="type-small" style={{ fontWeight: 500 }}>
                  {t.email.type[m.template]} · {m.orderNumber ?? t.none}
                </span>
                <Status tone={STATUS_TONE[m.status]}>{t.email.status[m.status]}</Status>
              </div>
              <span className="type-small sy-wrap">{m.to}</span>
              <span className="type-mono-s sy-muted">
                {formatDateTime(m.createdAt)} · {m.locale.toUpperCase()} · {m.provider}
              </span>
            </div>
          )}
        />
        {filtered.length ? (
          <div className="sy-pagerow">
            <span className="type-small sy-muted">{fmt(t.email.pageOf, { total: filtered.length })}</span>
            {current.pages > 1 ? <Pager page={current.page} pages={current.pages} onPage={setPage} /> : null}
          </div>
        ) : null}
    </Panel>
  );
}

function MailSheet({ state, t, openId }: { state: State; t: T; openId: string | null }) {
  const live = openId ? state.outbox.find((m) => m.id === openId) ?? null : null;
  const last = useRef<OutboxEmail | null>(null);
  if (live) last.current = live;
  const mail = live ?? last.current;
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const close = () => setParams({ open: null });
  const retry = (id: string) => {
    setBusy(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setBusy(false);
      const result = retryEmail(id);
      toast(result.ok ? t.email.renderedToast : result.message);
    }, RETRY_DELAY_MS);
  };
  const order = mail?.orderNumber ? state.orders.find((o) => o.orderNumber === mail.orderNumber) : undefined;
  const parts = mail && order ? renderEmailParts(order, mail.template) : null;
  const html = mail?.status === "rendered" ? emailHtml(mail.id) : "";
  const title = mail ? `${t.email.type[mail.template]} · ${mail.orderNumber ?? t.none}` : "";

  return (
    <Sheet open={Boolean(live)} onClose={close} title={title}>
      {mail ? (
        <div className="sy-mailsheet">
          <div className="sy-mailhead">
            <Status tone={STATUS_TONE[mail.status]}>{t.email.status[mail.status]}</Status>
            {isRetryable(mail) ? (
              <Button variant="outline" busy={busy} onClick={() => retry(mail.id)}>
                <RefreshCw size={16} aria-hidden="true" />
                {busy ? t.email.rendering : t.email.retry}
              </Button>
            ) : null}
          </div>
          {isRetryable(mail) ? <RuleLine>{t.email.retryRule}</RuleLine> : null}
          <dl className="sy-mailmeta">
            <div data-wide>
              <dt className="type-small">{t.email.fieldSubject}</dt>
              <dd className="type-body">{mail.status === "rendered" ? mail.subject : t.email.subjectNotRendered}</dd>
            </div>
            <div data-wide>
              <dt className="type-small">{t.email.fieldTo}</dt>
              <dd className="type-body">{mail.to}</dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldLanguage}</dt>
              <dd className="type-body">{mail.locale === "de" ? t.email.german : t.email.english}</dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldOrder}</dt>
              <dd className="type-body">
                {mail.orderNumber ? (
                  <Link href={orderHref(mail.orderNumber)} className="sy-link type-mono">
                    {mail.orderNumber}
                  </Link>
                ) : (
                  t.none
                )}
              </dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldCreated}</dt>
              <dd className="type-mono-s">{formatDateTime(mail.createdAt)}</dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldRendered}</dt>
              <dd className="type-mono-s">{mail.renderedAt ? formatDateTime(mail.renderedAt) : t.none}</dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldSent}</dt>
              <dd className="type-body">{t.email.neverSent}</dd>
            </div>
            <div>
              <dt className="type-small">{t.email.fieldAttempts}</dt>
              <dd className="type-mono-s">{`${mail.provider} · ${mail.attempts}`}</dd>
            </div>
          </dl>
          {mail.error ? (
            <p className="sy-error type-small">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{fmt(t.email.lastError, { error: mail.error })}</span>
            </p>
          ) : null}
          {html ? (
            <>
              <p className="sy-sandbox type-small">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>{t.email.sandbox}</span>
              </p>
              <iframe className="sy-frame" sandbox="" srcDoc={html} title={fmt(t.email.previewOf, { subject: mail.subject })} />
            </>
          ) : mail.status === "skipped" ? (
            <EmptyBox>{t.email.skipped}</EmptyBox>
          ) : (
            <EmptyBox>
              {t.email.notRendered} {t.email.notRenderedRetry}
            </EmptyBox>
          )}
          {parts && mail.status === "rendered" ? (
            <details className="sy-details">
              <summary>{t.email.plainText}</summary>
              <pre>{parts.text}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function RetentionForm({ days, t }: { days: number; t: T }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(days);
  const problem = draft === null ? null : retentionProblem(value);
  const unchanged = value.trim() === String(days);
  const error = problem === "whole" ? t.email.retentionWhole : problem === "min" ? t.email.retentionMin : problem === "max" ? t.email.retentionMax : null;
  const save = () => {
    const result = setRetentionDays(value);
    if (result.ok) {
      setDraft(null);
      toast(fmt(t.email.retentionSaved, { days: result.data }));
    }
  };
  return (
    <form
      className="sy-retention"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem && !unchanged) save();
      }}
    >
      <Input label={t.email.retentionLabel} inputMode="numeric" value={value} error={error} onChange={(e) => setDraft(e.target.value)} />
      <Button type="submit" variant="outline" disabled={Boolean(problem) || unchanged}>
        {t.email.retentionSave}
      </Button>
    </form>
  );
}

function InboxTab({ state, t }: { state: State; t: T }) {
  const ingest = state.inboxIngest;
  return (
      <div className="sy-two">
        <Panel icon={Inbox} title={t.email.mailboxTitle}>
          <p className="type-body">{t.email.mailboxIntro}</p>
          <ul className="sy-mailbox">
            <li>
              <Mono>{SUPPORT_EMAIL}</Mono>
            </li>
          </ul>
        </Panel>
        <Panel icon={Sparkles} title={t.email.modeTitle}>
          <p className="type-body">{t.email.modeExternal}</p>
          <Note>{fmt(t.email.modeNote, { version: PROMPT_VERSION })}</Note>
        </Panel>
        <Panel icon={History} title={t.email.lastRunTitle}>
          <Facts
            items={[
              { label: t.email.lastRunWhen, value: whenOf(ingest.lastRunAt, DEMO_NOW_MS) },
              { label: t.email.lastRunSource, value: sourceWord(ingest.source, t) },
              { label: t.email.lastRunNewKnown, value: <Mono>{`${ingest.inserted} / ${ingest.duplicates}`}</Mono> },
              { label: t.email.lastRunSortedRejected, value: <Mono>{`${ingest.classified} / ${ingest.rejected}`}</Mono> },
            ]}
          />
          <div className="sy-actions">
            <TabLink href="/desk/system/health/">{t.email.lastRunHealth}</TabLink>
          </div>
        </Panel>
        <Panel title={t.email.retentionTitle}>
          <p className="type-body">{fmt(t.email.retentionBody, { days: state.settings.inboxRetentionDays })}</p>
          <RetentionForm days={state.settings.inboxRetentionDays} t={t} />
        </Panel>
      </div>
  );
}

export function EmailScreen() {
  const t = useT(system);
  const state = useStore((s) => s);
  const params = useSearchParams();
  const tab = asTab(params.get("tab"));
  const openId = tab === "outbox" ? params.get("open") : null;
  const mailCounts = useMemo(() => outboxCounts(state.outbox), [state.outbox]);

  const pills = [
    { id: "overview", label: t.email.tabOverview, onSelect: () => setParams({ tab: null, open: null }) },
    { id: "outbox", label: t.email.tabOutbox, onSelect: OPEN_OUTBOX },
    { id: "inbox", label: t.email.tabInbox, onSelect: OPEN_INBOX },
  ];

  return (
    <div className="sy-page">
      <PageHead id="email" title={fmt(t.email.title, { rendered: mailCounts.rendered, failed: mailCounts.failed })} pills={pills} activePill={tab} />
      <AreaLine area="email" intro={tab === "outbox" ? fmt(t.email.outboxIntro, { count: waitingToRender(state.outbox) }) : tab === "inbox" ? t.email.settingsIntro : t.email.intro} />
      <SourceGate area="email">
        {tab === "overview" ? <OverviewTab state={state} t={t} /> : null}
        {tab === "outbox" ? <OutboxTab state={state} t={t} selected={openId} /> : null}
        {tab === "inbox" ? <InboxTab state={state} t={t} /> : null}
        <MailSheet state={state} t={t} openId={openId} />
      </SourceGate>
    </div>
  );
}

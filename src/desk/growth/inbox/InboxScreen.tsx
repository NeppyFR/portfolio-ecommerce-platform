"use client";

import { Search, Shield, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useT } from "@/i18n";
import { inbox as dict } from "@/i18n/dict/inbox";
import { formatStamp } from "@/lib/format";
import { useStore } from "@/store/core";
import { priorityMailCount } from "@/store/selectors";
import type { InboxMail, Person, StaffMember } from "@/store/types";
import { Avatar } from "@/desk/shell/Avatar";
import { Button } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { Input } from "@/ui/Field";
import { Pager, usePageSize } from "@/ui/Pager";
import { RuleLine } from "@/ui/RuleLine";
import { Sheet } from "@/ui/Sheet";
import { Table, type Column } from "@/ui/Table";
import { Tabs } from "@/ui/Tabs";
import "@/desk/settings/people.css";
import "./inbox.css";
import { MailDetail } from "./MailDetail";
import { setParam, setParams } from "@/lib/routes";
import { inboxStats, INBOX_TABS, isInboxTab, isUnverified, tabCounts, visibleMails } from "./rules";

type T = typeof dict.en;

export function PriorityBadge({ priority, t }: { priority: InboxMail["priority"]; t: T }) {
  return (
    <span className="ib-pri" data-p={priority ?? "none"} title={priority ? t.priorities[priority] : t.noPriority}>
      {priority ?? "–"}
      {priority ? null : <span className="sr-only">{t.noPriority}</span>}
    </span>
  );
}

/** The three markers: amber, and each one carries its word. */
export function Markers({ mail, t }: { mail: InboxMail; t: T }) {
  return (
    <>
      {mail.needsReview ? (
        <span className="ib-marker">
          <span className="ib-review-dot" aria-hidden="true" />
          {t.needsReview}
        </span>
      ) : null}
      {mail.suspectedInjection ? (
        <span className="ib-marker">
          <TriangleAlert size={13} aria-hidden="true" />
          {t.injection}
        </span>
      ) : null}
      {isUnverified(mail) ? (
        <span className="ib-marker">
          <Shield size={13} aria-hidden="true" />
          {t.unverified}
        </span>
      ) : null}
    </>
  );
}

export const summaryOf = (mail: InboxMail, t: T): string => t.summaries[mail.key] ?? mail.summary;

function summaryLine(mail: InboxMail, t: T): string {
  const summary = summaryOf(mail, t);
  if (summary) return summary;
  if (mail.lastError) return fmt(t.notSortedError, { error: mail.lastError, n: mail.attempts });
  return t.notSortedYet;
}

function Assignee({ person, team, t }: { person: Person | null; team: StaffMember[]; t: T }) {
  const member = person ? team.find((m) => m.profile === person) : null;
  if (!person || !member) return <span className="ib-none" aria-label={t.nobody}>–</span>;
  return (
    <span className="pp-avatar-word" title={member.name}>
      <Avatar profile={person} />
      <span className="sr-only">{member.name}</span>
    </span>
  );
}

export function InboxScreen() {
  const t = useT(dict);
  const params = useSearchParams();
  const mails = useStore((s) => s.inbox);
  const ingest = useStore((s) => s.inboxIngest);
  const team = useStore((s) => s.team);
  const priority = useStore(priorityMailCount);

  const tabParam = params.get("tab");
  const tab = isInboxTab(tabParam) ? tabParam : "open";
  const newest = params.get("sort") === "newest";
  const openId = params.get("open");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(1);
  const pageSize = usePageSize();

  /* The sheet keeps its last mail through the closing slide. */
  const [lastId, setLastId] = useState(openId);
  if (openId && openId !== lastId) setLastId(openId);
  const mail = mails.find((m) => m.id === (openId ?? lastId)) ?? null;
  const open = openId !== null && mails.some((m) => m.id === openId);

  const counts = useMemo(() => tabCounts(mails), [mails]);
  const stats = useMemo(() => inboxStats(mails), [mails]);
  const rows = useMemo(() => visibleMails(mails, { tab, query, newest }), [mails, tab, query, newest]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);

  const columns: Column<InboxMail>[] = [
    { key: "priority", header: t.colPriority, width: "76px", cell: (m) => <PriorityBadge priority={m.priority} t={t} /> },
    {
      key: "from",
      header: t.colFrom,
      width: "220px",
      cell: (m) => (
        <span className="ib-from">
          <b>{m.fromName}</b>
          <span title={m.fromEmail}>{m.fromEmail}</span>
        </span>
      ),
    },
    {
      key: "subject",
      header: t.colSubject,
      cell: (m) => (
        <div className="ib-subject">
          <div className="ib-subject-top">
            <span>{m.subject || t.noSubject}</span>
            <Markers mail={m} t={t} />
          </div>
          <p className="ib-summary">{summaryLine(m, t)}</p>
          <p className="ib-subject-cat">{m.category ? t.categories[m.category] : t.noCategory}</p>
        </div>
      ),
    },
    { key: "category", header: t.colCategory, width: "150px", cell: (m) => (m.category ? t.categories[m.category] : <span className="ib-none">{t.noCategory}</span>) },
    { key: "assigned", header: t.colAssigned, width: "96px", cell: (m) => <Assignee person={m.assignee} team={team} t={t} /> },
    { key: "received", header: t.colReceived, align: "right", width: "140px", cell: (m) => <span className="ib-stamp">{formatStamp(m.receivedAt)}</span> },
  ];

  return (
    <div className="pp-page">
      <PageHead
        id="inbox"
        title={fmt(plural(priority, t.titleOne, t.titleOther), { p: priority })}
        rule={<RuleLine>{t.ruleLine}</RuleLine>}
      />

      <dl className="pp-stats ib-stats" aria-label={t.statsLabel}>
        <div className="pp-stat" data-tone={stats.urgent > 0 ? "bad" : undefined}>
          <dt>{t.statUrgent}</dt>
          <dd>{stats.urgent}</dd>
        </div>
        <div className="pp-stat" data-tone={stats.review > 0 ? "warn" : undefined}>
          <dt>{t.statReview}</dt>
          <dd>{stats.review}</dd>
        </div>
        <div className="pp-stat">
          <dt>{t.statNobody}</dt>
          <dd>{stats.nobody}</dd>
        </div>
        <div className="pp-stat">
          <dt>{t.statUnsorted}</dt>
          <dd>{stats.unsorted}</dd>
        </div>
      </dl>

      <section className="pp-panel ib-panel" aria-label={t.tableCaption}>
        <div className="ib-tools">
          <div className="ib-sub type-small">
            <p>{fmt(t.sub, { open: counts.open, unsorted: counts.unsorted })}</p>
            <p className="type-mono-s pp-muted">{fmt(t.lastIngest, { when: formatStamp(ingest.lastRunAt), source: t.sourceHourly })}</p>
          </div>
          <form
            role="search"
            className="ib-search"
            onSubmit={(e) => {
              e.preventDefault();
              setParam("q", query.trim());
            }}
          >
            <Input
              label={t.searchLabel}
              type="search"
              maxLength={60}
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onBlur={() => setParam("q", query.trim())}
            />
            {query ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setParam("q", null);
                }}
              >
                {t.clear}
              </Button>
            ) : (
              <span className="pp-muted" aria-hidden="true" style={{ alignSelf: "center" }}>
                <Search size={16} />
              </span>
            )}
          </form>
          <Button variant="outline" className="ib-toggle" aria-pressed={newest} onClick={() => setParam("sort", newest ? null : "newest")}>
            {t.newestFirst}
          </Button>
        </div>

        <Tabs
          aria-label={t.tabsLabel}
          className="ib-tabs"
          active={tab}
          onChange={(id) => {
            setParams({ tab: id === "open" ? null : id });
            setPage(1);
          }}
          items={INBOX_TABS.map((id) => ({
            id,
            label: (
              <>
                {t.tabs[id]} <span className="ib-count">{counts[id]}</span>
              </>
            ),
          }))}
        />

        <Table
          columns={columns}
          rows={shown}
          rowKey={(m) => m.id}
          caption={t.tableCaption}
          selectedKey={openId}
          onRowClick={(m) => setParam("open", m.id)}
          empty={
            <Empty>
              {query.trim() ? t.emptySearch : t.emptyTab} {fmt(t.lastIngest, { when: formatStamp(ingest.lastRunAt), source: t.sourceHourly })}
            </Empty>
          }
          phoneRow={(m) => (
            <div className="ib-card">
              <div className="ib-card-top">
                <PriorityBadge priority={m.priority} t={t} />
                <b>{m.fromName}</b>
                <Assignee person={m.assignee} team={team} t={t} />
              </div>
              <p className="ib-card-subject">{m.subject || t.noSubject}</p>
              <div className="pp-chips">
                <Markers mail={m} t={t} />
              </div>
              <div className="ib-card-foot">
                <span>{m.category ? t.categories[m.category] : t.noCategory}</span>
                <span className="ib-stamp">{formatStamp(m.receivedAt)}</span>
              </div>
            </div>
          )}
        />
        {pages > 1 ? <Pager page={current} pages={pages} onPage={setPage} className="mt-4" /> : null}
      </section>

      <details className="ib-how">
        <summary>{t.howTitle}</summary>
        <p className="type-small pp-muted mt-2 pp-prose">{t.howLead}</p>
        <ol>
          {t.howRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </details>

      <Sheet open={open} onClose={() => setParam("open", null)} title={mail ? mail.subject || t.noSubject : ""}>
        {mail ? <MailDetail key={mail.id} mail={mail} /> : null}
      </Sheet>
    </div>
  );
}

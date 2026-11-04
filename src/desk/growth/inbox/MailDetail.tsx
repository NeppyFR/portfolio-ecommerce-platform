"use client";

import { Paperclip, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { inbox as dict } from "@/i18n/dict/inbox";
import { formatBytes, formatStamp } from "@/lib/format";
import { assignMail, markMailDone, reopenMail, resortMail, subscribeWhy, whyOf } from "@/store/actions/inbox";
import { useStore } from "@/store/core";
import type { InboxAuthResult, InboxCategory, InboxMail, InboxPriority, Person } from "@/store/types";
import { Button } from "@/ui/Button";
import { Input, Select } from "@/ui/Field";
import { RuleLine } from "@/ui/RuleLine";
import { toast } from "@/ui/Toast";
import { Markers, PriorityBadge, summaryOf } from "./InboxScreen";
import { firedRules, INBOX_CATEGORIES, INBOX_PRIORITIES, isUnverified, WHY_MAX_LENGTH } from "./rules";

type T = typeof dict.en;

const checkWord = (result: InboxAuthResult, t: T) => (result === null ? t.notReported : result === "pass" ? t.pass : t.fail);

/** Provenance line: who sorted it, how sure, when, and whether a person has locked it. */
function provenance(mail: InboxMail, t: T): string[] {
  const who = mail.classifiedBy === "Claude (hourly task)" ? t.whoHourly : mail.classifiedBy;
  const parts = [fmt(t.sortedBy, { who })];
  if (mail.confidence !== null) parts.push(fmt(t.confidence, { pct: Math.round(mail.confidence * 100) }));
  if (mail.classifiedAt) parts.push(formatStamp(mail.classifiedAt));
  if (mail.locked) parts.push(t.lockedByPerson);
  return parts;
}

function ResortForm({ mail, t }: { mail: InboxMail; t: T }) {
  const [category, setCategory] = useState<InboxCategory | "">(mail.category ?? "");
  const [priority, setPriority] = useState<InboxPriority>(mail.priority ?? "P2");
  const [why, setWhy] = useState("");
  const low = category === "low_priority";
  const shownPriority = low ? "P3" : priority;
  const changed = category !== "" && (category !== mail.category || shownPriority !== mail.priority || why.trim() !== "");
  return (
    <form
      className="ib-resort"
      onSubmit={(e) => {
        e.preventDefault();
        if (category === "" || !changed) return;
        const result = resortMail(mail.id, { category, priority: shownPriority, why });
        if (result.ok) {
          toast(t.resorted);
          setWhy("");
        } else toast(result.message);
      }}
    >
      <h4 className="type-h4">{t.resortHead}</h4>
      <div className="ib-two">
        <Select label={t.category} value={category} onChange={(e) => setCategory(e.target.value as InboxCategory | "")}>
          {category === "" ? <option value="">{t.choose}</option> : null}
          {INBOX_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </Select>
        <Select label={t.priority} value={shownPriority} disabled={low} hint={low ? t.lowAlwaysP3 : undefined} onChange={(e) => setPriority(e.target.value as InboxPriority)}>
          {INBOX_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t.priorities[p]}
            </option>
          ))}
        </Select>
      </div>
      <Input label={t.why} maxLength={WHY_MAX_LENGTH} value={why} onChange={(e) => setWhy(e.target.value)} />
      <div>
        <Button type="submit" variant="outline" disabled={!changed}>
          {t.saveCategory}
        </Button>
      </div>
    </form>
  );
}

export function MailDetail({ mail }: { mail: InboxMail }) {
  const t = useT(dict);
  const lang = useLang();
  const team = useStore((s) => s.team);
  const why = useSyncExternalStore(subscribeWhy, () => whyOf(mail.id), () => undefined);
  const summary = summaryOf(mail, t);
  const note = t.notes[mail.key] ?? mail.nextActionNote;
  const sorted = mail.category !== null;
  const fired = firedRules(mail);
  const doneName = mail.doneBy ? team.find((m) => m.profile === mail.doneBy)?.name : null;

  return (
    <div className="ib-sheet" lang={lang}>
      <section>
        <div className="pp-chips">
          <PriorityBadge priority={mail.priority} t={t} />
          {mail.category ? <span className="pp-chip">{t.categories[mail.category]}</span> : <span className="pp-chip">{t.noCategory}</span>}
          <Markers mail={mail} t={t} />
          <span className="pp-chip">{t.demoMail}</span>
        </div>
        <p className="ib-sender type-small">
          {mail.fromName} &lt;{mail.fromEmail}&gt; · {formatStamp(mail.receivedAt)}
        </p>
        {mail.suspectedInjection ? (
          <p className="pp-box" data-tone="warn">
            <TriangleAlert size={15} aria-hidden="true" />
            <span>{t.warnInjection}</span>
          </p>
        ) : null}
        {isUnverified(mail) ? (
          <p className="pp-box" data-tone="warn">
            <ShieldAlert size={15} aria-hidden="true" />
            <span>{t.warnUnverified}</span>
          </p>
        ) : null}
      </section>

      <section className="ib-sorted pp-corner">
        <h3 className="type-mono-s">{t.sortedHead}</h3>
        {sorted ? (
          <>
            <p className="type-body-l">{summary}</p>
            {mail.nextAction ? (
              <p className="ib-next">
                {t.next}
                <span>
                  {t.nextActions[mail.nextAction]}
                  {note ? ` · ${note}` : ""}
                </span>
              </p>
            ) : null}
            {why ? <p className="type-small">{fmt(t.whyLine, { why })}</p> : null}
            <p className="type-mono-s ib-prov">
              {provenance(mail, t).map((part, i) => (
                <span key={part}>
                  {i > 0 ? " · " : ""}
                  <span className="ib-prov-part">{part}</span>
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="type-body">{mail.lastError ? fmt(t.unsortedLine, { error: mail.lastError, n: mail.attempts }) : t.unsortedLineNoError}</p>
        )}
        {fired.length ? (
          <ul className="ib-fired" aria-label={t.firedHead}>
            {fired.map((rule) => (
              <li key={rule}>
                <RuleLine>{t.fired[rule]}</RuleLine>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h3 className="type-h4">{t.actionsHead}</h3>
        <div className="ib-assign">
          <Select
            label={t.assignedTo}
            value={mail.assignee ?? ""}
            onChange={(e) => {
              const result = assignMail(mail.id, (e.target.value || null) as Person | null);
              if (result.ok) toast(result.data.assigned ? t.assigned : t.unassigned);
              else toast(result.message);
            }}
          >
            <option value="">{t.nobody}</option>
            {team
              .filter((m) => m.isActive || m.profile === mail.assignee)
              .map((m) => (
                <option key={m.profile} value={m.profile}>
                  {m.name}
                </option>
              ))}
          </Select>
          {mail.status === "done" ? (
            <Button
              variant="outline"
              onClick={() => {
                if (reopenMail(mail.id).ok) toast(t.reopened);
              }}
            >
              {t.reopen}
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (markMailDone(mail.id).ok) toast(t.markedDone);
              }}
            >
              {t.markDone}
            </Button>
          )}
        </div>
        {mail.status === "done" && mail.doneAt ? (
          <p className="type-small ib-done-line">{doneName ? fmt(t.doneBy, { name: doneName, stamp: formatStamp(mail.doneAt) }) : fmt(t.doneAt, { stamp: formatStamp(mail.doneAt) })}</p>
        ) : null}
        <ResortForm mail={mail} t={t} />
      </section>

      <section>
        <h3 className="type-h4">{t.originalHead}</h3>
        <dl className="pp-dl">
          <dt>{t.from}</dt>
          <dd>{mail.fromEmail}</dd>
          <dt>{t.to}</dt>
          <dd>{mail.to}</dd>
          <dt>{t.checks}</dt>
          <dd>{`SPF ${checkWord(mail.spf, t)} · DKIM ${checkWord(mail.dkim, t)} · DMARC ${checkWord(mail.dmarc, t)}`}</dd>
        </dl>
        <pre className="ib-body" tabIndex={0}>
          {mail.body}
        </pre>
        <p className="type-small pp-muted">{t.plainNote}</p>
        {mail.attachments.length ? (
          <>
            <h4 className="type-label">{t.attachments}</h4>
            <ul className="ib-files">
              {mail.attachments.map((a) => (
                <li key={a.name}>
                  <Paperclip size={14} aria-hidden="true" />
                  <span>{a.name}</span>
                  <span>{formatBytes(a.sizeBytes)}</span>
                </li>
              ))}
            </ul>
            <p className="type-small pp-muted">{t.attachmentsNote}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}

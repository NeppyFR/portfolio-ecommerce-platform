"use client";

import "../checklist/work.css";
import "./calendar.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { EVENT_TYPES, FIRST_HOUR, HOUR_PX, LAST_HOUR, MAX_CHIPS, MAX_DOTS, NO_FILTER, blockHeight, blockTop, buildEntries, compareEntries, entriesOn, hhmm, inRange, longDay, longWeekday, monthCount, occursOn, passes, passesPeople, place, relativeDay, shiftWeek, weekDays, weekTitle, type CalendarEntry, type EventDraft, type EventProblem } from "@/desk/work/rules/calendar";
import { personOf } from "@/desk/work/rules/tasks";
import { fmt, useLang, useT } from "@/i18n";
import { calendar } from "@/i18n/dict/calendar";
import { seedRows } from "@/i18n/dict/seed-text";
import { addMonths, monthBounds, monthOf, monthWeeks, shortDay, weekBounds, weekdayIndex, weekdayName } from "@/lib/dates";
import { formatMonth, formatTime } from "@/lib/format";
import { setParam, setParams } from "@/lib/routes";
import { deleteEvent, saveEvent } from "@/store/actions/calendar";
import { identityOf } from "@/store/actions/profile";
import { DEMO_NOW, DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { CalendarEventType, Lang, Person } from "@/store/types";
import { Button, DateInput, Dialog, IconButton, Input, Radio, RuleLine, Segmented, Sheet, Switch, Textarea, toast } from "@/ui";
import { Avatar, AvatarStack, PersonToggles, usePeople } from "../checklist/parts";

type T = typeof calendar.en;
type View = "month" | "week" | "agenda";

const typeStyle = (type: CalendarEventType) => ({ "--wk-type": `var(--wk-type-${type})`, "--wk-type-tint": `var(--wk-type-${type}-tint)` }) as CSSProperties;

const entryTitle = (entry: CalendarEntry, t: T) => (entry.source === "drop" ? fmt(t.launchOf, { drop: entry.title }) : entry.title);

function timeText(entry: CalendarEntry, t: T, lang: Lang) {
  if (entry.allDay) {
    if (entry.lastDay !== entry.day) return `${shortDay(entry.day, lang)} – ${shortDay(entry.lastDay, lang)}`;
    return t.allDay;
  }
  return entry.endMin !== null && entry.startMin !== null ? `${hhmm(entry.startMin)}–${hhmm(entry.endMin)}` : hhmm(entry.startMin ?? 0);
}

function AutoMark({ t }: { t: T }) {
  return (
    <span className="wk-auto" title={t.autoLegend}>
      <Zap size={12} aria-hidden="true" />
      {t.auto}
    </span>
  );
}

function MonthGrid({ month, entries, t, lang, onDay, onEntry }: { month: string; entries: CalendarEntry[]; t: T; lang: Lang; onDay: (day: string) => void; onEntry: (id: string) => void }) {
  const weeks = monthWeeks(month);
  return (
    <div className="wk-month">
      <div className="wk-month-head" aria-hidden="true">
        {weeks[0].map((day) => (
          <span key={day} className="type-mono-s">
            {weekdayName(day, lang)}
          </span>
        ))}
      </div>
      <div className="wk-month-grid">
        {weeks.flat().map((day) => {
          const rows = entriesOn(entries, day);
          const inMonth = monthOf(day) === month;
          const isToday = day === DEMO_TODAY;
          const label = rows.length === 0 ? fmt(t.dayNothing, { date: longDay(day, lang) }) : rows.length === 1 ? fmt(t.dayOne, { date: longDay(day, lang) }) : fmt(t.dayMany, { date: longDay(day, lang), n: rows.length });
          return (
            <div key={day} className="wk-cell" data-out={inMonth ? undefined : "true"} data-weekend={weekdayIndex(day) >= 5 || undefined} data-today={isToday || undefined}>
              <button type="button" className="wk-cell-btn" aria-label={label} onClick={() => onDay(day)} />
              <span className="wk-cell-num" aria-hidden="true">
                {Number(day.slice(8))}
              </span>
              <span className="wk-cell-chips">
                {rows.slice(0, MAX_CHIPS).map((entry) => (
                  <button key={entry.id} type="button" className="wk-evchip" style={typeStyle(entry.type)} onClick={() => onEntry(entry.id)}>
                    {!entry.allDay && entry.startMin !== null ? <span className="wk-evchip-time type-mono-s">{hhmm(entry.startMin)}</span> : null}
                    <span className="wk-evchip-title">{entryTitle(entry, t)}</span>
                  </button>
                ))}
                {rows.length > MAX_CHIPS ? (
                  <button type="button" className="wk-more" onClick={() => onDay(day)}>
                    {fmt(t.more, { n: rows.length - MAX_CHIPS })}
                  </button>
                ) : null}
              </span>
              <span className="wk-cell-dots" aria-hidden="true">
                {rows.slice(0, MAX_DOTS).map((entry) => (
                  <i key={entry.id} style={typeStyle(entry.type)} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A block prints whole lines of its title and keeps its time, so nothing is cut through the middle. */
const BLOCK_PADDING_PX = 5;
const BLOCK_LINE_PX = 15;
const BLOCK_TIME_PX = 17;
const BLOCK_TIME_MIN_PX = 36;

function WeekGrid({ cursor, entries, t, lang, onDay, onEntry }: { cursor: string; entries: CalendarEntry[]; t: T; lang: Lang; onDay: (day: string) => void; onEntry: (id: string) => void }) {
  const days = weekDays(cursor);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const nowMin = (() => {
    const [h, m] = formatTime(DEMO_NOW).split(":").map(Number);
    return h * 60 + m;
  })();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = days.indexOf(DEMO_TODAY);
    const el = scroller.current;
    if (!el || at < 0 || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, 52 + (at * (el.scrollWidth - 52)) / 7 - 40);
  }, [days]);
  return (
    <div className="wk-week-wrap">
      <div className="wk-week-scroll" ref={scroller} tabIndex={0} aria-label={t.scrollHint} role="group">
        <div className="wk-week">
          <div className="wk-week-corner" aria-hidden="true" />
          {days.map((day) => (
            <button key={day} type="button" className="wk-week-day" data-today={day === DEMO_TODAY || undefined} aria-label={longDay(day, lang)} onClick={() => onDay(day)}>
              <span className="type-mono-s">{weekdayName(day, lang)}</span>
              <span className="wk-week-num">{Number(day.slice(8))}</span>
            </button>
          ))}
          <div className="wk-week-alllabel type-mono-s">{t.allDay}</div>
          {days.map((day) => (
            <div key={day} className="wk-week-allcell">
              {entries
                .filter((e) => e.allDay && occursOn(e, day))
                .sort(compareEntries)
                .map((entry) => (
                  <button key={entry.id} type="button" className="wk-evchip" style={typeStyle(entry.type)} onClick={() => onEntry(entry.id)}>
                    <span className="wk-evchip-title">{entryTitle(entry, t)}</span>
                  </button>
                ))}
            </div>
          ))}
          <div className="wk-week-hours" aria-hidden="true" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <span key={h} className="type-mono-s" style={{ top: (h - FIRST_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const timed = entries.filter((e) => !e.allDay && occursOn(e, day));
            return (
              <div key={day} className="wk-week-col" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => (
                  <i key={h} className="wk-week-line" style={{ top: (h - FIRST_HOUR) * HOUR_PX }} />
                ))}
                {place(timed).map(({ item, start, end, lane, lanes }) => {
                  const height = Math.max(blockHeight(start, end) - 2, 20);
                  const showTime = height >= BLOCK_TIME_MIN_PX;
                  const lines = Math.max(1, Math.floor((height - BLOCK_PADDING_PX - (showTime ? BLOCK_TIME_PX : 0)) / BLOCK_LINE_PX));
                  return (
                    <button key={item.id} type="button" className="wk-block" title={entryTitle(item, t)} style={{ ...typeStyle(item.type), top: blockTop(start), height, left: `calc(${(lane / lanes) * 100}% + 1px)`, width: `calc(${100 / lanes}% - 2px)` }} onClick={() => onEntry(item.id)}>
                      <span className="wk-block-title" style={{ WebkitLineClamp: lines }}>
                        {entryTitle(item, t)}
                      </span>
                      {showTime ? <span className="type-mono-s">{hhmm(start)}</span> : null}
                    </button>
                  );
                })}
                {day === DEMO_TODAY && nowMin >= FIRST_HOUR * 60 && nowMin < (LAST_HOUR + 1) * 60 ? <i className="wk-week-now" style={{ top: blockTop(nowMin) }} /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventRow({ entry, t, lang, onOpen }: { entry: CalendarEntry; t: T; lang: Lang; onOpen: (id: string) => void }) {
  const team = useStore((s) => s.team);
  return (
    <li>
      <button type="button" className="wk-evrow" style={typeStyle(entry.type)} onClick={() => onOpen(entry.id)}>
        <span className="wk-evrow-time type-mono-s">{timeText(entry, t, lang)}</span>
        <span className="wk-evrow-main">
          <span className="wk-evrow-title">
            {entryTitle(entry, t)}
            {entry.source !== "manual" ? <AutoMark t={t} /> : null}
          </span>
          <span className="wk-evrow-type type-small">
            <i className="wk-type-dot" aria-hidden="true" />
            {t.types[entry.type]}
          </span>
        </span>
        <span className="wk-evrow-people">
          <AvatarStack people={entry.people} />
          <span className="type-small wk-evrow-names">{entry.people.map((p) => identityOf(p, team).name.split(" ")[0]).join(", ")}</span>
        </span>
      </button>
    </li>
  );
}

function Agenda({ month, entries, t, lang, onOpen, onReset }: { month: string; entries: CalendarEntry[]; t: T; lang: Lang; onOpen: (id: string) => void; onReset: () => void }) {
  const { start, end } = monthBounds(month);
  const [showEarlier, setShowEarlier] = useState(false);
  const days = useMemo(() => {
    const seen = new Map<string, CalendarEntry[]>();
    for (let d = start; d <= end; d = shortAdd(d)) {
      const rows = entriesOn(entries, d);
      if (rows.length) seen.set(d, rows);
    }
    return [...seen.entries()];
  }, [entries, start, end]);
  const isCurrent = month === DEMO_MONTH_KEY;
  const earlier = isCurrent ? days.filter(([d]) => d < DEMO_TODAY) : [];
  const earlierEvents = earlier.reduce((sum, [, rows]) => sum + rows.length, 0);
  const shown = isCurrent && !showEarlier ? days.filter(([d]) => d >= DEMO_TODAY) : days;
  if (days.length === 0) {
    return (
      <div className="wk-empty">
        <h3 className="type-h4">{t.agendaEmpty}</h3>
        <p className="type-body">{t.agendaEmptyHint}</p>
        <Button variant="outline" onClick={onReset}>
          {t.reset}
        </Button>
      </div>
    );
  }
  return (
    <div className="wk-agenda">
      {earlierEvents > 0 ? (
        <button type="button" className="wk-agenda-earlier" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)}>
          {showEarlier ? t.hideEarlier : earlierEvents === 1 ? t.showEarlierOne : fmt(t.showEarlier, { n: earlierEvents })}
        </button>
      ) : null}
      {shown.map(([day, rows]) => {
        const rel = relativeDay(day, DEMO_TODAY);
        return (
          <section key={day} className="wk-agenda-day" data-past={day < DEMO_TODAY || undefined}>
            <header>
              <span className="wk-agenda-num">{Number(day.slice(8))}</span>
              <span className="type-small">{longWeekday(day, lang)}</span>
              {rel.kind === "today" ? <span className="wk-agenda-pill">{t.today}</span> : rel.kind === "tomorrow" ? <span className="wk-agenda-pill">{t.tomorrow}</span> : null}
            </header>
            <ul>
              {rows.map((entry) => (
                <EventRow key={entry.id} entry={entry} t={t} lang={lang} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const DEMO_MONTH_KEY = monthOf(DEMO_TODAY);
const shortAdd = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function EventDetail({ entry, t, lang, onEdit, onClose }: { entry: CalendarEntry; t: T; lang: Lang; onEdit: () => void; onClose: () => void }) {
  const team = useStore((s) => s.team);
  const [confirming, setConfirming] = useState(false);
  const rel = relativeDay(entry.day, DEMO_TODAY);
  const relText = rel.kind === "today" ? t.today : rel.kind === "tomorrow" ? t.tomorrow : rel.kind === "yesterday" ? t.yesterday : rel.kind === "future" ? fmt(t.inDays, { n: rel.n }) : fmt(t.daysAgo, { n: rel.n });
  const whenText = entry.lastDay !== entry.day ? `${longDay(entry.day, lang)} – ${longDay(entry.lastDay, lang)}` : entry.allDay ? `${longDay(entry.day, lang)} · ${t.allDay}` : `${longDay(entry.day, lang)} · ${timeText(entry, t, lang)}`;
  return (
    <div className="wk-form">
      <p className="wk-evtype" style={typeStyle(entry.type)}>
        <i className="wk-type-dot" aria-hidden="true" />
        {t.types[entry.type]}
        {entry.source !== "manual" ? <AutoMark t={t} /> : null}
      </p>
      <section className="wk-dsec">
        <h3 className="type-label">{t.when}</h3>
        <p className="type-body">{whenText}</p>
        <p className="type-small wk-muted">{relText}</p>
      </section>
      <section className="wk-dsec">
        <h3 className="type-label">{t.people}</h3>
        <ul className="wk-dpeople">
          {entry.people.map((p) => (
            <li key={p}>
              <Avatar person={p} size={28} />
              <span className="type-body">{identityOf(p, team).name}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="wk-dsec">
        <h3 className="type-label">{t.notes}</h3>
        <p className="type-body">{entry.notes || <span className="wk-muted">{t.noNotes}</span>}</p>
      </section>
      {entry.source !== "manual" ? (
        <>
          <section className="wk-dsec">
            <h3 className="type-label">{t.linked}</h3>
            {entry.source === "drop" ? (
              <Link className="wk-link" href={`/desk/files/?where=${entry.refId}`}>
                {t.linkDrop}: {entry.title}
              </Link>
            ) : (
              <Link className="wk-link" href={`/desk/checklist/?open=${entry.refId}`}>
                {t.linkTask}
              </Link>
            )}
          </section>
          <div className="wk-autonote">
            <strong className="type-label">{t.addedAuto}</strong>
            <p className="type-small">{entry.source === "drop" ? fmt(t.autoDrop, { drop: entry.title }) : t.autoTask}</p>
          </div>
        </>
      ) : (
        <div className="wk-dactions">
          <Button variant="danger" onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            const result = deleteEvent(entry.id);
            if (result.ok) toast(t.toastDeleted);
            onClose();
          }}>
            <Trash2 size={15} aria-hidden="true" />
            {confirming ? t.deleteForGood : t.deleteEvent}
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" />
            {t.edit}
          </Button>
        </div>
      )}
    </div>
  );
}

const blankDraft = (day: string, me: Person | null): EventDraft => ({ title: "", allDay: false, day, until: "", start: "10:00", end: "11:00", type: "meeting", people: me ? [me] : [], notes: "" });

function draftOf(entry: CalendarEntry): EventDraft {
  return { title: entry.title, allDay: entry.allDay, day: entry.day, until: entry.lastDay !== entry.day ? entry.lastDay : "", start: entry.startMin !== null ? hhmm(entry.startMin) : "10:00", end: entry.endMin !== null ? hhmm(entry.endMin) : "11:00", type: entry.type, people: entry.people, notes: entry.notes };
}

function EventForm({ initial, editId, t, lang, formId, onSaved }: { initial: EventDraft; editId?: string; t: T; lang: Lang; formId: string; onSaved: (entryDay: string, type: CalendarEventType, people: Person[]) => void }) {
  const [d, setD] = useState<EventDraft>(initial);
  const [problem, setProblem] = useState<EventProblem | null>(null);
  const patch = (next: Partial<EventDraft>) => setD((old) => ({ ...old, ...next }));
  const submit = () => {
    const result = saveEvent(d, editId);
    if (result.ok) {
      toast(editId ? t.toastSaved : t.toastAdded);
      onSaved(d.day, d.type, d.people);
    } else {
      setProblem(result.code as EventProblem);
    }
  };
  const err = (keys: EventProblem[]) => (problem && keys.includes(problem) ? t.problems[problem] : null);
  return (
    <form
      id={formId}
      className="wk-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input label={t.fieldTitle} value={d.title} maxLength={160} placeholder={t.titleHint} error={err(["title"])} onChange={(e) => patch({ title: e.target.value })} />
      <Switch label={t.fieldAllDay} checked={d.allDay} onChange={(e) => patch({ allDay: e.target.checked })} />
      <div className="wk-two">
        <DateInput label={t.fieldDate} value={d.day} error={err(["day"])} onChange={(e) => patch({ day: e.target.value })} />
        {d.allDay ? <DateInput label={t.fieldUntil} value={d.until} min={d.day} error={err(["untilBefore", "tooLong"])} onChange={(e) => patch({ until: e.target.value })} /> : null}
      </div>
      {d.allDay ? null : (
        <div className="wk-two">
          <Input label={t.fieldStarts} type="time" step={900} value={d.start} error={err(["times"])} onChange={(e) => patch({ start: e.target.value })} />
          <Input label={t.fieldEnds} type="time" step={900} value={d.end} error={err(["endAfterStart"])} onChange={(e) => patch({ end: e.target.value })} />
        </div>
      )}
      <fieldset className="wk-fieldset">
        <legend className="type-label">{t.fieldType}</legend>
        <div className="wk-typepick">
          {EVENT_TYPES.map((type) => (
            <span key={type} className="wk-typeopt" style={typeStyle(type)} data-on={d.type === type || undefined}>
              <Radio name={`${formId}-type`} value={type} checked={d.type === type} label={t.types[type]} onChange={() => patch({ type })} />
            </span>
          ))}
        </div>
      </fieldset>
      <fieldset className="wk-fieldset">
        <legend className="type-label">{t.fieldPeople}</legend>
        <PersonToggles value={d.people} onChange={(people) => patch({ people })} lang={lang} keep={initial.people} />
        {err(["people"]) ? <p className="ui-field-error" role="alert">{err(["people"])}</p> : null}
      </fieldset>
      <Textarea label={t.fieldNotes} value={d.notes} maxLength={2000} rows={3} placeholder={t.notesHint} onChange={(e) => patch({ notes: e.target.value })} />
    </form>
  );
}

/** Month, Week and Agenda over one list of entries. Week is read-only placed blocks. */
export function CalendarScreen() {
  const t = useT(calendar);
  const lang = useLang();
  const params = useSearchParams();
  const events = useStore((s) => s.calendarEvents);
  const drops = useStore((s) => s.drops);
  const tasks = useStore((s) => s.tasks);
  const profile = useStore((s) => s.profile);
  const team = useStore((s) => s.team);
  const me = personOf(profile);
  const people = usePeople();
  const entries = useMemo(() => seedRows(buildEntries(events, drops, tasks), lang, "title", "notes"), [events, drops, tasks, lang]);

  const rawView = params.get("view");
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:639px)");
    setPhone(mq.matches);
  }, []);
  const view: View = rawView === "month" || rawView === "week" || rawView === "agenda" ? rawView : phone ? "agenda" : "month";

  const [cursor, setCursor] = useState(DEMO_TODAY);
  const [filter, setFilter] = useState(NO_FILTER);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; draft: EventDraft; editId?: string; nonce: number }>({ open: false, draft: blankDraft(DEMO_TODAY, me), nonce: 0 });

  const openId = params.get("open");
  const opened = openId ? entries.find((e) => e.id === openId) ?? null : null;
  const last = useRef<CalendarEntry | null>(null);
  if (opened) last.current = opened;

  const month = monthOf(cursor);
  const range = view === "week" ? weekBounds(cursor) : monthBounds(month);
  const inView = useMemo(() => entries.filter((e) => inRange(e, range.start, range.end)), [entries, range.start, range.end]);
  const shown = useMemo(() => inView.filter((e) => passes(e, filter)), [inView, filter]);
  const typeCounts = useMemo(() => {
    const out: Record<CalendarEventType, number> = { drop: 0, sample: 0, shoot: 0, meeting: 0, legal: 0, campaign: 0, other: 0 };
    inView.filter((e) => passesPeople(e, filter.people)).forEach((e) => {
      out[e.type] += 1;
    });
    return out;
  }, [inView, filter.people]);
  const filtered = filter.people.length > 0 || filter.hidden.length > 0;
  const onlyMine = me !== null && filter.people.length === 1 && filter.people[0] === me;

  const step = (dir: -1 | 1) => {
    if (view === "week") setCursor((c) => shiftWeek(c, dir));
    else setCursor(() => `${addMonths(month, dir)}-01`);
  };
  const setView = (next: View) => {
    if (next === "week" && month === DEMO_MONTH_KEY) setCursor(DEMO_TODAY);
    setParam("view", next);
  };
  const newOn = (day: string) => {
    setDayOpen(null);
    setForm((f) => ({ open: true, draft: blankDraft(day, me), nonce: f.nonce + 1 }));
  };
  const newFromTop = () => newOn(DEMO_TODAY >= range.start && DEMO_TODAY <= range.end ? DEMO_TODAY : range.start);
  const closeEntry = () => setParam("open", null);
  const openEntry = (id: string) => {
    setDayOpen(null);
    setParam("open", id);
  };
  const togglePerson = (p: Person) => setFilter((f) => ({ ...f, people: f.people.includes(p) ? f.people.filter((x) => x !== p) : [...f.people, p] }));

  const dayRows = dayOpen ? entriesOn(entries.filter((e) => passes(e, filter)), dayOpen) : [];
  const count = monthCount(entries, DEMO_MONTH_KEY);

  return (
    <div className="wk-screen">
      <PageHead
        id="calendar"
        title={count === 1 ? t.titleOne : fmt(t.title, { n: count })}
        actions={
          <Button onClick={newFromTop}>
            <Plus size={15} aria-hidden="true" />
            {t.newEvent}
          </Button>
        }
        rule={<RuleLine>{t.planning}</RuleLine>}
      />
      <div className="wk-cal-bar">
        <h2 className="type-h3 wk-cal-title">{view === "week" ? weekTitle(cursor, lang) : formatMonth(month, lang)}</h2>
        <div className="wk-cal-nav">
          <IconButton aria-label={view === "week" ? t.prevWeek : t.prevMonth} onClick={() => step(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </IconButton>
          <Button variant="outline" onClick={() => setCursor(DEMO_TODAY)}>
            {t.today}
          </Button>
          <IconButton aria-label={view === "week" ? t.nextWeek : t.nextMonth} onClick={() => step(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </IconButton>
        </div>
        <Segmented<View> aria-label={t.viewLabel} className="wk-cal-views" value={view} onChange={setView} options={(["month", "week", "agenda"] as const).map((v) => ({ value: v, label: t.views[v] }))} />
      </div>

      <div className="wk-filters">
        <div className="wk-filter-row">
          {me ? <Switch label={t.onlyMine} checked={onlyMine} onChange={(e) => setFilter((f) => ({ ...f, people: e.target.checked ? [me] : [] }))} /> : null}
          <div className="wk-chipscroll" role="group" aria-label={t.peopleLabel}>
            <button type="button" className="wk-fchip" aria-pressed={filter.people.length === 0} onClick={() => setFilter((f) => ({ ...f, people: [] }))}>
              {t.everyone}
            </button>
            {people.map((p) => (
              <button key={p} type="button" className="wk-fchip" aria-pressed={filter.people.includes(p)} onClick={() => togglePerson(p)}>
                <Avatar person={p} size={18} />
                {identityOf(p, team).name.split(" ")[0]}
                {p === me ? ` ${t.you}` : ""}
              </button>
            ))}
          </div>
          <p className="type-small wk-filter-count">
            {fmt(t.shown, { shown: shown.length, total: inView.length })}
            {filtered ? (
              <button type="button" className="wk-linkbtn" onClick={() => setFilter(NO_FILTER)}>
                <RotateCcw size={12} aria-hidden="true" />
                {t.reset}
              </button>
            ) : null}
          </p>
        </div>
        <div className="wk-chipscroll" role="group" aria-label={t.typesLabel} title={t.typesHint}>
          {EVENT_TYPES.map((type) => {
            const hidden = filter.hidden.includes(type);
            return (
              <button key={type} type="button" className="wk-typechip" style={typeStyle(type)} aria-pressed={!hidden} data-hidden={hidden || undefined} onClick={() => setFilter((f) => ({ ...f, hidden: hidden ? f.hidden.filter((x) => x !== type) : [...f.hidden, type] }))}>
                <i className="wk-type-dot" aria-hidden="true" />
                {t.types[type]}
                <span className="type-mono-s">{typeCounts[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {view === "month" ? <MonthGrid month={month} entries={shown} t={t} lang={lang} onDay={setDayOpen} onEntry={openEntry} /> : null}
      {view === "week" ? <WeekGrid cursor={cursor} entries={shown} t={t} lang={lang} onDay={setDayOpen} onEntry={openEntry} /> : null}
      {view === "agenda" ? <Agenda key={month} month={month} entries={shown} t={t} lang={lang} onOpen={openEntry} onReset={() => setFilter(NO_FILTER)} /> : null}

      <p className="type-small wk-legend">
        <Zap size={13} aria-hidden="true" />
        {t.autoLegend}
      </p>

      <Dialog open={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? longDay(dayOpen, lang) : ""} confirmLabel={t.newOnDay} cancelLabel={t.close} onConfirm={() => dayOpen && newOn(dayOpen)}>
        <p className="type-small wk-muted">{dayRows.length === 1 ? t.oneEvent : dayRows.length > 1 ? fmt(t.manyEvents, { n: dayRows.length }) : t.nothingOnDay}</p>
        {dayRows.length ? (
          <ul className="wk-dayrows">
            {dayRows.map((entry) => (
              <EventRow key={entry.id} entry={entry} t={t} lang={lang} onOpen={openEntry} />
            ))}
          </ul>
        ) : null}
      </Dialog>

      <Sheet open={!!opened} onClose={closeEntry} title={last.current ? entryTitle(last.current, t) : ""}>
        {last.current ? (
          <EventDetail
            key={last.current.id}
            entry={last.current}
            t={t}
            lang={lang}
            onClose={closeEntry}
            onEdit={() => {
              const entry = last.current;
              if (!entry) return;
              closeEntry();
              setForm((f) => ({ open: true, draft: draftOf(entry), editId: entry.id, nonce: f.nonce + 1 }));
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={form.open}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        title={form.editId ? t.formEdit : t.formNew}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, open: false }))}>
              {t.cancel}
            </Button>
            <Button type="submit" form="wk-event-form">
              {form.editId ? t.saveChanges : t.addEvent}
            </Button>
          </>
        }
      >
        <EventForm
          key={form.nonce}
          initial={form.draft}
          editId={form.editId}
          formId="wk-event-form"
          t={t}
          lang={lang}
          onSaved={(day, type, saved) => {
            setForm((f) => ({ ...f, open: false }));
            setCursor(day);
            setFilter((f) => ({ people: f.people.length && !saved.some((p) => f.people.includes(p)) ? [] : f.people, hidden: f.hidden.filter((x) => x !== type) }));
            setParams({ open: null });
          }}
        />
      </Sheet>
    </div>
  );
}

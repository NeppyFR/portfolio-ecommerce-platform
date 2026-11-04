"use client";

import "./work.css";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarRange, Check, ChevronDown, ChevronRight, CircleCheck, CornerDownLeft, LayoutList, ListChecks, NotebookPen, Package, Pencil, Plus, Trash2, Undo2, UserRound } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { byDoneAtDesc, byPosition, doneOf, mineGroups, nextMonday, openOf, percentDone, personOf, weekGroups, weekStrip } from "@/desk/work/rules/tasks";
import { fmt, useLang, useT } from "@/i18n";
import { checklist } from "@/i18n/dict/checklist";
import { seedRows, seedText } from "@/i18n/dict/seed-text";
import { addDays, shortDay, weekBounds, weekdayName } from "@/lib/dates";
import { dayKey, formatDate, formatTime } from "@/lib/format";
import { setParam, setParams } from "@/lib/routes";
import { isOverdue, isDueToday, dueState } from "@/lib/task-due";
import { addList, addTask, deleteList, deleteTask, editList, editTask, moveTask, moveTaskList, tickTask } from "@/store/actions/tasks";
import { identityOf } from "@/store/actions/profile";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Lang, Person, Task, TaskList, TaskPriority } from "@/store/types";
import { Button, Dialog, DateInput, Input, RuleLine, Segmented, Select, Sheet, Textarea, toast } from "@/ui";
import { Avatar, AvatarStack, Menu, PanelTile, PersonToggles, PriorityBars, WorkEmpty, usePeople } from "./parts";

type T = typeof checklist.en;
type View = "list" | "mine" | "week";
const VIEW_ICONS = { list: LayoutList, mine: UserRound, week: CalendarRange };

function DueChip({ dueOn, t, lang }: { dueOn: string; t: T; lang: Lang }) {
  const state = dueState(dueOn, DEMO_TODAY);
  const day = shortDay(dueOn, lang);
  const word = state === "overdue" ? fmt(t.overdueChip, { date: day }) : state === "today" ? t.today : state === "tomorrow" ? t.tomorrow : day;
  return (
    <span className="wk-due" data-state={state} title={formatDate(dueOn)}>
      {word}
    </span>
  );
}

function doneWhen(iso: string, t: T, lang: Lang) {
  const day = dayKey(iso);
  const time = formatTime(iso);
  if (day === DEMO_TODAY) return fmt(t.todayAt, { time });
  if (day === addDays(DEMO_TODAY, -1)) return fmt(t.yesterdayAt, { time });
  return fmt(t.dateAt, { date: shortDay(day, lang), time });
}

function TaskRow({ task, t, lang, list, showList, movable, canUp, canDown, onOpen, onDelete, onMoved }: { task: Task; t: T; lang: Lang; list: TaskList | undefined; showList: boolean; movable: boolean; canUp: boolean; canDown: boolean; onOpen: (id: string) => void; onDelete: (task: Task) => void; onMoved: (text: string) => void }) {
  const team = useStore((s) => s.team);
  const drops = useStore((s) => s.drops);
  const li = useRef<HTMLLIElement>(null);
  const done = task.doneAt !== null;
  const dropName = task.dropId && task.dropId !== list?.dropId ? drops.find((d) => d.id === task.dropId)?.name : null;
  const tick = () => {
    const next = li.current?.nextElementSibling ?? li.current?.previousElementSibling;
    const result = tickTask(task.id);
    if (!result.ok) {
      toast(t.failed);
      return;
    }
    toast(fmt(done ? t.toastOpen : t.toastDone, { title: task.title }));
    next?.querySelector<HTMLInputElement>("input[type=checkbox]")?.focus();
  };
  const move = (dir: -1 | 1) => {
    const result = moveTask(task.id, dir);
    if (result.ok) onMoved(fmt(t.moved, { title: task.title, pos: result.data.position, total: result.data.total }));
  };
  const chips = (
    <>
      {showList && list ? <span className="ui-chip wk-chip">{list.name}</span> : null}
      {!done && task.dueOn ? <DueChip dueOn={task.dueOn} t={t} lang={lang} /> : null}
      {dropName ? <span className="ui-chip wk-chip">{dropName}</span> : null}
      {task.notes ? (
        <span className="wk-note-mark" title={task.notes.slice(0, 140)} role="img" aria-label={t.notesMark}>
          <NotebookPen size={14} aria-hidden="true" />
        </span>
      ) : null}
      {done && task.doneAt ? <span className="type-small wk-done-by">{task.doneBy ? fmt(t.doneBy, { name: identityOf(task.doneBy, team).name, when: doneWhen(task.doneAt, t, lang) }) : fmt(t.doneAnon, { when: doneWhen(task.doneAt, t, lang) })}</span> : null}
    </>
  );
  return (
    <li ref={li} className="wk-row" data-done={done || undefined}>
      <label className="wk-tick">
        <input type="checkbox" className="ui-checkbox" checked={done} aria-label={fmt(done ? t.untickLabel : t.tickLabel, { title: task.title })} onChange={tick} />
      </label>
      <div className="wk-row-main">
        <button type="button" className="wk-row-title" onClick={() => onOpen(task.id)}>
          {task.title}
        </button>
        <div className="wk-row-chips">{chips}</div>
      </div>
      <div className="wk-row-side">
        <PriorityBars priority={task.priority} label={t.priorities[task.priority]} />
        {task.assignees.length ? (
          <AvatarStack people={task.assignees} />
        ) : (
          <span className="wk-av-none" title={t.nobody} role="img" aria-label={t.nobody}>
            ?
          </span>
        )}
        <Menu
          label={fmt(t.rowMenu, { title: task.title })}
          items={[
            { label: t.edit, icon: Pencil, onSelect: () => onOpen(task.id) },
            { label: done ? t.markOpen : t.markDone, icon: done ? Undo2 : Check, onSelect: tick },
            ...(movable && !done
              ? [
                  { label: t.moveUp, icon: ArrowUp, disabled: !canUp, onSelect: () => move(-1) },
                  { label: t.moveDown, icon: ArrowDown, disabled: !canDown, onSelect: () => move(1) },
                ]
              : []),
            { label: t.deleteTask, icon: Trash2, danger: true, onSelect: () => onDelete(task) },
          ]}
        />
      </div>
    </li>
  );
}

function DoneSection({ tasks, children, t }: { tasks: Task[]; children: (task: Task) => React.ReactNode; t: T }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <section className="wk-donesec" data-open={open || undefined}>
      <button type="button" className="wk-done-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={`${t.doneToggle}: ${tasks.length}`}>
        <Icon size={16} aria-hidden="true" />
        <CircleCheck size={16} aria-hidden="true" />
        <span>{t.done}</span>
        <span className="wk-count type-mono-s">{tasks.length}</span>
      </button>
      {open ? <ul className="wk-rows">{[...tasks].sort(byDoneAtDesc).map(children)}</ul> : null}
    </section>
  );
}

function AddRow({ list, t }: { list: TaskList; t: T }) {
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = addTask(list.id, text);
    if (result.ok) {
      setText("");
      toast(fmt(t.toastAdded, { list: list.name }));
    } else if (text.trim()) {
      toast(t.failed);
    }
  };
  return (
    <form className="wk-add" onSubmit={submit}>
      <Plus size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor="wk-add-input">
        {t.addPlaceholder}
      </label>
      <input id="wk-add-input" className="wk-add-input" value={text} maxLength={200} placeholder={t.addPlaceholder} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      {text.trim() ? (
        <Button type="submit" variant="outline">
          <CornerDownLeft size={14} aria-hidden="true" />
          {t.add}
        </Button>
      ) : null}
    </form>
  );
}

function ListPanel({ list, tasks, t, lang, canUp, canDown, row, onEditList, onDeleteList }: { list: TaskList; tasks: Task[]; t: T; lang: Lang; canUp: boolean; canDown: boolean; row: (task: Task, extra?: { movable?: boolean; canUp?: boolean; canDown?: boolean }) => React.ReactNode; onEditList: () => void; onDeleteList: () => void }) {
  const drops = useStore((s) => s.drops);
  const open = openOf(tasks).sort(byPosition);
  const done = doneOf(tasks);
  const pct = percentDone(done.length, tasks.length);
  const drop = list.dropId ? drops.find((d) => d.id === list.dropId) : null;
  const people = [...new Set(open.flatMap((task) => task.assignees))];
  const sub = fmt(t.doneOf, { done: done.length, total: tasks.length });
  return (
    <section className="wk-panel" aria-label={list.name}>
      <header className="wk-panel-head f-order">
        <PanelTile icon={list.dropId ? Package : ListChecks} />
        <div className="wk-panel-title">
          <h2 className="type-h3">{list.name}</h2>
          <p className="type-small">
            {sub}
            {drop?.launchOn ? ` · ${fmt(t.launches, { drop: drop.name, date: formatDate(drop.launchOn) })}` : ""}
          </p>
        </div>
        <span className="wk-panel-people">
          <AvatarStack people={people} size={28} />
        </span>
        <span className="wk-pct type-stat">{pct}%</span>
        <Menu
          label={t.listMenu}
          items={[
            { label: t.renameList, icon: Pencil, onSelect: onEditList },
            { label: t.listUp, icon: ArrowUp, disabled: !canUp, onSelect: () => moveTaskList(list.id, -1) },
            { label: t.listDown, icon: ArrowDown, disabled: !canDown, onSelect: () => moveTaskList(list.id, 1) },
            { label: t.deleteList, icon: Trash2, danger: true, onSelect: onDeleteList },
          ]}
        />
      </header>
      <div className="wk-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={fmt(t.percentLabel, { pct })}>
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      {open.length ? (
        <ul className="wk-rows">{open.map((task, i) => row(task, { movable: true, canUp: i > 0, canDown: i < open.length - 1 }))}</ul>
      ) : tasks.length ? (
        <WorkEmpty icon={CircleCheck} title={t.allDoneTitle}>
          {t.allDone}
        </WorkEmpty>
      ) : null}
      <AddRow list={list} t={t} />
      <DoneSection tasks={done} t={t}>
        {(task) => row(task)}
      </DoneSection>
      <span className="sr-only">{lang}</span>
    </section>
  );
}

function MinePanel({ me, tasks, t, lang, row, onLists }: { me: Person | null; tasks: Task[]; t: T; lang: Lang; row: (task: Task) => React.ReactNode; onLists: () => void }) {
  const team = useStore((s) => s.team);
  const mine = useMemo(() => (me ? tasks.filter((task) => task.assignees.includes(me)) : []), [tasks, me]);
  const groups = mineGroups(mine, DEMO_TODAY);
  const open = openOf(mine);
  return (
    <section className="wk-panel" aria-label={t.mineTitle}>
      <header className="wk-panel-head f-order">
        {me ? <Avatar person={me} size={44} /> : <PanelTile icon={UserRound} />}
        <div className="wk-panel-title">
          <h2 className="type-h3">{t.mineTitle}</h2>
          {me ? <p className="type-small">{fmt(t.mineSub, { name: identityOf(me, team).name, n: open.length })}</p> : <p className="type-small">{t.systemProfile}</p>}
        </div>
      </header>
      {groups.map((group) => (
        <section key={group.key} className="wk-group" data-tone={group.key === "overdue" ? "bad" : group.key === "today" ? "warn" : undefined}>
          <h3 className="wk-group-head">
            <span>{t.mineGroups[group.key]}</span>
            <span className="wk-count type-mono-s">{group.tasks.length}</span>
          </h3>
          <ul className="wk-rows">{group.tasks.map((task) => row(task))}</ul>
        </section>
      ))}
      {groups.length === 0 ? (
        mine.length ? (
          <WorkEmpty icon={CircleCheck} title={t.mineDoneTitle}>
            {t.mineDone}
          </WorkEmpty>
        ) : (
          <WorkEmpty
            icon={UserRound}
            title={t.nothingMineTitle}
            action={
              <Button variant="outline" onClick={onLists}>
                {t.openLists}
              </Button>
            }
          >
            {t.nothingMine}
          </WorkEmpty>
        )
      ) : null}
      <DoneSection tasks={doneOf(mine)} t={t}>
        {(task) => row(task)}
      </DoneSection>
      <span className="sr-only">{lang}</span>
    </section>
  );
}

function weekRange(lang: Lang) {
  const { start, end } = weekBounds(DEMO_TODAY);
  const a = shortDay(start, lang).split(", ")[1];
  const b = shortDay(end, lang).split(", ")[1];
  return `${a} – ${b}`;
}

function WeekPanel({ tasks, t, lang, row, onLists }: { tasks: Task[]; t: T; lang: Lang; row: (task: Task) => React.ReactNode; onLists: () => void }) {
  const strip = weekStrip(tasks, DEMO_TODAY);
  const groups = weekGroups(tasks, DEMO_TODAY);
  const max = strip.reduce((m, d) => Math.max(m, d.open), 1);
  const openCount = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  const { start, end } = weekBounds(DEMO_TODAY);
  const doneThisWeek = doneOf(tasks).filter((task) => task.dueOn !== null && task.dueOn >= start && task.dueOn <= end);
  return (
    <section className="wk-panel" aria-label={t.weekTitle}>
      <header className="wk-panel-head f-order">
        <PanelTile icon={CalendarRange} />
        <div className="wk-panel-title">
          <h2 className="type-h3">{t.weekTitle}</h2>
          <p className="type-small">{fmt(t.weekSub, { range: weekRange(lang), n: openCount })}</p>
        </div>
      </header>
      <ol className="wk-strip">
        {strip.map((d) => (
          <li key={d.day} className="wk-strip-day" data-today={d.isToday || undefined} data-past={d.isPast || undefined}>
            <span className="type-mono-s">{weekdayName(d.day, lang)}</span>
            <span className="wk-strip-num">{Number(d.day.slice(8))}</span>
            <span className="wk-strip-bars" aria-label={fmt(t.openCount, { n: d.open })} role="img">
              {d.open === 0 ? (
                <i data-flat="true" />
              ) : (
                Array.from({ length: Math.min(d.open, 4) }, (_, i) => <i key={i} style={{ height: 6 + (10 * d.open) / max }} />)
              )}
            </span>
          </li>
        ))}
      </ol>
      {groups.map((group) => (
        <section key={group.key} className="wk-group" data-tone={group.kind === "overdue" ? "bad" : group.kind === "today" ? "warn" : undefined}>
          <h3 className="wk-group-head">
            <span>
              {group.kind === "overdue" ? t.weekOverdue : group.kind === "today" ? t.today : group.kind === "tomorrow" ? t.tomorrow : group.day ? shortDay(group.day, lang).split(", ")[0] : ""}
              {group.day ? <small className="type-small"> {shortDay(group.day, lang).split(", ")[1]}</small> : null}
            </span>
            <span className="wk-count type-mono-s">{group.tasks.length}</span>
          </h3>
          <ul className="wk-rows">{group.tasks.map((task) => row(task))}</ul>
        </section>
      ))}
      {groups.length === 0 ? (
        <WorkEmpty
          icon={CalendarRange}
          title={t.weekEmptyTitle}
          action={
            <Button variant="outline" onClick={onLists}>
              {t.openLists}
            </Button>
          }
        >
          {t.weekEmpty}
        </WorkEmpty>
      ) : null}
      <DoneSection tasks={doneThisWeek} t={t}>
        {(task) => row(task)}
      </DoneSection>
    </section>
  );
}

function TaskSheet({ task, onClose, t, lang }: { task: Task; onClose: () => void; t: T; lang: Lang }) {
  const lists = seedRows(useStore((s) => s.taskLists), lang, "name");
  const drops = useStore((s) => s.drops);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [assignees, setAssignees] = useState<Person[]>(task.assignees);
  const [dueOn, setDueOn] = useState<string>(task.dueOn ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [listId, setListId] = useState(task.listId);
  const [dropId, setDropId] = useState(task.dropId ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const result = editTask(task.id, { title, notes, assignees, dueOn: dueOn || null, priority, listId, dropId: dropId || null });
    if (result.ok) {
      toast(t.toastApplied);
      onClose();
    } else {
      setError(result.code === "title" ? t.fieldTitle : t.failed);
    }
  };
  return (
    <form
      id="wk-task-form"
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="type-small wk-sheet-sub">{fmt(t.sheetIn, { list: lists.find((l) => l.id === task.listId)?.name ?? "" })}</p>
      <Input label={t.fieldTitle} value={title} maxLength={200} error={error} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label={`${t.fieldNotes} (${t.optional})`} value={notes} maxLength={2000} rows={3} placeholder={t.notesHint} onChange={(e) => setNotes(e.target.value)} />
      <fieldset className="wk-fieldset">
        <legend className="type-label">{t.assigned}</legend>
        <PersonToggles value={assignees} onChange={setAssignees} lang={lang} keep={task.assignees} />
      </fieldset>
      <div className="wk-due-field">
        <DateInput label={`${t.dueDate} (${t.optional})`} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        <div className="wk-quick">
          <Button variant="ghost" onClick={() => setDueOn("")}>
            {t.noDate}
          </Button>
          <Button variant="outline" onClick={() => setDueOn(DEMO_TODAY)}>
            {t.today}
          </Button>
          <Button variant="outline" onClick={() => setDueOn(addDays(DEMO_TODAY, 1))}>
            {t.tomorrow}
          </Button>
          <Button variant="outline" onClick={() => setDueOn(nextMonday(DEMO_TODAY))}>
            {t.nextMonday}
          </Button>
        </div>
      </div>
      <div className="wk-field-block">
        <p className="type-label">{t.priority}</p>
        <Segmented<TaskPriority>
          aria-label={t.priority}
          className="wk-seg-full"
          value={priority}
          onChange={setPriority}
          options={(["high", "normal", "low"] as const).map((p) => ({ value: p, label: t.prioritiesShort[p] }))}
        />
      </div>
      <div className="wk-two">
        <Select label={t.list} value={listId} onChange={(e) => setListId(e.target.value)}>
          {[...lists].sort(byPosition).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select label={`${t.drop} (${t.optional})`} value={dropId} onChange={(e) => setDropId(e.target.value)}>
          <option value="">{t.noDrop}</option>
          {drops.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
    </form>
  );
}

function ListDialog({ open, list, onClose, t, onSaved }: { open: boolean; list: TaskList | null; onClose: () => void; t: T; onSaved: (id: string) => void }) {
  const drops = useStore((s) => s.drops);
  const [name, setName] = useState(list?.name ?? "");
  const [dropId, setDropId] = useState(list?.dropId ?? "");
  const [touched, setTouched] = useState(false);
  const submit = () => {
    setTouched(true);
    const result = list ? editList(list.id, name, dropId || null) : addList(name, dropId || null);
    if (!result.ok) return;
    toast(list ? t.toastListSaved : fmt(t.toastListCreated, { list: result.data.name }));
    onSaved(result.data.id);
  };
  return (
    <Dialog open={open} onClose={onClose} title={list ? t.listDialogEdit : t.listDialogNew} confirmLabel={list ? t.save : t.createList} cancelLabel={t.cancel} onConfirm={submit} confirmDisabled={!name.trim()}>
      <div className="wk-form">
        {list ? null : <p className="type-body">{t.listDialogText}</p>}
        <Input label={t.listName} value={name} maxLength={80} placeholder={t.listNameHint} error={touched && !name.trim() ? t.listName : null} onChange={(e) => setName(e.target.value)} />
        <Select label={`${t.drop} (${t.optional})`} hint={t.listDropHint} value={dropId} onChange={(e) => setDropId(e.target.value)}>
          <option value="">{t.noDrop}</option>
          {drops.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  );
}

/** By list, Mine, Week. Lists at the side on a desktop, chips on a phone. Reordering is by buttons. */
export function ChecklistScreen() {
  const t = useT(checklist);
  const lang = useLang();
  const params = useSearchParams();
  const storedTasks = useStore((s) => s.tasks);
  const storedLists = useStore((s) => s.taskLists);
  const tasks = useMemo(() => seedRows(storedTasks, lang, "title", "notes"), [storedTasks, lang]);
  const lists = useMemo(() => seedRows(storedLists, lang, "name"), [storedLists, lang]);
  const profile = useStore((s) => s.profile);
  const team = useStore((s) => s.team);
  const me = personOf(profile);
  const people = usePeople();

  const rawView = params.get("view");
  const view: View = rawView === "mine" || rawView === "week" ? rawView : "list";
  const sortedLists = useMemo(() => [...lists].sort(byPosition), [lists]);
  const listParam = params.get("list");
  const activeList = sortedLists.find((l) => l.id === listParam) ?? sortedLists[0] ?? null;
  const openId = params.get("open");
  const opened = openId ? tasks.find((task) => task.id === openId) ?? null : null;
  const last = useRef<Task | null>(null);
  if (opened) last.current = opened;

  const [deleteRow, setDeleteRow] = useState<Task | null>(null);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState<{ open: boolean; list: TaskList | null; nonce: number }>({ open: false, list: null, nonce: 0 });
  const [announce, setAnnounce] = useState("");

  const openCount = openOf(tasks).length;
  const overdue = tasks.filter((task) => isOverdue(task, DEMO_TODAY)).length;
  const dueToday = tasks.filter((task) => isDueToday(task, DEMO_TODAY)).length;
  const mineOpen = me ? openOf(tasks).filter((task) => task.assignees.includes(me)).length : 0;
  const weekOpen = weekGroups(tasks, DEMO_TODAY).reduce((sum, g) => sum + g.tasks.length, 0);
  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const maxOpen = people.reduce((m, p) => Math.max(m, openOf(tasks).filter((task) => task.assignees.includes(p)).length), 1);

  const setView = (next: View) => setParams({ view: next === "list" ? null : next, list: null });
  const toLists = () => setView("list");

  const row = (task: Task, extra: { movable?: boolean; canUp?: boolean; canDown?: boolean } = {}, showList = false) => (
    <TaskRow key={task.id} task={task} t={t} lang={lang} list={listsById.get(task.listId)} showList={showList} movable={extra.movable ?? false} canUp={extra.canUp ?? false} canDown={extra.canDown ?? false} onOpen={(id) => setParam("open", id)} onDelete={setDeleteRow} onMoved={setAnnounce} />
  );

  const removingList = deleteListId ? listsById.get(deleteListId) : undefined;
  const removingCount = deleteListId ? tasks.filter((task) => task.listId === deleteListId).length : 0;

  return (
    <div className="wk-screen">
      <PageHead
        id="checklist"
        title={fmt(t.title, { o: openCount, l: overdue })}
        actions={
          <Button variant="outline" onClick={() => setListDialog({ open: true, list: null, nonce: listDialog.nonce + 1 })}>
            <Plus size={15} aria-hidden="true" />
            {t.newList}
          </Button>
        }
      />
      <div className="wk-toolbar">
        <Segmented<View>
          aria-label={t.viewLabel}
          className="wk-views"
          value={view}
          onChange={setView}
          options={(["list", "mine", "week"] as const).map((id) => {
            const Icon = VIEW_ICONS[id];
            const count = id === "mine" ? mineOpen : id === "week" ? weekOpen : null;
            return {
              value: id,
              label: (
                <span className="wk-view-cell">
                  <Icon size={14} aria-hidden="true" />
                  <span className="wk-view-long">{t.views[id]}</span>
                  <span className="wk-view-short">{t.viewsPhone[id]}</span>
                  {count !== null ? <span className="wk-view-count type-mono-s">{count}</span> : null}
                </span>
              ),
            };
          })}
        />
        <p className="wk-summary type-small">
          <span>{fmt(t.summaryOpen, { n: openCount })}</span>
          <span className="wk-sum-bad">
            <span className="wk-dot" aria-hidden="true" />
            {fmt(t.summaryOverdue, { n: overdue })}
          </span>
          <span className="wk-sum-warn">
            <span className="wk-dot" aria-hidden="true" />
            {fmt(t.summaryToday, { n: dueToday })}
          </span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {view === "list" ? (
        <div className="wk-chips" role="group" aria-label={t.lists}>
          {sortedLists.map((list) => {
            const rows = tasks.filter((task) => task.listId === list.id);
            return (
              <button key={list.id} type="button" className="wk-listchip" aria-pressed={list.id === activeList?.id} onClick={() => setParam("list", list.id)}>
                {list.dropId ? <Package size={15} aria-hidden="true" /> : <ListChecks size={15} aria-hidden="true" />}
                <span>{list.name}</span>
                <span className="type-mono-s">
                  {doneOf(rows).length}/{rows.length}
                </span>
              </button>
            );
          })}
          <button type="button" className="wk-listchip" data-new="true" onClick={() => setListDialog({ open: true, list: null, nonce: listDialog.nonce + 1 })}>
            <Plus size={15} aria-hidden="true" />
            {t.newList}
          </button>
        </div>
      ) : null}

      <div className="wk-layout">
        <div className="wk-main">
          {view === "list" ? (
            activeList ? (
              <ListPanel
                key={activeList.id}
                list={activeList}
                tasks={tasks.filter((task) => task.listId === activeList.id)}
                t={t}
                lang={lang}
                canUp={sortedLists[0]?.id !== activeList.id}
                canDown={sortedLists[sortedLists.length - 1]?.id !== activeList.id}
                row={(task, extra) => row(task, extra)}
                onEditList={() => setListDialog({ open: true, list: activeList, nonce: listDialog.nonce + 1 })}
                onDeleteList={() => setDeleteListId(activeList.id)}
              />
            ) : (
              <WorkEmpty
                icon={ListChecks}
                title={t.emptyListsTitle}
                action={
                  <Button onClick={() => setListDialog({ open: true, list: null, nonce: listDialog.nonce + 1 })}>
                    <Plus size={15} aria-hidden="true" />
                    {t.newList}
                  </Button>
                }
              >
                {t.emptyLists}
              </WorkEmpty>
            )
          ) : view === "mine" ? (
            <MinePanel me={me} tasks={tasks} t={t} lang={lang} row={(task) => row(task, {}, true)} onLists={toLists} />
          ) : (
            <WeekPanel tasks={tasks} t={t} lang={lang} row={(task) => row(task, {}, true)} onLists={toLists} />
          )}
        </div>

        <aside className="wk-side" aria-label={t.lists}>
          {view === "list" ? (
            <section className="wk-card wk-side-lists">
              <h2 className="type-h4">{t.lists}</h2>
              <ul className="wk-listrows">
                {sortedLists.map((list) => {
                  const rows = tasks.filter((task) => task.listId === list.id);
                  const done = doneOf(rows).length;
                  const open = rows.length - done;
                  const pct = percentDone(done, rows.length);
                  const Icon = list.dropId ? Package : ListChecks;
                  return (
                    <li key={list.id}>
                      <button type="button" className="wk-listrow" aria-pressed={list.id === activeList?.id} onClick={() => setParam("list", list.id)}>
                        <span className="wk-tile" data-size="sm" aria-hidden="true">
                          <Icon size={16} />
                        </span>
                        <span className="wk-listrow-text">
                          <span className="type-label">{list.name}</span>
                          <span className="type-small">{fmt(t.doneOf, { done, total: rows.length })}</span>
                        </span>
                        {open > 0 ? <span className="wk-count type-mono-s">{open}</span> : null}
                        <span className="wk-bar wk-bar-thin" aria-hidden="true">
                          <span style={{ transform: `scaleX(${pct / 100})` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="ghost" onClick={() => setListDialog({ open: true, list: null, nonce: listDialog.nonce + 1 })}>
                <Plus size={15} aria-hidden="true" />
                {t.newList}
              </Button>
            </section>
          ) : null}
          <section className="wk-card">
            <h2 className="type-h4">{t.perPerson}</h2>
            <ul className="wk-perperson">
              {people.map((person) => {
                const rows = openOf(tasks).filter((task) => task.assignees.includes(person));
                const late = rows.filter((task) => isOverdue(task, DEMO_TODAY)).length;
                return (
                  <li key={person}>
                    <Avatar person={person} size={28} />
                    <span className="wk-pp-name type-label">
                      {identityOf(person, team).name}
                      {person === me ? ` · ${t.you}` : ""}
                    </span>
                    <span className="wk-pp-counts type-small">
                      {late > 0 ? <span className="wk-pp-late">{fmt(t.overdueCount, { n: late })}</span> : null}
                      <span>{fmt(t.openCount, { n: rows.length })}</span>
                    </span>
                    <span className="wk-pp-bar" aria-hidden="true">
                      <span style={{ transform: `scaleX(${rows.length / maxOpen})` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <Sheet
        open={!!opened}
        onClose={() => setParam("open", null)}
        title={t.sheetTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setParam("open", null)}>
              {t.cancel}
            </Button>
            <Button type="submit" form="wk-task-form">
              {t.save}
            </Button>
          </>
        }
      >
        {last.current ? <TaskSheet key={last.current.id} task={last.current} onClose={() => setParam("open", null)} t={t} lang={lang} /> : null}
      </Sheet>

      <ListDialog key={listDialog.nonce} open={listDialog.open} list={listDialog.list} t={t} onClose={() => setListDialog((d) => ({ ...d, open: false }))} onSaved={(id) => {
        setListDialog((d) => ({ ...d, open: false }));
        setParams({ view: null, list: id });
      }} />

      <Dialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title={deleteRow ? fmt(t.deleteTaskTitle, { title: deleteRow.title }) : ""}
        confirmLabel={t.deleteWord}
        cancelLabel={t.cancel}
        danger
        onConfirm={() => {
          if (!deleteRow) return;
          const result = deleteTask(deleteRow.id);
          setDeleteRow(null);
          if (result.ok) toast(fmt(t.toastDeleted, { title: seedText(result.data.title, lang) }));
          if (openId === deleteRow.id) setParam("open", null);
        }}
      >
        <RuleLine>{t.deleteTaskBody}</RuleLine>
      </Dialog>

      <Dialog
        open={!!removingList}
        onClose={() => setDeleteListId(null)}
        title={removingList ? fmt(t.deleteListTitle, { list: removingList.name }) : ""}
        confirmLabel={t.deleteWord}
        cancelLabel={t.cancel}
        danger
        onConfirm={() => {
          if (!deleteListId) return;
          const result = deleteList(deleteListId);
          setDeleteListId(null);
          setParam("list", null);
          if (result.ok) toast(fmt(t.toastListDeleted, { list: seedText(result.data.name, lang) }));
        }}
      >
        <RuleLine>{removingCount === 1 ? t.deleteListBodyOne : fmt(t.deleteListBody, { n: removingCount })}</RuleLine>
      </Dialog>
    </div>
  );
}

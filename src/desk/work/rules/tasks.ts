import { addDays, weekBounds } from "@/lib/dates";
import type { Person, Profile, Task, TaskList, TaskPriority } from "@/store/types";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/** superUser is a system profile, not a person: it has no tasks of its own. */
export const personOf = (profile: Profile): Person | null => (profile === "superUser" ? null : profile);

export const percentDone = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100));

export const openOf = (tasks: Task[]): Task[] => tasks.filter((t) => t.doneAt === null);
export const doneOf = (tasks: Task[]): Task[] => tasks.filter((t) => t.doneAt !== null);

/** Earliest due first, undated last, then high, normal, low. */
export function byDueThenPriority(a: Task, b: Task): number {
  if (a.dueOn !== b.dueOn) {
    if (a.dueOn === null) return 1;
    if (b.dueOn === null) return -1;
    return a.dueOn < b.dueOn ? -1 : 1;
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.position - b.position;
}

/** Newest tick first. */
export const byDoneAtDesc = (a: Task, b: Task): number => (b.doneAt ?? "").localeCompare(a.doneAt ?? "");

export const byPosition = (a: Pick<Task, "position">, b: Pick<Task, "position">): number => a.position - b.position;

export type MineGroupKey = "overdue" | "today" | "week" | "later" | "none";
export const MINE_GROUPS: MineGroupKey[] = ["overdue", "today", "week", "later", "none"];

export function mineGroupOf(task: Pick<Task, "dueOn">, today: string): MineGroupKey {
  if (!task.dueOn) return "none";
  if (task.dueOn < today) return "overdue";
  if (task.dueOn === today) return "today";
  return task.dueOn <= weekBounds(today).end ? "week" : "later";
}

export function mineGroups(tasks: Task[], today: string): { key: MineGroupKey; tasks: Task[] }[] {
  return MINE_GROUPS.map((key) => ({ key, tasks: openOf(tasks).filter((t) => mineGroupOf(t, today) === key).sort(byDueThenPriority) })).filter((g) => g.tasks.length > 0);
}

export type WeekTile = { day: string; open: number; isToday: boolean; isPast: boolean };

/** Monday to Sunday of the week holding `today`, with the open tasks due on each day. */
export function weekStrip(tasks: Task[], today: string): WeekTile[] {
  const { start } = weekBounds(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { day, open: openOf(tasks).filter((t) => t.dueOn === day).length, isToday: day === today, isPast: day < today };
  });
}

export type WeekGroup = { key: string; kind: "overdue" | "today" | "tomorrow" | "day"; day: string | null; tasks: Task[] };

/** Overdue, then one group per remaining day from today to Sunday. Empty groups are dropped. */
export function weekGroups(tasks: Task[], today: string): WeekGroup[] {
  const open = openOf(tasks);
  const { end } = weekBounds(today);
  const groups: WeekGroup[] = [{ key: "overdue", kind: "overdue", day: null, tasks: open.filter((t) => t.dueOn !== null && t.dueOn < today).sort(byDueThenPriority) }];
  for (let day = today; day <= end; day = addDays(day, 1)) {
    groups.push({ key: day, kind: day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : "day", day, tasks: open.filter((t) => t.dueOn === day).sort(byDueThenPriority) });
  }
  return groups.filter((g) => g.tasks.length > 0);
}

/** Moves an open row one step among the open rows of its list. Done rows keep their slots. */
export function moveOpenTask(tasks: Task[], id: string, dir: -1 | 1): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.doneAt !== null) return tasks;
  const rows = tasks.filter((t) => t.listId === task.listId && t.doneAt === null).sort(byPosition);
  const at = rows.findIndex((t) => t.id === id);
  const other = rows[at + dir];
  if (!other) return tasks;
  return tasks.map((t) => (t.id === task.id ? { ...t, position: other.position } : t.id === other.id ? { ...t, position: task.position } : t));
}

export function moveList(lists: TaskList[], id: string, dir: -1 | 1): TaskList[] {
  const sorted = [...lists].sort(byPosition);
  const at = sorted.findIndex((l) => l.id === id);
  const other = sorted[at + dir];
  if (at < 0 || !other) return lists;
  const list = sorted[at];
  return lists.map((l) => (l.id === list.id ? { ...l, position: other.position } : l.id === other.id ? { ...l, position: list.position } : l));
}

export const nextPosition = (rows: { position: number }[]): number => rows.reduce((m, r) => Math.max(m, r.position), 0) + 1;

/** `Next Monday` from `today`: a Monday always gives the Monday after it. */
export const nextMonday = (today: string): string => addDays(weekBounds(today).start, 7);

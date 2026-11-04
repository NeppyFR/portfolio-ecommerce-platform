import { byPosition, moveList as moveListRule, moveOpenTask, nextPosition, personOf } from "@/desk/work/rules/tasks";
import { now } from "../clock";
import { getState, registerReset, update } from "../core";
import { logActivity } from "../flows";
import type { ActionResult, Person, Task, TaskList, TaskPriority } from "../types";

let seq = 0;
registerReset(() => {
  seq = 0;
});
const nextId = (prefix: string) => {
  seq += 1;
  return `${prefix}_new_${seq}`;
};

const NAME_MAX = 80;
const TITLE_MAX = 200;
const NOTES_MAX = 2000;

const refused = (code: string, message: string) => ({ ok: false as const, code, message });

/** Who ticked is always the current profile. superUser is not a person, so its tick is simply unsigned. */
export function tickTask(id: string): ActionResult<Task> {
  const s = getState();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return refused("not_found", "This task is gone.");
  const wasDone = task.doneAt !== null;
  const after: Task = wasDone ? { ...task, doneAt: null, doneBy: null } : { ...task, doneAt: now(), doneBy: personOf(s.profile) };
  update((state) => ({ ...state, tasks: state.tasks.map((t) => (t.id === id ? after : t)) }));
  logActivity({ area: "checklist", action: wasDone ? "reopened" : "done", detail: task.title });
  return { ok: true, data: after };
}

/** A new task inherits the list's drop, priority normal, no date, no assignee, last in the list. */
export function addTask(listId: string, title: string): ActionResult<Task> {
  const clean = title.trim();
  if (!clean) return refused("title", "A task needs a title.");
  if (clean.length > TITLE_MAX) return refused("title", "A task title can be at most 200 characters.");
  const s = getState();
  const list = s.taskLists.find((l) => l.id === listId);
  if (!list) return refused("not_found", "This list is gone.");
  const task: Task = { id: nextId("task"), listId, title: clean, notes: "", assignees: [], priority: "normal", dropId: list.dropId, dueOn: null, doneAt: null, doneBy: null, position: nextPosition(s.tasks.filter((t) => t.listId === listId)), createdAt: now() };
  update((state) => ({ ...state, tasks: [...state.tasks, task] }));
  logActivity({ area: "checklist", action: "added", detail: clean });
  return { ok: true, data: task };
}

export type TaskPatch = { title: string; notes: string; assignees: Person[]; dueOn: string | null; priority: TaskPriority; listId: string; dropId: string | null };

export function editTask(id: string, patch: TaskPatch): ActionResult<Task> {
  const s = getState();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return refused("not_found", "This task is gone.");
  const title = patch.title.trim();
  if (!title || title.length > TITLE_MAX) return refused("title", "A task needs a title of up to 200 characters.");
  if (patch.notes.length > NOTES_MAX) return refused("notes", "Notes can be at most 2000 characters.");
  if (!s.taskLists.some((l) => l.id === patch.listId)) return refused("list", "This list is gone.");
  const moved = patch.listId !== task.listId;
  const position = moved ? nextPosition(s.tasks.filter((t) => t.listId === patch.listId)) : task.position;
  const after: Task = { ...task, ...patch, title, position };
  update((state) => ({ ...state, tasks: state.tasks.map((t) => (t.id === id ? after : t)) }));
  logActivity({ area: "checklist", action: "edited", detail: title });
  return { ok: true, data: after };
}

export function deleteTask(id: string): ActionResult<Task> {
  const task = getState().tasks.find((t) => t.id === id);
  if (!task) return refused("not_found", "This task is gone.");
  update((state) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }));
  logActivity({ area: "checklist", action: "deleted", detail: task.title });
  return { ok: true, data: task };
}

/** Among the open rows of one list. Done rows keep their slots. */
export function moveTask(id: string, dir: -1 | 1): ActionResult<{ position: number; total: number }> {
  const s = getState();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return refused("not_found", "This task is gone.");
  const tasks = moveOpenTask(s.tasks, id, dir);
  if (tasks === s.tasks) return refused("edge", "It is already at the end of the list.");
  update((state) => ({ ...state, tasks }));
  const rows = tasks.filter((t) => t.listId === task.listId && t.doneAt === null).sort(byPosition);
  return { ok: true, data: { position: rows.findIndex((t) => t.id === id) + 1, total: rows.length } };
}

function cleanListName(name: string): string | null {
  const clean = name.trim();
  return clean && clean.length <= NAME_MAX ? clean : null;
}

export function addList(name: string, dropId: string | null): ActionResult<TaskList> {
  const clean = cleanListName(name);
  if (!clean) return refused("name", "A list needs a name of up to 80 characters.");
  const list: TaskList = { id: nextId("list"), name: clean, dropId, position: nextPosition(getState().taskLists), isDropDay: false };
  update((state) => ({ ...state, taskLists: [...state.taskLists, list] }));
  logActivity({ area: "checklist", action: "list added", detail: clean });
  return { ok: true, data: list };
}

export function editList(id: string, name: string, dropId: string | null): ActionResult<TaskList> {
  const clean = cleanListName(name);
  if (!clean) return refused("name", "A list needs a name of up to 80 characters.");
  const list = getState().taskLists.find((l) => l.id === id);
  if (!list) return refused("not_found", "This list is gone.");
  const after = { ...list, name: clean, dropId };
  update((state) => ({ ...state, taskLists: state.taskLists.map((l) => (l.id === id ? after : l)) }));
  logActivity({ area: "checklist", action: "list edited", detail: clean });
  return { ok: true, data: after };
}

export function moveTaskList(id: string, dir: -1 | 1): ActionResult<void> {
  const s = getState();
  const lists = moveListRule(s.taskLists, id, dir);
  if (lists === s.taskLists) return refused("edge", "It is already at the end.");
  update((state) => ({ ...state, taskLists: lists }));
  return { ok: true, data: undefined };
}

/** The list and its tasks go for everyone. There is no trash for tasks. */
export function deleteList(id: string): ActionResult<{ name: string; tasks: number }> {
  const s = getState();
  const list = s.taskLists.find((l) => l.id === id);
  if (!list) return refused("not_found", "This list is gone.");
  const count = s.tasks.filter((t) => t.listId === id).length;
  update((state) => ({ ...state, taskLists: state.taskLists.filter((l) => l.id !== id), tasks: state.tasks.filter((t) => t.listId !== id) }));
  logActivity({ area: "checklist", action: "list deleted", detail: list.name });
  return { ok: true, data: { name: list.name, tasks: count } };
}

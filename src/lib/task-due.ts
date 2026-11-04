import type { Task } from "@/store/types";
import { addDays, weekBounds } from "./dates";

export type DueState = "overdue" | "today" | "tomorrow" | "upcoming" | "none";

export const isOpen = (task: Pick<Task, "doneAt">): boolean => task.doneAt === null;

export function dueState(dueOn: string | null, today: string): DueState {
  if (!dueOn) return "none";
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  return dueOn === addDays(today, 1) ? "tomorrow" : "upcoming";
}

/** Open tasks due by this Sunday, overdue ones included. */
export const isDueThisWeek = (task: Pick<Task, "doneAt" | "dueOn">, today: string): boolean => isOpen(task) && task.dueOn !== null && task.dueOn <= weekBounds(today).end;

export const isOverdue = (task: Pick<Task, "doneAt" | "dueOn">, today: string): boolean => isOpen(task) && task.dueOn !== null && task.dueOn < today;

export const isDueToday = (task: Pick<Task, "doneAt" | "dueOn">, today: string): boolean => isOpen(task) && task.dueOn === today;

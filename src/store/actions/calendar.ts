import { eventProblem, minutesOf, type EventDraft } from "@/desk/work/rules/calendar";
import { formatTime } from "@/lib/format";
import { getState, registerReset, update } from "../core";
import { logActivity } from "../flows";
import { zurich } from "../seed/rng";
import type { ActionResult, CalendarEvent } from "../types";

let seq = 0;
registerReset(() => {
  seq = 0;
});

/** The seed's helper only knows the demo's own stretch of the year, so a date past it is corrected by what it prints. */
const timeOn = (day: string, time: string) => {
  const guess = zurich(day, ...(time.split(":").map(Number) as [number, number]));
  const drift = minutesOf(formatTime(guess)) - minutesOf(time);
  return new Date(Date.parse(guess) - drift * 60_000).toISOString();
};

function toEvent(id: string, d: EventDraft): CalendarEvent {
  return {
    id,
    title: d.title.trim(),
    type: d.type,
    startsAt: d.allDay ? timeOn(d.day, "00:00") : timeOn(d.day, d.start),
    endsAt: d.allDay ? (d.until && d.until !== d.day ? timeOn(d.until, "00:00") : null) : timeOn(d.day, d.end),
    allDay: d.allDay,
    attendees: d.people,
    notes: d.notes.trim(),
  };
}

/** Planning only: no invites or emails go out. A refused draft comes back with the problem's key as its code. */
export function saveEvent(draft: EventDraft, id?: string): ActionResult<CalendarEvent> {
  const problem = eventProblem(draft);
  if (problem) return { ok: false, code: problem, message: problem };
  if (id && !getState().calendarEvents.some((e) => e.id === id)) return { ok: false, code: "not_found", message: "This event is gone." };
  if (!id) seq += 1;
  const event = toEvent(id ?? `evt_cal_new_${seq}`, draft);
  update((s) => ({ ...s, calendarEvents: id ? s.calendarEvents.map((e) => (e.id === id ? event : e)) : [...s.calendarEvents, event] }));
  logActivity({ area: "calendar", action: id ? "edited" : "added", detail: event.title });
  return { ok: true, data: event };
}

export function deleteEvent(id: string): ActionResult<CalendarEvent> {
  const event = getState().calendarEvents.find((e) => e.id === id);
  if (!event) return { ok: false, code: "not_found", message: "This event is gone." };
  update((s) => ({ ...s, calendarEvents: s.calendarEvents.filter((e) => e.id !== id) }));
  logActivity({ area: "calendar", action: "deleted", detail: event.title });
  return { ok: true, data: event };
}

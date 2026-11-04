import { beforeEach, describe, expect, it } from "vitest";
import { MAX_RANGE_DAYS, buildEntries, entriesOn, eventProblem, monthCount, occursOn, passes, place, weekDays, type EventDraft } from "@/desk/work/rules/calendar";
import { NO_QUERY, TRASH_DAYS, canPromote, categoryCounts, daysLeft, extensionOf, filterFiles, isFiltered, kindOfExtension, liveFiles, parseTags, pickProblem, relativeTime, titleFromName, trashedFiles, whereCount } from "@/desk/work/rules/files";
import { byDueThenPriority, mineGroupOf, moveOpenTask, percentDone, personOf } from "@/desk/work/rules/tasks";
import { deleteEvent, saveEvent } from "@/store/actions/calendar";
import { addFile, addVersion, editFileDetails, moveFile, purgeFile, restoreFile, setFileCategory, trashFile } from "@/store/actions/files";
import { addList, addTask, deleteList, deleteTask, editTask, moveTask, tickTask } from "@/store/actions/tasks";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { getState, resetStore } from "@/store/core";

const SAMPLE = { name: "hoodie_front-graphic.pdf", size: 420_000, type: "application/pdf" };
const DAY = 86_400_000;
const atDaysAgo = (n: number) => new Date(DEMO_NOW_MS - n * DAY).toISOString();

beforeEach(() => resetStore());

describe("files rules", () => {
  it("cuts the title from a name and knows the extension", () => {
    expect(titleFromName("hoodie_front-graphic.pdf")).toBe("hoodie front graphic");
    expect(extensionOf("A.B.PNG")).toBe("png");
    expect(kindOfExtension("exe")).toBeNull();
    expect(kindOfExtension("MOV")).toBe("video");
  });

  it("refuses a wrong type and anything over 2 GB", () => {
    expect(pickProblem({ name: "a.exe", size: 10, type: "" })).toBe("type");
    expect(pickProblem({ name: "a.pdf", size: 2_000_000_001, type: "" })).toBe("size");
    expect(pickProblem({ name: "a.pdf", size: 2_000_000_000, type: "" })).toBeNull();
  });

  it("counts days left from 30, floored, never below 0", () => {
    expect(daysLeft(atDaysAgo(0), DEMO_NOW_MS)).toBe(TRASH_DAYS);
    expect(daysLeft(new Date(DEMO_NOW_MS + 5000).toISOString(), DEMO_NOW_MS)).toBe(TRASH_DAYS);
    expect(daysLeft(atDaysAgo(1.5), DEMO_NOW_MS)).toBe(29);
    expect(daysLeft(atDaysAgo(45), DEMO_NOW_MS)).toBe(0);
  });

  it("gives the relative time units", () => {
    expect(relativeTime(atDaysAgo(0), DEMO_NOW_MS).unit).toBe("now");
    expect(relativeTime(new Date(DEMO_NOW_MS - 5 * 60_000).toISOString(), DEMO_NOW_MS)).toEqual({ unit: "minutes", n: 5 });
    expect(relativeTime(atDaysAgo(1.2), DEMO_NOW_MS).unit).toBe("yesterday");
    expect(relativeTime(atDaysAgo(9), DEMO_NOW_MS)).toEqual({ unit: "weeks", n: 1 });
    expect(relativeTime(atDaysAgo(90), DEMO_NOW_MS).unit).toBe("date");
  });

  it("parses tags: trimmed, no duplicates, order kept", () => {
    expect(parseTags(" a, b ,, A, c")).toEqual(["a", "b", "c"]);
  });

  it("filters by place, category, text with folded accents, and sorts", () => {
    const files = getState().files;
    expect(liveFiles(files)).toHaveLength(37);
    const lagoon = filterFiles(files, { ...NO_QUERY, where: "drop_lagoon" });
    expect(lagoon.every((f) => f.dropId === "drop_lagoon")).toBe(true);
    expect(lagoon.length).toBe(whereCount(files, "drop_lagoon"));
    expect(filterFiles(files, { ...NO_QUERY, where: "brand" }).every((f) => f.dropId === null)).toBe(true);
    expect(filterFiles(files, { ...NO_QUERY, category: "logo" }).every((f) => f.category === "logo")).toBe(true);
    expect(filterFiles(files, { ...NO_QUERY, q: "SWÌNG tag" }).map((f) => f.title)).toEqual(["Swing tag front and back"]);
    const byName = filterFiles(files, { ...NO_QUERY, sort: "name" }).map((f) => f.title);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })));
    expect(isFiltered({ ...NO_QUERY, q: " " })).toBe(false);
    expect(isFiltered({ ...NO_QUERY, type: "pdf" })).toBe(true);
  });

  it("keeps category counts independent of the chosen category", () => {
    const counts = categoryCounts(getState().files, { ...NO_QUERY, where: "brand", category: "logo" });
    expect(counts.all).toBe(counts.logo + counts.draft + counts.prototype + counts.final + counts.other);
    expect(counts.all).toBeGreaterThan(counts.logo);
  });

  it("promotes only drafts and prototypes", () => {
    expect(canPromote({ category: "draft" })).toBe(true);
    expect(canPromote({ category: "prototype" })).toBe(true);
    expect(canPromote({ category: "final" })).toBe(false);
  });
});

describe("files actions", () => {
  it("adds a record from name, size and type only", () => {
    const result = addFile(SAMPLE, { title: "Front graphic", dropId: "drop_aurora", category: "draft" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ ext: "pdf", kind: "pdf", dropId: "drop_aurora", category: "draft" });
    expect(result.data.versions[0].bytes).toBe(420_000);
    expect(addFile({ ...SAMPLE, name: "a.exe" }, { title: "x", dropId: null, category: "other" })).toMatchObject({ ok: false, code: "type" });
    expect(addFile(SAMPLE, { title: "  ", dropId: null, category: "other" })).toMatchObject({ ok: false, code: "title" });
  });

  it("keeps history when a version is added, and the size follows the new one", () => {
    const before = getState().files[0];
    const result = addVersion(before.id, { ...SAMPLE, size: 111 });
    expect(result.ok && result.data.version).toBe(before.versions.length + 1);
    const after = getState().files.find((f) => f.id === before.id)!;
    expect(after.versions).toHaveLength(before.versions.length + 1);
    expect(after.versions[after.versions.length - 1].bytes).toBe(111);
  });

  it("edits, moves and recategorises", () => {
    const id = getState().files[5].id;
    expect(editFileDetails(id, { title: " New ", tags: "x, y", notes: " n " })).toMatchObject({ ok: true, data: { title: "New", tags: ["x", "y"], notes: "n" } });
    expect(moveFile(id, "drop_cirrus")).toMatchObject({ ok: true, data: { dropId: "drop_cirrus" } });
    expect(setFileCategory(id, "final")).toMatchObject({ ok: true, data: { category: "final" } });
    expect(editFileDetails(id, { title: " ", tags: "", notes: "" })).toMatchObject({ ok: false, code: "title" });
  });

  it("trashes, restores, and purges only from the trash", () => {
    const id = getState().files[0].id;
    expect(purgeFile(id)).toMatchObject({ ok: false, code: "not_in_trash" });
    trashFile(id);
    expect(trashedFiles(getState().files).map((f) => f.id)).toEqual([id]);
    expect(moveFile(id, null)).toMatchObject({ ok: false, code: "not_found" });
    restoreFile(id);
    expect(trashedFiles(getState().files)).toHaveLength(0);
    trashFile(id);
    expect(purgeFile(id).ok).toBe(true);
    expect(getState().files.some((f) => f.id === id)).toBe(false);
  });
});

describe("task rules and actions", () => {
  it("treats superUser as no person", () => {
    expect(personOf("superUser")).toBeNull();
    expect(personOf("finance")).toBe("finance");
  });

  it("rounds percent done and guards an empty list", () => {
    expect(percentDone(1, 9)).toBe(11);
    expect(percentDone(0, 0)).toBe(0);
  });

  it("sorts earliest first, undated last, then by priority", () => {
    const task = getState().tasks[0];
    const rows = [
      { ...task, dueOn: "2027-01-10", priority: "normal" as const },
      { ...task, dueOn: null, priority: "normal" as const },
      { ...task, dueOn: "2027-01-09", priority: "low" as const },
      { ...task, dueOn: "2027-01-09", priority: "high" as const },
    ];
    const sorted = [...rows].sort(byDueThenPriority);
    expect(sorted.map((r) => `${r.dueOn}/${r.priority}`)).toEqual(["2027-01-09/high", "2027-01-09/low", "2027-01-10/normal", "null/normal"]);
  });

  it("groups mine by due date", () => {
    expect(mineGroupOf({ dueOn: null }, DEMO_TODAY)).toBe("none");
    expect(mineGroupOf({ dueOn: "2027-01-07" }, DEMO_TODAY)).toBe("overdue");
    expect(mineGroupOf({ dueOn: DEMO_TODAY }, DEMO_TODAY)).toBe("today");
    expect(mineGroupOf({ dueOn: "2027-01-10" }, DEMO_TODAY)).toBe("week");
    expect(mineGroupOf({ dueOn: "2027-02-10" }, DEMO_TODAY)).toBe("later");
  });

  it("ticks and reopens with the acting profile", () => {
    const task = getState().tasks.find((t) => t.doneAt === null)!;
    const done = tickTask(task.id);
    expect(done.ok && done.data.doneAt).toBeTruthy();
    const back = tickTask(task.id);
    expect(back.ok && back.data.doneAt).toBeNull();
    expect(back.ok && back.data.doneBy).toBeNull();
  });

  it("adds last in the list, edits, deletes and refuses blanks", () => {
    const list = getState().taskLists[0];
    expect(addTask(list.id, "   ")).toMatchObject({ ok: false, code: "title" });
    const added = addTask(list.id, " Press the labels ");
    expect(added).toMatchObject({ ok: true, data: { title: "Press the labels", assignees: [], dueOn: null, priority: "normal" } });
    if (!added.ok) return;
    const other = getState().taskLists[1];
    const moved = editTask(added.data.id, { title: "Press", notes: "", assignees: ["warehouse"], dueOn: DEMO_TODAY, priority: "high", listId: other.id, dropId: null });
    expect(moved).toMatchObject({ ok: true, data: { listId: other.id, title: "Press" } });
    expect(deleteTask(added.data.id).ok).toBe(true);
    expect(deleteTask(added.data.id).ok).toBe(false);
  });

  it("reorders among open rows and stops at the ends", () => {
    const list = getState().taskLists[0];
    const rows = getState().tasks.filter((t) => t.listId === list.id && t.doneAt === null).sort((a, b) => a.position - b.position);
    expect(moveTask(rows[0].id, -1)).toMatchObject({ ok: false, code: "edge" });
    expect(moveTask(rows[0].id, 1)).toMatchObject({ ok: true, data: { position: 2, total: rows.length } });
    expect(moveOpenTask(getState().tasks, "missing", 1)).toBe(getState().tasks);
  });

  it("makes and removes a list with its tasks", () => {
    const list = addList(" Night shift ", null);
    expect(list).toMatchObject({ ok: true, data: { name: "Night shift" } });
    if (!list.ok) return;
    addTask(list.data.id, "One");
    expect(deleteList(list.data.id)).toMatchObject({ ok: true, data: { tasks: 1 } });
    expect(getState().tasks.some((t) => t.listId === list.data.id)).toBe(false);
    expect(addList(" ", null)).toMatchObject({ ok: false, code: "name" });
  });
});

describe("calendar rules and actions", () => {
  const draft: EventDraft = { title: "Fit review", allDay: false, day: "2027-01-12", until: "", start: "10:00", end: "11:00", type: "meeting", people: ["owner"], notes: "" };

  it("makes a Monday-first week", () => {
    const week = weekDays(DEMO_TODAY);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2027-01-04");
    expect(week[6]).toBe("2027-01-10");
  });

  it("merges manual, drop and task entries, and filters them", () => {
    const s = getState();
    const entries = buildEntries(s.calendarEvents, s.drops, s.tasks);
    expect(new Set(entries.map((e) => e.source))).toEqual(new Set(["manual", "drop", "task"]));
    expect(monthCount(entries, "2027-01")).toBeGreaterThan(0);
    const launch = entries.find((e) => e.source === "drop" && e.day === "2027-01-17");
    expect(launch).toBeTruthy();
    expect(passes(launch!, { people: [], hidden: ["drop"] })).toBe(false);
    expect(entriesOn(entries, "2027-01-17").some((e) => e.id === launch!.id)).toBe(true);
  });

  it("spans a multi-day entry", () => {
    expect(occursOn({ day: "2027-01-10", lastDay: "2027-01-12" }, "2027-01-11")).toBe(true);
    expect(occursOn({ day: "2027-01-10", lastDay: "2027-01-12" }, "2027-01-13")).toBe(false);
  });

  it("places overlapping blocks side by side and others alone", () => {
    const rows = [{ startMin: 600, endMin: 660 }, { startMin: 630, endMin: 690 }, { startMin: 720, endMin: 780 }];
    const placed = place(rows);
    expect(placed[0].lanes).toBe(2);
    expect(new Set(placed.slice(0, 2).map((p) => p.lane)).size).toBe(2);
    expect(placed[2].lanes).toBe(1);
  });

  it("checks a draft", () => {
    expect(eventProblem(draft)).toBeNull();
    expect(eventProblem({ ...draft, title: " " })).toBe("title");
    expect(eventProblem({ ...draft, end: "09:00" })).toBe("endAfterStart");
    expect(eventProblem({ ...draft, people: [] })).toBe("people");
    expect(eventProblem({ ...draft, allDay: true, until: "2027-01-01" })).toBe("untilBefore");
    expect(MAX_RANGE_DAYS).toBe(366);
  });

  it("saves, edits and deletes an event", () => {
    const made = saveEvent(draft);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(getState().calendarEvents.some((e) => e.id === made.data.id)).toBe(true);
    expect(saveEvent({ ...draft, title: "Moved" }, made.data.id)).toMatchObject({ ok: true, data: { title: "Moved" } });
    expect(saveEvent(draft, "gone")).toMatchObject({ ok: false, code: "not_found" });
    expect(deleteEvent(made.data.id).ok).toBe(true);
    expect(deleteEvent(made.data.id).ok).toBe(false);
  });
});

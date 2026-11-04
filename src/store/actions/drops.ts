import { dropInputProblem, parseWaitlist, zurichInstant, zurichWallClock } from "@/desk/commerce/products/rules";
import { DROP_CHECKLIST } from "@/lib/drop-checklist";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity } from "@/store/flows";
import type { ActionResult, Drop, DropStatus, Lang, Task, TaskList, WaitlistEntry } from "@/store/types";

let seq = 1;
registerReset(() => {
  seq = 1;
});
const uid = (prefix: string) => `${prefix}_b4_${seq++}`;
const fail = (code: string): { ok: false; code: string; message: string } => ({ ok: false, code, message: code });

export type DropInput = { name: string; season: string; status: DropStatus; launchOn: string | null; launchTime: string | null; description: string };

export function dropFormValues(drop: Drop | null): DropInput {
  if (!drop) return { name: "", season: "", status: "planned", launchOn: null, launchTime: null, description: "" };
  return { name: drop.name, season: drop.season, status: drop.status, launchOn: drop.launchOn, launchTime: drop.launchAt ? zurichWallClock(drop.launchAt).time : null, description: drop.description };
}

const launchFields = (input: DropInput) => ({
  launchOn: input.launchOn,
  launchAt: input.launchOn && input.launchTime ? zurichInstant(input.launchOn, input.launchTime) : null,
});

export function createDrop(input: DropInput): ActionResult<{ id: string }> {
  const problem = dropInputProblem(input);
  if (problem) return fail(problem);
  const id = uid("drop");
  const row: Drop = { id, name: input.name.trim(), season: input.season.trim(), status: input.status, ...launchFields(input), description: input.description.trim(), productIds: [], waitlist: [], updatedAt: now() };
  update((state) => ({ ...state, drops: [row, ...state.drops] }));
  logActivity({ area: "drops", action: "drop_created", detail: row.name });
  return { ok: true, data: { id } };
}

export function saveDrop(id: string, input: DropInput): ActionResult {
  if (!getState().drops.some((d) => d.id === id)) return fail("not_found");
  const problem = dropInputProblem(input);
  if (problem) return fail(problem);
  const at = now();
  update((state) => ({ ...state, drops: state.drops.map((d) => (d.id === id ? { ...d, name: input.name.trim(), season: input.season.trim(), status: input.status, ...launchFields(input), description: input.description.trim(), updatedAt: at } : d)) }));
  logActivity({ area: "drops", action: "drop_saved", detail: input.name.trim() });
  return { ok: true, data: undefined };
}

/** A product belongs to one drop, so only products that are in none can join. */
export function addProductsToDrop(dropId: string, productIds: string[]): ActionResult<{ added: number }> {
  const s = getState();
  const drop = s.drops.find((d) => d.id === dropId);
  if (!drop) return fail("not_found");
  const taken = new Set(s.drops.flatMap((d) => d.productIds));
  const fresh = productIds.filter((id) => !taken.has(id) && s.products.some((p) => p.id === id));
  if (fresh.length === 0) return fail("nothing");
  const at = now();
  update((state) => ({ ...state, drops: state.drops.map((d) => (d.id === dropId ? { ...d, productIds: [...d.productIds, ...fresh], updatedAt: at } : d)) }));
  logActivity({ area: "drops", action: "drop_products_added", detail: `${drop.name}: ${fresh.length}` });
  return { ok: true, data: { added: fresh.length } };
}

export function removeProductFromDrop(dropId: string, productId: string): ActionResult {
  const drop = getState().drops.find((d) => d.id === dropId);
  if (!drop) return fail("not_found");
  const at = now();
  update((state) => ({ ...state, drops: state.drops.map((d) => (d.id === dropId ? { ...d, productIds: d.productIds.filter((p) => p !== productId), updatedAt: at } : d)) }));
  logActivity({ area: "drops", action: "drop_product_removed", detail: drop.name });
  return { ok: true, data: undefined };
}

/** One drop-day list per drop: the ten items, in order. A second try is refused. */
export function startDropChecklist(dropId: string, lang: Lang): ActionResult<{ listId: string }> {
  const s = getState();
  const drop = s.drops.find((d) => d.id === dropId);
  if (!drop) return fail("not_found");
  if (s.taskLists.some((l) => l.dropId === dropId && l.isDropDay)) return fail("exists");
  const at = now();
  const listId = uid("list");
  const list: TaskList = { id: listId, name: lang === "de" ? `${drop.name} Drop-Tag` : `${drop.name} drop day`, dropId, position: s.taskLists.length + 1, isDropDay: true };
  const tasks: Task[] = DROP_CHECKLIST.map((item, i) => ({
    id: uid("task"), listId, title: item[lang], notes: "", assignees: [], priority: "normal", dropId, dueOn: drop.launchOn, doneAt: null, doneBy: null, position: i + 1, createdAt: at,
  }));
  update((state) => ({ ...state, taskLists: [...state.taskLists, list], tasks: [...state.tasks, ...tasks] }));
  logActivity({ area: "drops", action: "drop_checklist_started", detail: drop.name });
  return { ok: true, data: { listId } };
}

export type WaitlistResult = { added: number; skipped: number; invalid: string[] };

/** Lines already on this drop for the same product and size are skipped, not doubled. */
export function addToWaitlist(dropId: string, productId: string | null, text: string): ActionResult<WaitlistResult> {
  const drop = getState().drops.find((d) => d.id === dropId);
  if (!drop) return fail("not_found");
  const { entries, invalid } = parseWaitlist(text);
  if (entries.length === 0 && invalid.length === 0) return fail("nothing");
  const fresh: WaitlistEntry[] = [];
  let skipped = 0;
  for (const line of entries) {
    if (drop.waitlist.some((w) => w.email === line.email && w.size === line.size && w.productId === productId)) {
      skipped += 1;
      continue;
    }
    fresh.push({ id: uid("wl"), email: line.email, name: line.name, productId, size: line.size, notifiedAt: null });
  }
  if (fresh.length) {
    const at = now();
    update((state) => ({
      ...state,
      drops: state.drops.map((d) => (d.id === dropId ? { ...d, waitlist: [...d.waitlist, ...fresh], updatedAt: at } : d)),
      customers: state.customers.map((c) => {
        const mine = fresh.filter((f) => f.email === c.email);
        return mine.length ? { ...c, waitlist: [...c.waitlist, ...mine.map((f) => ({ dropName: drop.name, size: f.size, notified: false }))] } : c;
      }),
    }));
    logActivity({ area: "drops", action: "waitlist_added", detail: `${drop.name}: ${fresh.length}` });
  }
  return { ok: true, data: { added: fresh.length, skipped, invalid } };
}

/** Cannot be undone. Whoever was added after the list was read stays waiting: the ids come from what was on screen. */
export function markWaitlistTold(dropId: string, entryIds: string[]): ActionResult<{ marked: number }> {
  const drop = getState().drops.find((d) => d.id === dropId);
  if (!drop) return fail("not_found");
  const ids = new Set(entryIds);
  const hits = drop.waitlist.filter((w) => ids.has(w.id) && !w.notifiedAt);
  if (hits.length === 0) return fail("nothing");
  const at = now();
  const emails = new Set(hits.map((w) => w.email));
  update((state) => ({
    ...state,
    drops: state.drops.map((d) => (d.id === dropId ? { ...d, waitlist: d.waitlist.map((w) => (ids.has(w.id) && !w.notifiedAt ? { ...w, notifiedAt: at } : w)), updatedAt: at } : d)),
    customers: state.customers.map((c) => (emails.has(c.email) ? { ...c, waitlist: c.waitlist.map((w) => (w.dropName === drop.name ? { ...w, notified: true } : w)) } : c)),
  }));
  logActivity({ area: "drops", action: "waitlist_told", detail: `${drop.name}: ${hits.length}` });
  return { ok: true, data: { marked: hits.length } };
}

export function removeFromWaitlist(dropId: string, entryId: string): ActionResult {
  const drop = getState().drops.find((d) => d.id === dropId);
  const entry = drop?.waitlist.find((w) => w.id === entryId);
  if (!drop || !entry) return fail("not_found");
  update((state) => ({
    ...state,
    drops: state.drops.map((d) => (d.id === dropId ? { ...d, waitlist: d.waitlist.filter((w) => w.id !== entryId) } : d)),
    customers: state.customers.map((c) => (c.email === entry.email ? { ...c, waitlist: c.waitlist.filter((w) => !(w.dropName === drop.name && w.size === entry.size)) } : c)),
  }));
  logActivity({ area: "drops", action: "waitlist_removed", detail: drop.name });
  return { ok: true, data: undefined };
}

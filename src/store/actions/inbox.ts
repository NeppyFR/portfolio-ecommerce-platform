import { correctedPriority, WHY_MAX_LENGTH } from "@/desk/growth/inbox/rules";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { actorName, logActivity } from "@/store/flows";
import type { ActionResult, InboxCategory, InboxMail, InboxPriority, Person } from "@/store/types";

/** `InboxMail` has no field for the reason behind a correction, so it lives here beside the action that writes it. */
const whyByMail = new Map<string, string>();
const whyListeners = new Set<() => void>();

export const whyOf = (mailId: string): string | undefined => whyByMail.get(mailId);
export const subscribeWhy = (listener: () => void) => {
  whyListeners.add(listener);
  return () => {
    whyListeners.delete(listener);
  };
};

registerReset(() => {
  whyByMail.clear();
  whyListeners.forEach((l) => l());
});

const NOT_FOUND = { ok: false as const, code: "not_found", message: "That mail is gone." };

function patchMail(id: string, patch: Partial<InboxMail>): void {
  update((s) => ({ ...s, inbox: s.inbox.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}

const findMail = (id: string) => getState().inbox.find((m) => m.id === id);

/** superUser is a system profile, so it can never be an assignee. */
export function assignMail(id: string, person: Person | null): ActionResult<{ assigned: boolean }> {
  const mail = findMail(id);
  if (!mail) return NOT_FOUND;
  const member = person ? getState().team.find((m) => m.profile === person) : null;
  if (person && !member?.isActive) return { ok: false, code: "inactive", message: "That person is switched off." };
  patchMail(id, { assignee: person });
  logActivity({ area: "inbox", action: "inbox.assign", detail: member ? `Assigned "${mail.subject}" to ${member.name}` : `Unassigned "${mail.subject}"` });
  return { ok: true, data: { assigned: person !== null } };
}

export function markMailDone(id: string): ActionResult {
  const mail = findMail(id);
  if (!mail) return NOT_FOUND;
  if (mail.status === "done") return { ok: false, code: "already_done", message: "That mail is already done." };
  const profile = getState().profile;
  patchMail(id, { status: "done", doneAt: now(), doneBy: profile === "superUser" ? null : profile });
  logActivity({ area: "inbox", action: "inbox.done", detail: `Marked "${mail.subject}" done` });
  return { ok: true, data: undefined };
}

export function reopenMail(id: string): ActionResult {
  const mail = findMail(id);
  if (!mail) return NOT_FOUND;
  if (mail.status !== "done") return { ok: false, code: "not_done", message: "That mail is still open." };
  patchMail(id, { status: mail.category ? "sorted" : "unsorted", doneAt: null, doneBy: null });
  logActivity({ area: "inbox", action: "inbox.reopen", detail: `Reopened "${mail.subject}"` });
  return { ok: true, data: undefined };
}

/** A correction names the person, clears the review flag and locks the mail against later automatic runs. */
export function resortMail(id: string, input: { category: InboxCategory; priority: InboxPriority; why?: string }): ActionResult<{ priority: InboxPriority }> {
  const mail = findMail(id);
  if (!mail) return NOT_FOUND;
  const why = (input.why ?? "").trim();
  if (why.length > WHY_MAX_LENGTH) return { ok: false, code: "why_long", message: "At most 200 characters." };
  const priority = correctedPriority(input.category, input.priority);
  patchMail(id, {
    category: input.category,
    priority,
    status: mail.status === "done" ? "done" : "sorted",
    classifiedBy: actorName(),
    classifiedAt: now(),
    confidence: null,
    locked: true,
    needsReview: false,
    lastError: null,
  });
  if (why) {
    whyByMail.set(id, why);
    whyListeners.forEach((l) => l());
  }
  logActivity({ area: "inbox", action: "inbox.resort", detail: `Re-sorted "${mail.subject}": ${input.category}, ${priority}` });
  return { ok: true, data: { priority } };
}

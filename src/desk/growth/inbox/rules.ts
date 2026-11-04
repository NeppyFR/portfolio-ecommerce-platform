import { matchesSearch } from "@/lib/search";
import { hasInjection, mentionsBankChange } from "@/lib/triage";
import type { InboxCategory, InboxMail, InboxPriority } from "@/store/types";

export type InboxTab = "open" | InboxCategory | "unsorted" | "done";

export const INBOX_CATEGORIES: InboxCategory[] = ["manufacturer", "customer_support", "important_other", "low_priority"];
export const INBOX_PRIORITIES: InboxPriority[] = ["P1", "P2", "P3"];
export const INBOX_TABS: InboxTab[] = ["open", ...INBOX_CATEGORIES, "unsorted", "done"];
export const WHY_MAX_LENGTH = 200;

export const isInboxTab = (value: string | null): value is InboxTab => value !== null && (INBOX_TABS as string[]).includes(value);

export function inTab(mail: Pick<InboxMail, "status" | "category">, tab: InboxTab): boolean {
  if (tab === "open") return mail.status !== "done";
  if (tab === "unsorted") return mail.status === "unsorted";
  if (tab === "done") return mail.status === "done";
  return mail.status === "sorted" && mail.category === tab;
}

export function tabCounts(mails: InboxMail[]): Record<InboxTab, number> {
  const counts = Object.fromEntries(INBOX_TABS.map((tab) => [tab, 0])) as Record<InboxTab, number>;
  for (const mail of mails) {
    for (const tab of INBOX_TABS) if (inTab(mail, tab)) counts[tab] += 1;
  }
  return counts;
}

export type InboxStats = { urgent: number; review: number; nobody: number; unsorted: number };

/** The numbers above the table, all about open mail: done mail asks nothing of anyone. */
export function inboxStats(mails: InboxMail[]): InboxStats {
  const open = mails.filter((m) => m.status !== "done");
  return {
    urgent: open.filter((m) => m.priority === "P1").length,
    review: open.filter((m) => m.needsReview).length,
    nobody: open.filter((m) => m.assignee === null).length,
    unsorted: open.filter((m) => m.status === "unsorted").length,
  };
}

/** Every word must appear in the sender, the subject, the summary or the text; accents fold. */
export function matchesMail(mail: InboxMail, query: string): boolean {
  return matchesSearch(query, [mail.fromName, mail.fromEmail, mail.subject, mail.summary, mail.body]);
}

const RANK: Record<InboxPriority, number> = { P1: 0, P2: 1, P3: 2 };
const rankOf = (mail: Pick<InboxMail, "priority">) => (mail.priority ? RANK[mail.priority] : 3);
const newestFirst = (a: Pick<InboxMail, "receivedAt">, b: Pick<InboxMail, "receivedAt">) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt);

/** The default is priority: P1 first, unsorted last, then newest. */
export function sortMails(mails: InboxMail[], newest: boolean): InboxMail[] {
  return [...mails].sort(newest ? newestFirst : (a, b) => rankOf(a) - rankOf(b) || newestFirst(a, b));
}

export function visibleMails(mails: InboxMail[], view: { tab: InboxTab; query: string; newest: boolean }): InboxMail[] {
  const query = view.query.trim();
  const kept = mails.filter((m) => inTab(m, view.tab) && (query === "" || matchesMail(m, query)));
  return sortMails(kept, view.newest);
}

/** Anything but a DMARC pass, the mailbox's silence included. */
export const isUnverified = (mail: Pick<InboxMail, "dmarc">): boolean => mail.dmarc !== "pass";

export type FiredRule = "bank_change" | "low_is_p3" | "injection" | "low_confidence" | "unverified" | "person_lock";

/** Which of the rules after the classifier show on this mail, in the order they run. */
export function firedRules(mail: InboxMail): FiredRule[] {
  const text = `${mail.subject}\n${mail.body}`;
  const fired: FiredRule[] = [];
  if (mentionsBankChange(text)) fired.push("bank_change");
  if (mail.category === "low_priority") fired.push("low_is_p3");
  if (mail.suspectedInjection || hasInjection(text)) fired.push("injection");
  if (mail.confidence !== null && mail.confidence < 0.6) fired.push("low_confidence");
  if (isUnverified(mail)) fired.push("unverified");
  if (mail.locked) fired.push("person_lock");
  return fired;
}

/** A correction may set any priority, except that low priority always means P3. */
export const correctedPriority = (category: InboxCategory, priority: InboxPriority): InboxPriority => (category === "low_priority" ? "P3" : priority);

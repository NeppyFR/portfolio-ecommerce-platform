import { entityOf, type ActivityEntity } from "@/desk/system/rules/lights";
import type { ActivityRow, EmailStatus, EmailTemplate, OutboxEmail } from "@/store/types";

export const SEARCH_MAX = 60;

export type OutboxFilter = { q: string; type: EmailTemplate | ""; status: EmailStatus | "" };

const matchesSearch = (mail: OutboxEmail, q: string): boolean => {
  const needle = q.trim().slice(0, SEARCH_MAX).toLowerCase();
  if (!needle) return true;
  return mail.to.toLowerCase().includes(needle) || (mail.orderNumber ?? "").toLowerCase().includes(needle);
};

/** Search and type narrow the list first, so the status pills count what the other two filters left. */
export function outboxBase(rows: OutboxEmail[], filter: Pick<OutboxFilter, "q" | "type">): OutboxEmail[] {
  return rows.filter((m) => (!filter.type || m.template === filter.type) && matchesSearch(m, filter.q));
}

export function filterOutbox(rows: OutboxEmail[], filter: OutboxFilter): OutboxEmail[] {
  const base = outboxBase(rows, filter);
  return filter.status ? base.filter((m) => m.status === filter.status) : base;
}

export type OutboxCounts = Record<EmailStatus, number> & { all: number; sent: number };

/** `sent` stays 0 on purpose: this demo's honest end of the road is `rendered`. */
export function outboxCounts(rows: OutboxEmail[]): OutboxCounts {
  const by = (status: EmailStatus) => rows.filter((m) => m.status === status).length;
  return { all: rows.length, queued: by("queued"), rendered: by("rendered"), failed: by("failed"), skipped: by("skipped"), sent: 0 };
}

/** `{count}` in the outbox intro: what is still waiting to be rendered. */
export const waitingToRender = (rows: OutboxEmail[]): number => rows.filter((m) => m.status === "queued" || m.status === "failed").length;

export const isRetryable = (mail: Pick<OutboxEmail, "status">): boolean => mail.status === "queued" || mail.status === "failed";

export type ActivityFilter = { actor: string; entity: ActivityEntity | "" };

export function filterActivity(rows: ActivityRow[], filter: ActivityFilter): ActivityRow[] {
  return rows.filter((row) => (!filter.actor || row.actor === filter.actor) && (!filter.entity || entityOf(row.area) === filter.entity));
}

export function pageOf<R>(rows: R[], page: number, size: number): { rows: R[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pages };
}

import type { InboxCategory, InboxMail, InboxNextAction, InboxPriority } from "@/store/types";

/** A priority mail needs someone today: P1 and not done. */
export const isPriorityMail = (mail: Pick<InboxMail, "priority" | "status">): boolean => mail.priority === "P1" && mail.status !== "done";

const BANK_CHANGE = [
  /\b(?:new|changed|updated)\s+(?:bank|account|iban|payment)\b/i,
  /\bneue(?:s|n)?\s+(?:bank|konto|iban)/i,
  /\bbankverbindung\s+ge(?:ä|ae)ndert/i,
  /\bnouveau\s+(?:compte|iban|rib)\b/i,
  /\bnuovo\s+(?:conto|iban)\b/i,
];
const INJECTION = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|rules)\b/i,
  /\bignoriere\s+(?:alle\s+)?(?:vorherigen|bisherigen)\s+(?:anweisungen|regeln)\b/i,
  /\byou\s+are\s+now\s+(?:a|an|the)\b/i,
  /<\/?\s*(?:system|assistant|instructions?)\s*>/i,
];
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;

export const mentionsBankChange = (text: string): boolean => BANK_CHANGE.some((p) => p.test(text));
export const hasInjection = (text: string): boolean => INJECTION.some((p) => p.test(text));

/** Links and IBANs in summary and note become `[link]` and `[IBAN]`. */
export const scrubSummary = (text: string): string => text.replace(LINK, "[link]").replace(IBAN, "[IBAN]");

export type Triage = { category: InboxCategory; priority: InboxPriority; nextAction: InboxNextAction; nextActionNote: string; summary: string; confidence: number; needsReview: boolean; suspectedInjection: boolean };

export const BANK_CHANGE_NOTE = "Verify by phone with a known number before paying anything.";

/** The rules applied after the classifier, in the original's order. They always beat the classifier. */
export function applyServerRules(input: Triage, mail: { body: string; subject: string; dmarc: InboxMail["dmarc"] }): Triage {
  const text = `${mail.subject}\n${mail.body}`;
  const out: Triage = { ...input, summary: scrubSummary(input.summary), nextActionNote: scrubSummary(input.nextActionNote) };
  if (mentionsBankChange(text)) {
    out.priority = "P1";
    out.needsReview = true;
    out.nextActionNote = BANK_CHANGE_NOTE;
  }
  if (out.category === "low_priority") out.priority = "P3";
  if (hasInjection(text)) {
    out.suspectedInjection = true;
    out.needsReview = true;
  }
  if (out.confidence < 0.6) out.needsReview = true;
  if (mail.dmarc !== "pass" && (out.priority === "P1" || out.nextAction === "pay_or_check_invoice")) {
    if (out.priority === "P1") out.priority = "P2";
    if (out.nextAction === "pay_or_check_invoice") out.nextAction = "reply";
    out.needsReview = true;
  }
  return out;
}

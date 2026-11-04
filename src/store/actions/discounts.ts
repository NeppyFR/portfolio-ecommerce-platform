import { discountInputProblem, isValidCode, type DiscountInputProblem } from "@/lib/discount-rules";
import { normaliseCode } from "@/lib/pricing";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { logActivity } from "@/store/flows";
import type { ActionResult, Discount, DiscountScope, DiscountType, Rappen } from "@/store/types";

let seq = 1;
registerReset(() => {
  seq = 1;
});

const fail = (code: string): { ok: false; code: string; message: string } => ({ ok: false, code, message: code });

export type DiscountInput = {
  code: string; type: DiscountType; value: number | null; scope: DiscountScope; productIds: string[]; collectionIds: string[];
  minOrderRappen: Rappen | null; usageLimit: number | null; startDay: string | null; endDay: string | null; isEnabled: boolean; description: string;
};

export type DiscountProblem = DiscountInputProblem | "code_taken" | "note" | "scope";

export function discountProblem(input: DiscountInput, ownId: string | null): DiscountProblem | null {
  const code = normaliseCode(input.code);
  const problem = discountInputProblem({ code, type: input.type, value: input.type === "free_shipping" ? 0 : input.value ?? Number.NaN, minOrderRappen: input.minOrderRappen ?? 0, usageLimit: input.usageLimit, startDay: input.startDay, endDay: input.endDay });
  if (problem) return problem;
  if (getState().discounts.some((d) => d.id !== ownId && d.code === code)) return "code_taken";
  if (input.description.length > 200) return "note";
  if (input.scope === "products" && input.productIds.length === 0) return "scope";
  if (input.scope === "collections" && input.collectionIds.length === 0) return "scope";
  return null;
}

const fields = (input: DiscountInput) => ({
  code: normaliseCode(input.code),
  type: input.type,
  value: input.type === "free_shipping" ? 0 : (input.value as number),
  scope: input.scope,
  productIds: input.scope === "products" ? input.productIds : [],
  collectionIds: input.scope === "collections" ? input.collectionIds : [],
  minOrderRappen: input.minOrderRappen ?? 0,
  usageLimit: input.usageLimit,
  startDay: input.startDay,
  endDay: input.endDay,
  isEnabled: input.isEnabled,
  description: input.description.trim(),
});

export function createDiscount(input: DiscountInput): ActionResult<{ id: string; code: string }> {
  const problem = discountProblem(input, null);
  if (problem) return fail(problem);
  const id = `dis_b4_${seq++}`;
  const row: Discount = { id, ...fields(input), reason: "", timesUsed: 0, redeemedRappen: 0, lastUsedAt: null, updatedAt: now() };
  update((state) => ({ ...state, discounts: [row, ...state.discounts] }));
  logActivity({ area: "discounts", action: "discount_created", detail: row.code });
  return { ok: true, data: { id, code: row.code } };
}

/** Past orders keep the discount they got: nothing here reaches back into them. */
export function saveDiscount(id: string, input: DiscountInput): ActionResult {
  if (!getState().discounts.some((d) => d.id === id)) return fail("not_found");
  const problem = discountProblem(input, id);
  if (problem) return fail(problem);
  const at = now();
  update((state) => ({ ...state, discounts: state.discounts.map((d) => (d.id === id ? { ...d, ...fields(input), updatedAt: at } : d)) }));
  logActivity({ area: "discounts", action: "discount_saved", detail: normaliseCode(input.code) });
  return { ok: true, data: undefined };
}

export function toggleDiscount(id: string): ActionResult<{ code: string; isEnabled: boolean }> {
  const row = getState().discounts.find((d) => d.id === id);
  if (!row) return fail("not_found");
  const isEnabled = !row.isEnabled;
  const at = now();
  update((state) => ({ ...state, discounts: state.discounts.map((d) => (d.id === id ? { ...d, isEnabled, updatedAt: at } : d)) }));
  logActivity({ area: "discounts", action: isEnabled ? "discount_on" : "discount_off", detail: row.code });
  return { ok: true, data: { code: row.code, isEnabled } };
}

/** The copy's code is `{code}-COPY`, within the 30-character limit, with a number if that is taken. */
export function copyCode(code: string, taken: string[]): string {
  const stem = code.slice(0, 25);
  let candidate = `${stem}-COPY`;
  for (let n = 2; taken.includes(candidate) || !isValidCode(candidate); n += 1) candidate = `${stem}-COPY${n}`;
  return candidate;
}

/** Same value, dates, limits and restrictions. Switched off and unused. */
export function duplicateDiscount(id: string): ActionResult<{ id: string; code: string }> {
  const s = getState();
  const row = s.discounts.find((d) => d.id === id);
  if (!row) return fail("not_found");
  const code = copyCode(row.code, s.discounts.map((d) => d.code));
  const newId = `dis_b4_${seq++}`;
  const copy: Discount = { ...row, id: newId, code, isEnabled: false, timesUsed: 0, redeemedRappen: 0, lastUsedAt: null, updatedAt: now() };
  update((state) => ({ ...state, discounts: [copy, ...state.discounts] }));
  logActivity({ area: "discounts", action: "discount_duplicated", detail: `${row.code} to ${code}` });
  return { ok: true, data: { id: newId, code } };
}

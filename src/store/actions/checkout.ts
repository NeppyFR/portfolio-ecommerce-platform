import { CHECKOUT_DEFAULTS, PHONE } from "@/lib/brand";
import { getState } from "../core";
import { placeOrder, type PlacedOrder } from "../flows";
import type { ActionResult, CheckoutDetails, CheckoutOutcome, Lang } from "../types";
import { bagView } from "./bag";

export type CheckoutForm = { first: string; last: string; email: string; phone: string; line1: string; line2: string; postalCode: string; city: string };
export type FormField = keyof CheckoutForm;
export type FormProblem = "blank" | "nameInvalid" | "emailInvalid" | "phoneInvalid" | "addressLine1" | "addressLine2" | "postalCode" | "cityInvalid";
export type FormProblems = Partial<Record<FormField, FormProblem>>;

/** The order the error box reads: it reports the first problem and takes focus. */
export const FIELD_ORDER: FormField[] = ["first", "last", "email", "phone", "line1", "line2", "postalCode", "city"];

export function demoForm(): CheckoutForm {
  const [first, ...rest] = CHECKOUT_DEFAULTS.fullName.split(" ");
  return { first, last: rest.join(" "), email: CHECKOUT_DEFAULTS.email, phone: CHECKOUT_DEFAULTS.phone, line1: CHECKOUT_DEFAULTS.line1, line2: "", postalCode: CHECKOUT_DEFAULTS.postalCode, city: CHECKOUT_DEFAULTS.city };
}

/** A Swiss mobile number, or the demo's all-zero number. A landline is refused. */
export function isSwissMobile(raw: string): boolean {
  const compact = raw.replace(/[\s()./-]/g, "");
  if (compact === PHONE.replace(/\s/g, "")) return true;
  return /^(?:\+41|0041|0)7[5-9]\d{7}$/.test(compact);
}

/** The notes' checks, except that the phone rule also takes the fake number. */
export function checkForm(form: CheckoutForm): FormProblems {
  const out: FormProblems = {};
  const first = form.first.trim();
  const last = form.last.trim();
  const email = form.email.trim();
  const line1 = form.line1.trim();
  const city = form.city.trim();
  if (!first) out.first = "blank";
  else if (first.length > 50) out.first = "nameInvalid";
  if (!last) out.last = "blank";
  else if (last.length > 50) out.last = "nameInvalid";
  if (!email) out.email = "blank";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) out.email = "emailInvalid";
  if (!form.phone.trim()) out.phone = "blank";
  else if (!isSwissMobile(form.phone)) out.phone = "phoneInvalid";
  if (!line1) out.line1 = "blank";
  else if (line1.length < 3 || line1.length > 100) out.line1 = "addressLine1";
  if (form.line2.length > 100) out.line2 = "addressLine2";
  if (!form.postalCode.trim()) out.postalCode = "blank";
  else if (!/^[1-9]\d{3}$/.test(form.postalCode.trim())) out.postalCode = "postalCode";
  if (!city) out.city = "blank";
  else if (city.length < 2 || city.length > 60) out.city = "cityInvalid";
  return out;
}

export function firstProblem(problems: FormProblems): { field: FormField; problem: FormProblem } | null {
  for (const field of FIELD_ORDER) {
    const problem = problems[field];
    if (problem) return { field, problem };
  }
  return null;
}

export function toDetails(form: CheckoutForm): CheckoutDetails {
  return { fullName: `${form.first.trim()} ${form.last.trim()}`, email: form.email.trim().toLowerCase(), phone: form.phone.trim(), line1: form.line1.trim(), line2: form.line2.trim() || undefined, postalCode: form.postalCode.trim(), city: form.city.trim(), countryCode: "CH" };
}

/**
 * The local checks that survive faking, then the shared flow. `shownTotal` is the total on screen when the
 * visitor confirmed: a different total now comes back as PRICE_CHANGED and the page shows the new one.
 */
export function endCheckout(form: CheckoutForm, outcome: CheckoutOutcome, lang: Lang, shownTotal: number): ActionResult<PlacedOrder> {
  if (firstProblem(checkForm(form))) return { ok: false, code: "FORM_INVALID", message: "FORM_INVALID" };
  const s = getState();
  const view = bagView(s);
  if (view.rows.length === 0) return { ok: false, code: "CART_INVALID", message: "CART_INVALID" };
  const unavailable = view.rows.find((r) => r.problem === "unavailable");
  if (unavailable) return { ok: false, code: "VARIANT_UNAVAILABLE", message: unavailable.variantId };
  const short = view.rows.find((r) => r.problem === "soldOut" || r.problem === "onlyLeft");
  if (short) return { ok: false, code: "OUT_OF_STOCK", message: short.variantId };
  if (view.quote.totalRappen !== shownTotal) return { ok: false, code: "PRICE_CHANGED", message: "PRICE_CHANGED" };
  return placeOrder({ details: toDetails(form), bag: s.bag, lang }, outcome);
}

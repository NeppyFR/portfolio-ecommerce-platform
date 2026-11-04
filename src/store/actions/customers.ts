import { hasFullPowers } from "@/lib/features";
import { actorName, logActivity } from "@/store/flows";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { ERASED_NAME } from "@/store/seed/people";
import type { ActionResult, Note } from "@/store/types";
import { hasOpenBusiness } from "@/desk/commerce/customers/rules";

let nextId = 1;
registerReset(() => {
  nextId = 1;
});

export function addCustomerNote(customerId: string, body: string): ActionResult {
  const text = body.trim();
  if (!text) return { ok: false, code: "empty", message: "Write something first." };
  const customer = getState().customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, code: "not_found", message: "This customer does not exist." };
  if (customer.erased) return { ok: false, code: "erased", message: "This customer was erased." };
  const note: Note = { id: `cn_b3_${nextId++}`, body: text.slice(0, 2000), author: actorName(), createdAt: now() };
  update((s) => ({ ...s, customers: s.customers.map((c) => (c.id === customerId ? { ...c, notes: [...c.notes, note] } : c)) }));
  return { ok: true, data: undefined };
}

export function removeCustomerNote(customerId: string, noteId: string): ActionResult {
  update((s) => ({ ...s, customers: s.customers.map((c) => (c.id === customerId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c)) }));
  return { ok: true, data: undefined };
}

/**
 * The demo of a real erase: name, email, phone and addresses go from the customer, their orders and outbox rows,
 * with the notes and waitlist entries. Amounts, items, order numbers and the shipping country stay.
 * It touches only this tab's memory, so a reload brings the person back.
 */
export function eraseCustomer(customerId: string, typedEmail: string): ActionResult<{ orders: number }> {
  const s = getState();
  const customer = s.customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, code: "not_found", message: "This customer does not exist." };
  if (!hasFullPowers(s.profile)) return { ok: false, code: "not_allowed", message: "Only full access can erase." };
  if (customer.erased) return { ok: false, code: "erased", message: "Already erased." };
  if (typedEmail.trim().toLowerCase() !== customer.email.toLowerCase()) return { ok: false, code: "mismatch", message: "That isn't their email." };
  if (hasOpenBusiness(customerId, s.orders, s.returns)) return { ok: false, code: "open", message: "Open orders and returns first." };
  const at = now();
  const placeholder = `erased.${customerId}@example.com`;
  const numbers = new Set(s.orders.filter((o) => o.customerId === customerId).map((o) => o.orderNumber));
  update((state) => ({
    ...state,
    customers: state.customers.map((c) => (c.id === customerId ? { ...c, fullName: ERASED_NAME, email: placeholder, phone: "", erased: true, erasedAt: at, addresses: [], notes: [], waitlist: [] } : c)),
    orders: state.orders.map((o) =>
      o.customerId === customerId
        ? { ...o, customerName: ERASED_NAME, email: placeholder, customerErased: true, notes: [], shippingAddress: { fullName: ERASED_NAME, line1: "–", postalCode: "0000", city: "–", countryCode: o.shippingAddress.countryCode } }
        : o,
    ),
    returns: state.returns.map((r) => (numbers.has(r.orderNumber) ? { ...r, customerName: ERASED_NAME, note: "", closeNote: "" } : r)),
    outbox: state.outbox.map((m) => (m.orderNumber && numbers.has(m.orderNumber) ? { ...m, to: placeholder } : m)),
    drops: state.drops.map((d) => (d.waitlist.some((w) => w.email === customer.email) ? { ...d, waitlist: d.waitlist.filter((w) => w.email !== customer.email) } : d)),
  }));
  logActivity({ area: "customers", action: "customer.erased", detail: `${numbers.size} orders anonymised` });
  return { ok: true, data: { orders: numbers.size } };
}

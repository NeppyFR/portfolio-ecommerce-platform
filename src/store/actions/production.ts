import { isClosedPo, landedUnitCost, nextPoNumber, poInputProblem, poTotals, takesCostPrices, toReceive, type PoInputProblem } from "@/desk/commerce/products/rules";
import { hasFullPowers } from "@/lib/features";
import { now } from "@/store/clock";
import { getState, registerReset, update } from "@/store/core";
import { findVariant, logActivity, moveStock } from "@/store/flows";
import type { ActionResult, Minor, PurchaseOrder, PurchaseOrderStatus, Supplier } from "@/store/types";

let seq = 1;
registerReset(() => {
  seq = 1;
});
const uid = (prefix: string) => `${prefix}_b4_${seq++}`;
const fail = (code: string): { ok: false; code: string; message: string } => ({ ok: false, code, message: code });

export type SupplierInput = { name: string; contactName: string; email: string; phone: string; country: string; notes: string; isActive: boolean };

function supplierProblem(input: SupplierInput): string | null {
  if (!input.name.trim() || input.name.length > 80) return "name";
  if (input.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) return "email";
  return null;
}

const supplierFields = (input: SupplierInput) => ({ name: input.name.trim(), contactName: input.contactName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), country: input.country.trim(), notes: input.notes.trim(), isActive: input.isActive });

export function createSupplier(input: SupplierInput): ActionResult<{ id: string }> {
  const problem = supplierProblem(input);
  if (problem) return fail(problem);
  const row: Supplier = { id: uid("sup"), ...supplierFields(input) };
  update((state) => ({ ...state, suppliers: [...state.suppliers, row] }));
  logActivity({ area: "production", action: "supplier_added", detail: row.name });
  return { ok: true, data: { id: row.id } };
}

/** A supplier with orders is switched off, never deleted. */
export function saveSupplier(id: string, input: SupplierInput): ActionResult {
  if (!getState().suppliers.some((s) => s.id === id)) return fail("not_found");
  const problem = supplierProblem(input);
  if (problem) return fail(problem);
  update((state) => ({ ...state, suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...supplierFields(input) } : s)) }));
  logActivity({ area: "production", action: "supplier_saved", detail: input.name.trim() });
  return { ok: true, data: undefined };
}

export type PoInput = { supplierId: string; kind: "production" | "sample"; dropId: string | null; currency: string; orderedOn: string | null; expectedOn: string | null; shippingMinor: Minor | null; notes: string; status?: PurchaseOrderStatus };

export const poProblem = (input: PoInput): PoInputProblem | null => poInputProblem(input);

export function createPurchaseOrder(input: PoInput): ActionResult<{ id: string; number: string }> {
  const problem = poProblem(input);
  if (problem) return fail(problem);
  const s = getState();
  if (!s.suppliers.some((x) => x.id === input.supplierId)) return fail("supplier");
  const number = nextPoNumber(s.purchaseOrders);
  const row: PurchaseOrder = {
    id: uid("po"), number, kind: input.kind, status: "draft", currency: input.currency, supplierId: input.supplierId, dropId: input.dropId, orderedOn: input.orderedOn, expectedOn: input.expectedOn,
    receivedAt: null, notes: input.notes.trim(), financeEntryId: null, shippingMinor: input.shippingMinor ?? 0, lines: [],
  };
  update((state) => ({ ...state, purchaseOrders: [row, ...state.purchaseOrders] }));
  logActivity({ area: "production", action: "po_created", detail: number });
  return { ok: true, data: { id: row.id, number } };
}

/** A closed order no longer changes. `received` cannot be picked by hand. */
export function savePurchaseOrder(id: string, input: PoInput): ActionResult {
  const row = getState().purchaseOrders.find((p) => p.id === id);
  if (!row) return fail("not_found");
  if (isClosedPo(row.status)) return fail("closed");
  if (input.status === "received") return fail("status");
  const problem = poProblem(input);
  if (problem) return fail(problem);
  update((state) => ({
    ...state,
    purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, supplierId: input.supplierId, kind: input.kind, dropId: input.dropId, currency: input.currency, orderedOn: input.orderedOn, expectedOn: input.expectedOn, shippingMinor: input.shippingMinor ?? 0, notes: input.notes.trim(), status: input.status ?? p.status } : p)),
  }));
  logActivity({ area: "production", action: "po_saved", detail: row.number });
  return { ok: true, data: undefined };
}

export function addPoLine(id: string, input: { variantId: string; quantity: number | null; unitCostMinor: Minor | null }): ActionResult<{ lineId: string }> {
  const s = getState();
  const row = s.purchaseOrders.find((p) => p.id === id);
  if (!row) return fail("not_found");
  if (isClosedPo(row.status)) return fail("closed");
  const found = findVariant(s, input.variantId);
  if (!found) return fail("size");
  if (input.quantity === null || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000) return fail("quantity");
  if (input.unitCostMinor === null || !Number.isInteger(input.unitCostMinor) || input.unitCostMinor < 0) return fail("cost");
  if (row.lines.some((l) => l.variantId === input.variantId)) return fail("line_exists");
  const lineId = uid("pol");
  const line = { id: lineId, variantId: input.variantId, productName: found.product.nameEn, size: found.variant.size, sku: found.variant.sku, quantity: input.quantity, unitCostMinor: input.unitCostMinor, receivedQuantity: 0 };
  update((state) => ({ ...state, purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, lines: [...p.lines, line] } : p)) }));
  logActivity({ area: "production", action: "po_line_added", detail: `${row.number} ${line.sku}` });
  return { ok: true, data: { lineId } };
}

export function removePoLine(id: string, lineId: string): ActionResult {
  const row = getState().purchaseOrders.find((p) => p.id === id);
  const line = row?.lines.find((l) => l.id === lineId);
  if (!row || !line) return fail("not_found");
  if (isClosedPo(row.status)) return fail("closed");
  if (line.receivedQuantity > 0) return fail("received");
  update((state) => ({ ...state, purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, lines: p.lines.filter((l) => l.id !== lineId) } : p)) }));
  logActivity({ area: "production", action: "po_line_removed", detail: `${row.number} ${line.sku}` });
  return { ok: true, data: undefined };
}

export type ReceiveResult = { pieces: number; skipped: string[]; costsUpdated: number };

/**
 * Books the outstanding pieces of every size that still exists, as a delivery with the order's number as its note,
 * then closes the order. A second try is refused, so an order can only ever book once.
 */
export function receivePurchaseOrder(id: string, opts: { updateCosts: boolean }): ActionResult<ReceiveResult> {
  const s = getState();
  const row = s.purchaseOrders.find((p) => p.id === id);
  if (!row) return fail("not_found");
  if (isClosedPo(row.status)) return fail("closed");
  if (row.lines.length === 0) return fail("no_lines");
  const { pieces, skipped } = toReceive(row.lines, (variantId) => findVariant(s, variantId) !== null);
  for (const line of row.lines) {
    const outstanding = Math.max(0, line.quantity - line.receivedQuantity);
    if (outstanding && findVariant(getState(), line.variantId)) moveStock({ variantId: line.variantId, delta: outstanding, reason: "delivery", note: row.number });
  }
  let costsUpdated = 0;
  if (opts.updateCosts && takesCostPrices(row) && hasFullPowers(s.profile)) {
    const units = poTotals(row.lines, row.shippingMinor).units;
    const perProduct = new Map<string, { pieces: number; total: number }>();
    for (const line of row.lines) {
      const found = findVariant(s, line.variantId);
      if (!found) continue;
      const entry = perProduct.get(found.product.id) ?? { pieces: 0, total: 0 };
      entry.pieces += line.quantity;
      entry.total += line.quantity * landedUnitCost(line.unitCostMinor, units, row.shippingMinor);
      perProduct.set(found.product.id, entry);
    }
    costsUpdated = perProduct.size;
    update((state) => ({
      ...state,
      products: state.products.map((p) => {
        const entry = perProduct.get(p.id);
        return entry ? { ...p, costRappen: Math.round(entry.total / entry.pieces) } : p;
      }),
    }));
  }
  const at = now();
  update((state) => ({
    ...state,
    purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, status: "received", receivedAt: at, lines: p.lines.map((l) => (findVariant(state, l.variantId) ? { ...l, receivedQuantity: l.quantity } : l)) } : p)),
  }));
  logActivity({ area: "production", action: "po_received", detail: `${row.number}: ${pieces}` });
  return { ok: true, data: { pieces, skipped, costsUpdated } };
}

export function linkPoLedger(id: string, entryId: string | null): ActionResult {
  const s = getState();
  const row = s.purchaseOrders.find((p) => p.id === id);
  if (!row) return fail("not_found");
  if (row.status !== "received") return fail("not_received");
  if (entryId && !s.ledger.some((e) => e.id === entryId)) return fail("entry");
  update((state) => ({ ...state, purchaseOrders: state.purchaseOrders.map((p) => (p.id === id ? { ...p, financeEntryId: entryId } : p)) }));
  logActivity({ area: "production", action: entryId ? "po_ledger_linked" : "po_ledger_unlinked", detail: row.number });
  return { ok: true, data: undefined };
}

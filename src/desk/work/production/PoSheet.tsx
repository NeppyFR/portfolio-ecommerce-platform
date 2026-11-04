"use client";

import { Ban, CalendarClock, Check, ClipboardList, Factory, PackageCheck, Pencil, Plus, Ship, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EDITABLE_PO_STATUSES, isClosedPo, landedCostPerPiece, PO_CURRENCIES, poTotals, takesCostPrices, toReceive } from "@/desk/commerce/products/rules";
import { amountText, AmountField, emptyToNull, MoreLink, parseAmount, parseWhole, Pill } from "@/desk/commerce/products/shared";
import { fmt, plural, useLang, useT } from "@/i18n";
import { production as dict } from "@/i18n/dict/production";
import { seedText } from "@/i18n/dict/seed-text";
import { hasFullPowers } from "@/lib/features";
import { formatChf, formatDate, formatMinor } from "@/lib/format";
import { compareVariants, sizeLabel } from "@/lib/product-rules";
import { addPoLine, createPurchaseOrder, createSupplier, linkPoLedger, receivePurchaseOrder, removePoLine, savePurchaseOrder, saveSupplier, type PoInput, type SupplierInput } from "@/store/actions/production";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import { findVariant } from "@/store/flows";
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Supplier, Tone } from "@/store/types";
import { Button, Checkbox, DateInput, Dialog, IconButton, Input, Select, Sheet, Switch, Table, Textarea, toast, type Column } from "@/ui";

type T = (typeof dict)["en"];

const STATUS_LOOK: Record<PurchaseOrderStatus, { tone: Tone | "plan"; icon: LucideIcon }> = {
  draft: { tone: "off", icon: ClipboardList },
  ordered: { tone: "plan", icon: CalendarClock },
  in_production: { tone: "warn", icon: Factory },
  shipped: { tone: "ok", icon: Ship },
  received: { tone: "ok", icon: Check },
  cancelled: { tone: "off", icon: Ban },
};

export function PoStatus({ status, t }: { status: PurchaseOrderStatus; t: T }) {
  const look = STATUS_LOOK[status];
  return (
    <Pill tone={look.tone} icon={look.icon}>
      {t.status[status]}
    </Pill>
  );
}

const TRACK: PurchaseOrderStatus[] = ["draft", "ordered", "in_production", "shipped", "received"];

function PoTrack({ status, t }: { status: PurchaseOrderStatus; t: T }) {
  const at = TRACK.indexOf(status);
  return (
    <ol className="cat-po-track">
      {TRACK.map((step, i) => (
        <li key={step} data-on={i <= at || undefined} aria-current={i === at ? "step" : undefined}>
          <i aria-hidden="true" />
          {t.status[step]}
        </li>
      ))}
    </ol>
  );
}

const blankSupplier: SupplierInput = { name: "", contactName: "", email: "", phone: "", country: "", notes: "", isActive: true };
const supplierInput = (s: Supplier): SupplierInput => ({ name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, country: s.country, notes: s.notes, isActive: s.isActive });

/** One dialog with two views: the list, and the form for one supplier. */
export function SuppliersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(dict);
  const suppliers = useStore((s) => s.suppliers);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [value, setValue] = useState<SupplierInput>(blankSupplier);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);
  const start = (row: Supplier | null) => {
    setValue(row ? supplierInput(row) : blankSupplier);
    setProblem(null);
    setEditing(row ? row.id : "new");
  };
  const row = suppliers.find((s) => s.id === editing) ?? null;
  const submit = () => {
    const result = row ? saveSupplier(row.id, value) : createSupplier(value);
    if (!result.ok) {
      setProblem(result.code);
      return;
    }
    toast(row ? t.suppliers.saved : t.suppliers.added);
    setEditing(null);
  };
  if (editing) {
    return (
      <Dialog open={open} onClose={() => setEditing(null)} title={row ? fmt(t.suppliers.edit, { name: row.name }) : t.suppliers.add} cancelLabel={t.suppliers.back} confirmLabel={t.suppliers.save} onConfirm={submit}>
        <Input label={t.suppliers.name} maxLength={80} value={value.name} error={problem === "name" ? t.suppliers.errName : null} onChange={(e) => setValue({ ...value, name: e.target.value })} />
        <Input label={t.suppliers.contact} maxLength={80} value={value.contactName} onChange={(e) => setValue({ ...value, contactName: e.target.value })} />
        <Input label={t.suppliers.email} type="email" maxLength={120} value={value.email} error={problem === "email" ? t.suppliers.errEmail : null} onChange={(e) => setValue({ ...value, email: e.target.value })} />
        <div className="cat-fields">
          <Input label={t.suppliers.phone} maxLength={40} value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} />
          <Input label={t.suppliers.country} maxLength={40} value={value.country} onChange={(e) => setValue({ ...value, country: e.target.value })} />
        </div>
        <Textarea label={t.suppliers.notes} rows={2} maxLength={500} value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} />
        <Switch label={t.suppliers.inUse} checked={value.isActive} onChange={(e) => setValue({ ...value, isActive: e.target.checked })} />
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={t.suppliers.title}>
      <p className="type-small cat-sub">{t.suppliers.body}</p>
      {suppliers.length === 0 ? (
        <p className="type-small cat-sub">{t.suppliers.empty}</p>
      ) : (
        <ul className="cat-list">
          {suppliers.map((s) => (
            <li key={s.id}>
              <span className="cat-prod-text cat-grow">
                <span className="cat-name">
                  {s.name}
                  {s.isActive ? null : <span className="cat-off-tag type-mono-s">{t.suppliers.off}</span>}
                </span>
                <span className="type-small cat-sub">{[s.contactName, s.country].filter(Boolean).join(" · ")}</span>
              </span>
              <IconButton aria-label={fmt(t.suppliers.edit, { name: s.name })} title={fmt(t.suppliers.edit, { name: s.name })} onClick={() => start(s)}>
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" onClick={() => start(null)}>
          <Plus size={16} aria-hidden="true" />
          {t.suppliers.add}
        </Button>
      </div>
    </Dialog>
  );
}

/** New order, and the same fields as `Details` on an open order. Status only shows when editing. */
export function OrderDialog({ open, order, onClose, onCreated }: { open: boolean; order: PurchaseOrder | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const t = useT(dict);
  const suppliers = useStore((s) => s.suppliers);
  const drops = useStore((s) => s.drops);
  const [supplierId, setSupplierId] = useState("");
  const [kind, setKind] = useState<PoInput["kind"]>("production");
  const [dropId, setDropId] = useState("");
  const [currency, setCurrency] = useState("CHF");
  const [orderedOn, setOrderedOn] = useState(DEMO_TODAY);
  const [expectedOn, setExpectedOn] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus>("draft");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSupplierId(order?.supplierId ?? suppliers.find((s) => s.isActive)?.id ?? "");
    setKind(order?.kind ?? "production");
    setDropId(order?.dropId ?? "");
    setCurrency(order?.currency ?? "CHF");
    setOrderedOn(order ? (order.orderedOn ?? "") : DEMO_TODAY);
    setExpectedOn(order?.expectedOn ?? "");
    setShipping(order && order.shippingMinor > 0 ? amountText(order.shippingMinor) : "");
    setNotes(order?.notes ?? "");
    setStatus(order?.status ?? "draft");
    setProblem(null);
  }, [open, order, suppliers]);
  const submit = () => {
    const input: PoInput = { supplierId, kind, dropId: dropId || null, currency, orderedOn: emptyToNull(orderedOn), expectedOn: emptyToNull(expectedOn), shippingMinor: parseAmount(shipping) ?? 0, notes };
    if (order) {
      const result = savePurchaseOrder(order.id, { ...input, status });
      if (!result.ok) {
        setProblem(result.code);
        return;
      }
      toast(t.saved);
      onClose();
      return;
    }
    const result = createPurchaseOrder(input);
    if (!result.ok) {
      setProblem(result.code);
      return;
    }
    toast(fmt(t.created, { number: result.data.number }));
    onClose();
    onCreated?.(result.data.id);
  };
  const usable = suppliers.filter((s) => s.isActive || s.id === order?.supplierId);
  return (
    <Dialog open={open} onClose={onClose} title={order ? fmt(t.form.editTitle, { number: order.number }) : t.form.newTitle} confirmLabel={t.form.save} cancelLabel={t.form.cancel} onConfirm={submit}>
      {order ? null : <p className="type-small cat-sub">{t.form.body}</p>}
      <Select label={t.form.supplier} value={supplierId} error={problem === "supplier" ? t.form.errSupplier : null} onChange={(e) => setSupplierId(e.target.value)}>
        {usable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <div className="cat-fields">
        <Select label={t.form.kind} value={kind} onChange={(e) => setKind(e.target.value as PoInput["kind"])}>
          <option value="production">{t.kind.production}</option>
          <option value="sample">{t.kind.sample}</option>
        </Select>
        <Select label={t.form.currency} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {PO_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <Select label={t.form.drop} value={dropId} onChange={(e) => setDropId(e.target.value)}>
        <option value="">{t.form.noDrop}</option>
        {drops.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <div className="cat-fields">
        <DateInput label={t.form.orderedOn} value={orderedOn} onChange={(e) => setOrderedOn(e.target.value)} />
        <DateInput label={t.form.expectedOn} value={expectedOn} error={problem === "dates" ? t.form.errDates : null} onChange={(e) => setExpectedOn(e.target.value)} />
      </div>
      <AmountField label={t.form.shipping} hint={t.form.shippingHint} text={shipping} onText={setShipping} currency={currency} error={problem === "shipping" ? t.form.errShipping : null} />
      {order ? (
        <Select label={t.form.status} value={status} onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus)}>
          {EDITABLE_PO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </Select>
      ) : null}
      <Textarea label={t.form.notes} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Dialog>
  );
}

function AddLineForm({ order, t }: { order: PurchaseOrder; t: T }) {
  const lang = useLang();
  const products = useStore((s) => s.products);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const taken = useMemo(() => new Set(order.lines.map((l) => l.variantId)), [order.lines]);
  const submit = () => {
    if (!variantId) {
      setProblem("size");
      return;
    }
    const result = addPoLine(order.id, { variantId, quantity: parseWhole(qty), unitCostMinor: parseAmount(cost) });
    if (!result.ok) {
      setProblem(result.code);
      return;
    }
    toast(t.order.lineSaved);
    setProblem(null);
    setVariantId("");
    setQty("");
    setCost("");
  };
  return (
    <form
      className="cat-po-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Select label={t.order.pickSize} className="cat-po-add-size" value={variantId} error={problem === "size" ? t.order.errSize : problem === "line_exists" ? t.order.errExists : null} onChange={(e) => setVariantId(e.target.value)}>
        <option value="">{t.order.pickSizePrompt}</option>
        {products.map((p) => (
          <optgroup key={p.id} label={lang === "de" ? p.nameDe : p.nameEn}>
            {p.variants
              .slice()
              .sort(compareVariants)
              .map((v) => (
                <option key={v.id} value={v.id} disabled={taken.has(v.id)}>
                  {sizeLabel(v.size, lang)} · {v.sku}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      <Input label={t.order.qty} inputMode="numeric" value={qty} error={problem === "quantity" ? t.order.errQty : null} onChange={(e) => setQty(e.target.value)} />
      <AmountField label={fmt(t.order.unitCostIn, { currency: order.currency })} text={cost} onText={setCost} currency={order.currency} error={problem === "cost" ? t.order.errCost : null} />
      <Button type="submit" variant="outline">
        <Plus size={16} aria-hidden="true" />
        {t.order.addLine}
      </Button>
    </form>
  );
}

function ReceiveDialog({ open, order, onClose, t }: { open: boolean; order: PurchaseOrder; onClose: () => void; t: T }) {
  const state = useStore((s) => s);
  const [updateCosts, setUpdateCosts] = useState(false);
  useEffect(() => {
    if (open) setUpdateCosts(false);
  }, [open]);
  const { pieces, skipped } = useMemo(() => toReceive(order.lines, (id) => findVariant(state, id) !== null), [order.lines, state]);
  const canCost = takesCostPrices(order) && hasFullPowers(state.profile);
  const submit = () => {
    const result = receivePurchaseOrder(order.id, { updateCosts });
    onClose();
    if (!result.ok) {
      toast(t.receive.refused);
      return;
    }
    const { pieces: booked, skipped: gone, costsUpdated } = result.data;
    toast(booked > 0 ? fmt(plural(booked, t.receive.doneOne, t.receive.done), { n: booked }) : fmt(t.receive.closed, { number: order.number }));
    if (costsUpdated > 0) toast(fmt(plural(costsUpdated, t.receive.costsDoneOne, t.receive.costsDone), { n: costsUpdated }));
    if (gone.length > 0) toast(fmt(plural(gone.length, t.receive.skippedOne, t.receive.skipped), { n: gone.length, skus: gone.join(", ") }));
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.receive.title, { number: order.number })} confirmLabel={pieces > 0 ? fmt(plural(pieces, t.receive.confirmOne, t.receive.confirm), { n: pieces }) : t.receive.close} onConfirm={submit}>
      <p className="type-body">{pieces > 0 ? fmt(plural(pieces, t.receive.bodyOne, t.receive.body), { n: pieces, number: order.number }) : fmt(t.receive.closeBody, { number: order.number })}</p>
      {skipped.length ? <p className="type-small cat-note" data-tone="warn">{fmt(plural(skipped.length, t.receive.goneOne, t.receive.gone), { n: skipped.length, skus: skipped.join(", ") })}</p> : null}
      {canCost ? (
        <div>
          <Checkbox label={t.receive.costs} checked={updateCosts} onChange={(e) => setUpdateCosts(e.target.checked)} />
          <p className="ui-field-hint">{t.receive.costsHint}</p>
        </div>
      ) : null}
    </Dialog>
  );
}

function LedgerSection({ order, t }: { order: PurchaseOrder; t: T }) {
  const lang = useLang();
  const ledger = useStore((s) => s.ledger);
  const [entry, setEntry] = useState(order.financeEntryId ?? "");
  useEffect(() => setEntry(order.financeEntryId ?? ""), [order.financeEntryId]);
  const options = useMemo(() => {
    const expenses = ledger.filter((e) => e.amountRappen < 0 || e.id === order.financeEntryId).slice();
    expenses.sort((a, b) => (e2n(b.id === order.financeEntryId) - e2n(a.id === order.financeEntryId)) || b.occurredOn.localeCompare(a.occurredOn));
    return expenses.slice(0, 80);
  }, [ledger, order.financeEntryId]);
  return (
    <section className="cat-section">
      <h3 className="type-h3">{t.ledger.title}</h3>
      <p className="type-small cat-sub">{t.ledger.body}</p>
      <form
        className="cat-filter"
        onSubmit={(e) => {
          e.preventDefault();
          if (linkPoLedger(order.id, entry || null).ok) toast(t.ledger.saved);
        }}
      >
        <Select label={t.ledger.pick} className="cat-filter-grow" value={entry} onChange={(e) => setEntry(e.target.value)}>
          <option value="">{t.ledger.none}</option>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {formatDate(e.occurredOn)} · {seedText(e.title, lang)} · {formatChf(e.amountRappen)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          {t.ledger.save}
        </Button>
        <MoreLink href="/desk/finance/">{t.ledger.open}</MoreLink>
      </form>
    </section>
  );
}

const e2n = (flag: boolean) => (flag ? 1 : 0);

function PoBody({ order, t }: { order: PurchaseOrder; t: T }) {
  const lang = useLang();
  const state = useStore((s) => s);
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const closed = isClosedPo(order.status);
  const totals = poTotals(order.lines, order.shippingMinor);
  const landed = landedCostPerPiece(totals);
  const supplier = state.suppliers.find((s) => s.id === order.supplierId);
  const drop = state.drops.find((d) => d.id === order.dropId);
  const meta = [
    supplier?.name,
    t.kind[order.kind],
    drop?.name,
    order.orderedOn ? fmt(t.order.orderedOn, { date: formatDate(order.orderedOn) }) : null,
    order.receivedAt ? fmt(t.order.receivedOn, { date: formatDate(order.receivedAt) }) : order.expectedOn ? fmt(t.order.expectedOn, { date: formatDate(order.expectedOn) }) : null,
  ].filter(Boolean);
  const lineName = (line: PurchaseOrderLine) => {
    const found = findVariant(state, line.variantId);
    return found ? (lang === "de" ? found.product.nameDe : found.product.nameEn) : line.productName;
  };
  const skuCell = (line: PurchaseOrderLine) => (
    <span className="cat-prod-text">
      <span className="cat-mono">{line.sku}</span>
      {findVariant(state, line.variantId) ? null : <span className="type-small cat-amber">{t.order.sizeGone}</span>}
    </span>
  );
  const receivedCell = (line: PurchaseOrderLine) => <span className={`cat-mono ${line.receivedQuantity >= line.quantity ? "cat-done" : ""}`}>{line.receivedQuantity}</span>;
  const removeLine = (line: PurchaseOrderLine) =>
    !closed && line.receivedQuantity === 0 ? (
      <IconButton
        aria-label={fmt(t.order.removeLine, { sku: line.sku })}
        title={fmt(t.order.removeLine, { sku: line.sku })}
        onClick={(e) => {
          e.stopPropagation();
          if (removePoLine(order.id, line.id).ok) toast(t.order.lineRemoved);
        }}
      >
        <Trash2 size={16} aria-hidden="true" />
      </IconButton>
    ) : null;
  const columns: Column<PurchaseOrderLine>[] = [
    { key: "product", header: t.order.product, cell: lineName },
    { key: "size", header: t.order.size, cell: (l) => sizeLabel(l.size, lang) },
    { key: "sku", header: t.order.sku, cell: skuCell },
    { key: "qty", header: t.order.qty, align: "right", cell: (l) => <span className="cat-mono">{l.quantity}</span> },
    { key: "cost", header: t.order.unitCost, align: "right", cell: (l) => <span className="cat-mono">{formatMinor(l.unitCostMinor, order.currency)}</span> },
    { key: "line", header: t.order.lineTotal, align: "right", cell: (l) => <span className="cat-mono">{formatMinor(l.quantity * l.unitCostMinor, order.currency)}</span> },
    { key: "received", header: t.order.received, align: "right", cell: receivedCell },
    ...(closed ? [] : [{ key: "remove", header: <span className="sr-only">{t.order.removeLine.replace(" {sku}", "").replace("{sku} ", "")}</span>, align: "right" as const, cell: removeLine }]),
  ];
  const phoneRow = (l: PurchaseOrderLine) => (
    <div className="cat-card">
      <div className="cat-card-top">
        <span className="cat-name">
          {lineName(l)} · {sizeLabel(l.size, lang)}
        </span>
        {removeLine(l)}
      </div>
      <div className="type-small">{skuCell(l)}</div>
      <div className="cat-card-meta type-small">
        <span>
          {l.quantity} × {formatMinor(l.unitCostMinor, order.currency)}
        </span>
        <span className="cat-mono">{formatMinor(l.quantity * l.unitCostMinor, order.currency)}</span>
        <span>
          {t.order.received}: {l.receivedQuantity}
        </span>
      </div>
    </div>
  );
  return (
    <div className="cat-stack">
      <header className="cat-hub-head f-order">
        <div className="cat-hub-head-top">
          <PoStatus status={order.status} t={t} />
          {closed ? null : (
            <span className="cat-actions">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden="true" />
                {t.order.details}
              </Button>
              <Button disabled={order.lines.length === 0} onClick={() => setReceiving(true)}>
                <PackageCheck size={16} aria-hidden="true" />
                {t.receive.open}
              </Button>
            </span>
          )}
        </div>
        <p className="type-body">{meta.join(" · ")}</p>
        {order.notes ? <p className="type-small">{order.notes}</p> : null}
        {order.status === "cancelled" ? null : <PoTrack status={order.status} t={t} />}
      </header>
      {closed ? <p className="type-small cat-note">{order.status === "received" ? t.order.closedReceived : t.order.closedCancelled}</p> : null}
      <section className="cat-section">
        <h3 className="type-h3">{t.order.lines}</h3>
        {order.lines.length === 0 ? <p className="type-small cat-sub">{t.order.linesEmpty}</p> : <Table columns={columns} rows={order.lines} rowKey={(l) => l.id} phoneRow={phoneRow} caption={t.order.lines} />}
        {closed ? null : <AddLineForm order={order} t={t} />}
        <dl className="cat-totals type-small">
          <dt>{t.order.goods}</dt>
          <dd className="cat-mono">{formatMinor(totals.goodsMinor, order.currency)}</dd>
          <dt>{t.order.shipping}</dt>
          <dd className="cat-mono">{formatMinor(totals.shippingMinor, order.currency)}</dd>
          <dt className="cat-totals-strong">{t.order.total}</dt>
          <dd className="cat-mono cat-totals-strong">{formatMinor(totals.totalMinor, order.currency)}</dd>
          {landed !== null ? (
            <>
              <dt>{t.order.landed}</dt>
              <dd className="cat-mono">{formatMinor(landed, order.currency)}</dd>
            </>
          ) : null}
        </dl>
      </section>
      {order.status === "received" ? <LedgerSection order={order} t={t} /> : null}
      <OrderDialog open={editing} order={order} onClose={() => setEditing(false)} />
      <ReceiveDialog open={receiving} order={order} onClose={() => setReceiving(false)} t={t} />
    </div>
  );
}

/** The wide purchase order sheet: `?open=<id>`. An unknown id keeps it closed. */
export function PoSheet({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const t = useT(dict);
  const order = useStore((s) => (openId ? (s.purchaseOrders.find((p) => p.id === openId) ?? null) : null));
  return (
    <Sheet open={order !== null} onClose={onClose} title={<span className="cat-mono-title">{order?.number ?? ""}</span>} wide>
      {order ? <PoBody key={order.id} order={order} t={t} /> : null}
    </Sheet>
  );
}


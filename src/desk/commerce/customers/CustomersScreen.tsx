"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Download, ShieldAlert, Trash2, Users } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { customers as dict } from "@/i18n/dict/customers";
import { hasFullPowers } from "@/lib/features";
import { formatChf, formatDate, formatDateTime } from "@/lib/format";
import { downloadJson } from "@/lib/download";
import { sizeLabel } from "@/lib/product-rules";
import { orderHref, setParams } from "@/lib/routes";
import { shownName } from "@/desk/commerce/orders/rules/order-rules";
import { addCustomerNote, eraseCustomer, removeCustomerNote } from "@/store/actions/customers";
import { getState, useStore } from "@/store/core";
import type { Customer, Order, SizeCode } from "@/store/types";
import { Button, Dialog, Empty, IconButton, Input, Money, OrderStatus, Pager, RuleLine, Sheet, Stat, Status, Table, Textarea, toast, usePageSize, type Column } from "@/ui";
import { customerExport, customerRows, hasOpenBusiness, repeatCount, searchCustomers, type CustomerRow } from "./rules";
import "@/desk/commerce/orders/orders.css";
import "./customers.css";

export function CustomersScreen() {
  const t = useT(dict);
  const params = useSearchParams();
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const pageSize = usePageSize();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const all = useMemo(() => customerRows(customers, orders), [customers, orders]);
  const rows = useMemo(() => searchCustomers(all, q), [all, q]);
  const people = useMemo(() => all.filter((r) => !r.erased).length, [all]);
  const repeat = useMemo(() => repeatCount(all), [all]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);

  const openId = params.get("open");
  const open = openId ? customers.find((c) => c.id === openId) ?? null : null;

  const columns: Column<CustomerRow>[] = [
    { key: "name", header: t.col.name, cell: (r) => <NameCell row={r} /> },
    { key: "email", header: t.col.email, cell: (r) => (r.erased ? <span className="or-muted">–</span> : <span className="cu-email">{r.email}</span>) },
    { key: "orders", header: t.col.orders, align: "right", cell: (r) => <span className="type-mono">{r.orders}</span> },
    { key: "spent", header: t.col.spent, align: "right", cell: (r) => <Money value={r.spentRappen} /> },
    { key: "last", header: t.col.last, align: "right", cell: (r) => <span className="type-mono-s">{r.lastOrderAt ? formatDate(r.lastOrderAt) : "–"}</span> },
  ];

  return (
    <>
      <PageHead id="customers" title={fmt(t.sentence, { n: people, r: repeat })} rule={<RuleLine>{t.intro}</RuleLine>} />
      <div className="or-card cu-body">
      <div className="cu-tools">
        {!q ? (
          <div className="ui-stats cu-stats">
            <Stat label={t.statTotal} value={people} />
            <Stat label={t.statRepeat} value={repeat} />
          </div>
        ) : null}
        <form className="cu-search" onSubmit={(e) => e.preventDefault()}>
          <Input label={t.search} placeholder={t.searchPlaceholder} value={q} maxLength={60} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </form>
      </div>
      <Table
        caption={t.statTotal}
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        selectedKey={open?.id ?? null}
        onRowClick={(r) => setParams({ open: r.id })}
        empty={<Empty icon={Users}>{q ? t.noMatch : t.empty}</Empty>}
        phoneRow={(r) => (
          <div className="cu-card">
            <div className="or-card-top">
              <NameCell row={r} />
              <Money value={r.spentRappen} />
            </div>
            {r.erased ? null : <span className="type-small or-muted cu-email">{r.email}</span>}
            <span className="type-mono-s or-muted">
              {r.orders === 1 ? t.cardOrdersOne : fmt(t.cardOrders, { orders: r.orders })}
              {r.lastOrderAt ? ` · ${fmt(t.cardLast, { date: formatDate(r.lastOrderAt) })}` : ""}
            </span>
          </div>
        )}
      />
      {pages > 1 ? <Pager className="or-pager" page={current} pages={pages} onPage={setPage} /> : null}
      </div>
      <Sheet open={Boolean(open)} onClose={() => setParams({ open: null })} title={open ? shownName(open.fullName, t.erasedName) : t.statTotal}>
        {open ? <CustomerDetail key={open.id} customer={open} /> : null}
      </Sheet>
    </>
  );
}

function NameCell({ row }: { row: CustomerRow }) {
  const t = useT(dict);
  return (
    <span className="cu-name" data-erased={row.erased || undefined}>
      <span>{shownName(row.fullName, t.erasedName)}</span>
      {row.erased ? <Status tone="off">{t.erased}</Status> : null}
    </span>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const t = useT(dict);
  const allOrders = useStore((s) => s.orders);
  const orders = useMemo(() => allOrders.filter((o) => o.customerId === customer.id).sort((a, b) => b.placedAt.localeCompare(a.placedAt)), [allOrders, customer.id]);
  const spent = useMemo(() => orders.reduce((sum, o) => (o.paidAt ? sum + o.totalRappen - o.refundedRappen : sum), 0), [orders]);
  return (
    <div className="cu-detail">
      <header className="cu-head">
        <div className="cu-head-text">
          {customer.erased ? null : (
            <>
              <p className="type-small cu-email">{customer.email}</p>
              <p className="type-small cu-keep">{customer.phone}</p>
            </>
          )}
          <p className="type-small or-muted">
            <span className="cu-keep">{fmt(t.detail.since, { date: formatDate(customer.createdAt) })}</span>
            {" · "}
            <span className="cu-keep">{fmt(t.detail.language, { locale: customer.locale === "de" ? t.detail.de : t.detail.en })}</span>
          </p>
        </div>
        <div className="cu-spent">
          <p className="type-small or-muted">{t.detail.spent}</p>
          <p className="type-stat">{formatChf(spent)}</p>
        </div>
      </header>

      {customer.erased ? (
        <p className="cu-banner type-small" role="status">
          <ShieldAlert size={16} aria-hidden="true" />
          {fmt(t.detail.erasedOn, { date: formatDate(customer.erasedAt ?? customer.createdAt) })}
        </p>
      ) : null}

      <section className="cu-sec">
        <h3 className="type-h4">{t.detail.orders}</h3>
        {orders.length === 0 ? <p className="type-small or-muted">{t.detail.ordersEmpty}</p> : <OrderList orders={orders} />}
      </section>

      {customer.erased ? null : <Notes customer={customer} />}

      <section className="cu-sec">
        <h3 className="type-h4">{t.detail.addresses}</h3>
        {customer.addresses.length === 0 ? (
          <p className="type-small or-muted">{t.detail.addressesEmpty}</p>
        ) : (
          <ul className="cu-addresses">
            {customer.addresses.map((a, i) => (
              <li key={a.id ?? i} className="type-small">
                <p className="type-label">
                  {shownName(a.fullName, t.erasedName)}
                  {a.isDefault ? <span className="cu-tag type-mono-s">{t.detail.default}</span> : null}
                </p>
                <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                <p>{a.postalCode} {a.city}, {t.detail.country}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {customer.waitlist.length > 0 ? <Waitlists customer={customer} /> : null}

      {customer.erased ? null : <DataRequest customer={customer} orders={orders} />}
    </div>
  );
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <ul className="cu-orders">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={orderHref(o.orderNumber)} className="cu-order">
            <span className="cu-order-id">
              <span className="type-mono">{o.orderNumber}</span>
              <span className="type-mono-s or-muted">{formatDateTime(o.placedAt)}</span>
            </span>
            <OrderStatus status={o.status} />
            <Money value={o.totalRappen} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Notes({ customer }: { customer: Customer }) {
  const t = useT(dict);
  const [body, setBody] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = addCustomerNote(customer.id, body);
    if (result.ok) {
      toast(t.notes.added);
      setBody("");
    }
  };
  return (
    <section className="cu-sec">
      <h3 className="type-h4">{t.notes.title}</h3>
      <p className="type-small or-muted">{t.notes.body}</p>
      {customer.notes.length === 0 ? (
        <p className="type-small or-muted">{t.notes.empty}</p>
      ) : (
        <ul className="cu-notes">
          {customer.notes.map((note) => (
            <li key={note.id}>
              <div>
                <p className="type-body">{note.body}</p>
                <p className="type-small or-muted">{note.author} · {formatDateTime(note.createdAt)}</p>
              </div>
              <IconButton
                aria-label={t.notes.remove}
                title={t.notes.remove}
                onClick={() => {
                  removeCustomerNote(customer.id, note.id);
                  toast(t.notes.removed);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form className="or-note-form" onSubmit={submit}>
        <Textarea label={t.notes.label} placeholder={t.notes.placeholder} maxLength={2000} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!body.trim()}>{t.notes.add}</Button>
      </form>
    </section>
  );
}

function Waitlists({ customer }: { customer: Customer }) {
  const t = useT(dict);
  const lang = useLang();
  return (
    <section className="cu-sec">
      <h3 className="type-h4">{t.detail.waitlist}</h3>
      <ul className="cu-waitlist type-small">
        {customer.waitlist.map((w, i) => (
          <li key={i}>
            <span>
              {w.dropName} · {w.size ? sizeLabel(w.size as SizeCode, lang) : t.detail.anySize}
            </span>
            {w.notified ? <Status tone="ok">{t.detail.told}</Status> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DataRequest({ customer, orders }: { customer: Customer; orders: Order[] }) {
  const t = useT(dict);
  const profile = useStore((s) => s.profile);
  const returns = useStore((s) => s.returns);
  const [erasing, setErasing] = useState(false);
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const full = hasFullPowers(profile);
  const open = useMemo(() => hasOpenBusiness(customer.id, orders, returns), [customer.id, orders, returns]);
  const matches = typed.trim().toLowerCase() === customer.email.toLowerCase();

  const exportData = () => {
    const data = customerExport(getState(), customer.id);
    if (!data) return;
    downloadJson(`customer-${customer.id}`, data);
    toast(t.data.exported);
  };

  const confirm = () => {
    setTried(true);
    if (!matches) return;
    const result = eraseCustomer(customer.id, typed);
    if (result.ok) {
      toast(result.data.orders === 1 ? t.erase.doneOne : fmt(t.erase.done, { orders: result.data.orders }));
      setErasing(false);
    }
  };

  return (
    <section className="cu-sec cu-data">
      <h3 className="type-h4">{t.data.title}</h3>
      <p className="type-small">{t.data.body}</p>
      <p className="type-mono-s or-muted">{t.data.demoNote}</p>
      <div className="cu-data-actions">
        <Button variant="outline" onClick={exportData}>
          <Download size={16} aria-hidden="true" />
          {t.data.export}
        </Button>
        <Button
          variant="danger"
          disabled={!full || open}
          onClick={() => {
            setTyped("");
            setTried(false);
            setErasing(true);
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t.data.erase}
        </Button>
      </div>
      {open ? (
        <p className="cu-why type-small">
          <CircleAlert size={15} aria-hidden="true" />
          {t.data.eraseOpen}
        </p>
      ) : null}
      {!full ? <p className="type-small or-muted">{t.data.eraseOwner}</p> : null}
      <Dialog open={erasing} onClose={() => setErasing(false)} danger title={fmt(t.erase.title, { name: shownName(customer.fullName, t.erasedName) })} confirmLabel={t.erase.confirm} cancelLabel={t.erase.cancel} confirmDisabled={!matches} onConfirm={confirm}>
        <p className="type-small">{t.erase.body}</p>
        <Input label={t.erase.confirmLabel} autoComplete="off" spellCheck={false} placeholder={customer.email} value={typed} error={tried && !matches ? t.erase.mismatch : typed.length > 3 && !matches ? t.erase.mismatch : null} onChange={(e) => setTyped(e.target.value)} />
      </Dialog>
    </section>
  );
}

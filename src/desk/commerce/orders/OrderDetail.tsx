"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { BookCheck, Printer, Scale, TriangleAlert } from "lucide-react";
import { fmt, useLang, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { canAccess } from "@/lib/features";
import { formatDate, formatDateTime } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { slipHref } from "@/lib/routes";
import { addOrderNote } from "@/store/actions/orders";
import { useStore } from "@/store/core";
import { isAttentionOrder } from "@/store/selectors";
import type { Order, OrderEvent, Tone } from "@/store/types";
import { Button, ProductArt, Money, OrderStatus, RuleLine, Textarea, Thread, Tl, toast, type ThreadStop } from "@/ui";
import { OrderActions } from "./OrderActions";
import { OrderReturns } from "./OrderReturns";
import { PackByScan } from "./PackByScan";
import { colourLabel, fulfilmentState, orderPieces, paymentState, roadToBooks, shownName } from "./rules/order-rules";
import { packLines, packNeed } from "./rules/pack";

const short = (iso: string): string => {
  const text = formatDateTime(iso);
  return `${text.slice(0, 6)} ${text.slice(12)}`;
};

export function OrderDetail({ order, inSheet }: { order: Order; inSheet?: boolean }) {
  const t = useT(ordersDict);
  const c = useT(common);
  const road = roadToBooks(order);
  const attention = isAttentionOrder(order);
  const showsPacker = order.status === "paid" && paymentState(order) !== "pending" && packNeed(packLines(order)) > 0;

  const stops: ThreadStop[] = [
    { key: "placed", label: c.thread.placed, at: short(order.placedAt), done: true },
    { key: "paid", label: c.thread.paid, at: order.paidAt ? short(order.paidAt) : null, done: Boolean(order.paidAt) },
    { key: "packed", label: c.thread.packed, at: order.packedAt ? short(order.packedAt) : null, done: Boolean(order.packedAt) },
    { key: "shipped", label: c.thread.shipped, at: order.shippedAt ? short(order.shippedAt) : null, done: Boolean(order.shippedAt) },
    { key: "delivered", label: c.thread.delivered, at: order.deliveredAt ? short(order.deliveredAt) : null, done: Boolean(order.deliveredAt) },
    { key: "books", label: c.thread.books, at: road?.booked ? formatDate(road.bankDay).slice(0, 6) : null, done: Boolean(road?.booked) },
  ];

  return (
    <article className="or-detail" data-in-sheet={inSheet || undefined}>
      <header className="or-head">
        <div className="or-head-top">
          <div className="or-head-id">
            {inSheet ? null : <h2 className="or-head-number">{order.orderNumber}</h2>}
            <OrderStatus status={order.status} />
            <span className="type-small or-head-placed">{fmt(t.detail.placed, { date: formatDateTime(order.placedAt) })}</span>
          </div>
          <Link href={slipHref(order.orderNumber)} className="ui-btn ui-btn-ghost or-head-slip">
            <span className="ui-btn-label">
              <Printer size={16} aria-hidden="true" />
              {t.detail.slip}
            </span>
          </Link>
        </div>
        <Thread stops={stops} className="or-thread" />
        <OrderActions order={order} />
      </header>

      {attention ? (
        <div className="or-alert" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <p className="type-label">{t.detail.attentionTitle}</p>
            <ul className="type-small">
              {order.attentionReasons.map((reason) => (
                <li key={reason}>{t.detail.attention[reason]}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="or-body">
        <div className="or-main">
          {showsPacker ? <PackByScan order={order} /> : null}
          <Items order={order} />
          <OrderReturns order={order} />
          <Road order={order} />
          <Timeline order={order} />
          <Notes order={order} />
        </div>
        <aside className="or-aside">
          <CustomerBlock order={order} />
          <PaymentBlock order={order} />
          {order.refunds.length > 0 ? <RefundsBlock order={order} /> : null}
        </aside>
      </div>
    </article>
  );
}

function Section({ title, aside, children, icon }: { title: string; aside?: ReactNode; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="or-sec">
      <h3 className="or-sec-title type-h4">
        {icon}
        <span>{title}</span>
        {aside ? <span className="type-mono-s or-sec-aside">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Items({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const pieces = orderPieces(order);
  return (
    <Section title={t.detail.items} aside={fmt(pieces === 1 ? t.detail.piecesOne : t.detail.piecesOther, { count: pieces })}>
      <ul className="or-items">
        {order.items.map((item) => (
          <li key={item.id} className="or-item">
            <span className="or-item-thumb">
              <ProductArt type={item.art} tone={item.tone} view="mini" />
            </span>
            <div className="or-item-text">
              <Link className="or-link" href={`/desk/products/?open=${encodeURIComponent(item.productId)}`}>
                {lang === "de" ? item.nameDe : item.name}
              </Link>
              <p className="type-small or-muted or-anywhere">{[colourLabel(item.color, lang), item.size === "ONE_SIZE" ? null : sizeLabel(item.size, lang), item.sku].filter(Boolean).join(" · ")}</p>
              {item.shortfall > 0 ? <p className="type-small or-warn">{fmt(item.shortfall === 1 ? t.detail.missingOne : t.detail.missingOther, { count: item.shortfall })}</p> : null}
              {item.restocked > 0 ? <p className="type-small or-muted">{fmt(t.detail.restocked, { count: item.restocked })}</p> : null}
            </div>
            <div className="or-item-money">
              <span className="type-small or-muted">
                {item.quantity} × <Money value={item.unitPriceRappen} />
              </span>
              <Money value={item.lineTotalRappen} />
            </div>
          </li>
        ))}
      </ul>
      <dl className="or-totals">
        <div>
          <dt>{t.detail.subtotal}</dt>
          <dd><Money value={order.subtotalRappen} /></dd>
        </div>
        {order.discountRappen > 0 ? (
          <div>
            <dt>{fmt(t.detail.discountCode, { code: order.discountCode ?? "" })}</dt>
            <dd><Money value={-order.discountRappen} /></dd>
          </div>
        ) : null}
        <div>
          <dt>{t.detail.shipping}</dt>
          <dd>{order.shippingRappen > 0 ? <Money value={order.shippingRappen} /> : t.detail.free}</dd>
        </div>
        <div className="or-totals-big">
          <dt>{t.detail.total}</dt>
          <dd><Money value={order.totalRappen} /></dd>
        </div>
        {order.refundedRappen > 0 ? (
          <div>
            <dt>{t.detail.refunded}</dt>
            <dd><Money value={-order.refundedRappen} /></dd>
          </div>
        ) : null}
      </dl>
    </Section>
  );
}

function Road({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const road = roadToBooks(order);
  return (
    <Section title={t.road.title} icon={<BookCheck size={16} aria-hidden="true" />} aside={road ? (road.booked ? t.road.booked : t.road.notBooked) : t.road.notBooked}>
      {road ? (
        <>
          <dl className="or-road">
            <div>
              <dt>{t.road.paid}</dt>
              <dd><Money value={road.paid} /></dd>
            </div>
            <div>
              <dt>{t.road.fee}</dt>
              <dd><Money value={-road.fee} /></dd>
            </div>
            <div className="or-road-end">
              <dt>{t.road.bank}</dt>
              <dd>
                <Money value={road.net} />
                <span className="type-small or-muted">{fmt(t.road.onDay, { date: formatDate(road.bankDay) })}</span>
              </dd>
            </div>
          </dl>
          {road.refunded > 0 ? (
            <p className="type-small or-road-refund">
              {t.road.refunded}: <Money value={-road.refunded} />
            </p>
          ) : null}
          <RuleLine className="or-road-rule">{t.road.help}</RuleLine>
        </>
      ) : (
        <p className="type-small or-muted">{t.road.unpaid}</p>
      )}
    </Section>
  );
}

const EVENT_TONE: Partial<Record<OrderEvent["type"], Tone>> = { stock_conflict: "warn", needs_attention: "warn", cancelled: "off", refund_recorded: "bad" };

function Timeline({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const events = useMemo(() => [...order.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [order.events]);
  return (
    <Section title={t.detail.timeline}>
      <ol className="or-timeline">
        {events.map((event) => {
          const label = (t.event as Record<string, string>)[event.type] ?? event.label;
          const detail = [event.detail ? t.eventDetail[event.detail] ?? event.detail : null, event.count ? fmt(event.count === 1 ? t.event.piecesOne : t.event.piecesOther, { count: event.count }) : null].filter(Boolean).join(" · ");
          return <Tl key={event.id} label={label} date={formatDateTime(event.createdAt)} actor={event.actor === "system" ? t.event.system : event.actor} detail={detail || undefined} service={event.service} tone={EVENT_TONE[event.type]} />;
        })}
      </ol>
    </Section>
  );
}

function Notes({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const [body, setBody] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = addOrderNote(order.orderNumber, body);
    if (result.ok) {
      toast(t.detail.noteAdded);
      setBody("");
    }
  };
  return (
    <Section title={t.detail.notes}>
      {order.notes.length > 0 ? (
        <ul className="or-notes">
          {order.notes.map((note) => (
            <li key={note.id}>
              <p className="type-body">{note.body}</p>
              <p className="type-small or-muted">
                {note.author} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-small or-muted">{t.detail.noNotes}</p>
      )}
      {order.customerErased ? (
        <p className="type-small or-muted">{t.detail.notesErased}</p>
      ) : (
        <form className="or-note-form" onSubmit={submit}>
          <Textarea label={t.detail.noteLabel} placeholder={t.detail.notePlaceholder} maxLength={2000} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!body.trim()}>
            {t.detail.noteAdd}
          </Button>
        </form>
      )}
    </Section>
  );
}

function CustomerBlock({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const address = order.shippingAddress;
  const mayOpen = canAccess(profile, "customers", switches);
  return (
    <Section title={t.detail.customer}>
      <div className="or-kv-block type-small">
        <p className="type-label">{mayOpen ? <Link className="or-link" href={`/desk/customers/?open=${encodeURIComponent(order.customerId)}`}>{shownName(order.customerName, t.erasedName)}</Link> : shownName(order.customerName, t.erasedName)}</p>
        {order.customerErased ? null : <p className="or-anywhere">{order.email}</p>}
        <p>{fmt(t.detail.language, { language: order.locale === "de" ? t.detail.languageDe : t.detail.languageEn })}</p>
        {order.customerErased ? null : (
          <address className="or-address">
            {address.fullName}
            <br />
            {address.line1}
            {address.line2 ? (
              <>
                <br />
                {address.line2}
              </>
            ) : null}
            <br />
            {address.postalCode} {address.city}
            <br />
            {t.detail.switzerland}
            {address.phone ? (
              <>
                <br />
                {address.phone}
              </>
            ) : null}
          </address>
        )}
      </div>
    </Section>
  );
}

function PaymentBlock({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const rows: [string, ReactNode][] = [
    [t.detail.paymentLabel, t.payment[paymentState(order)]],
    ...(order.paidAt ? ([[t.detail.paid, formatDateTime(order.paidAt)]] as [string, ReactNode][]) : []),
    ...(order.paymentMethod ? ([[t.detail.method, order.paymentMethod === "twint" ? t.detail.twint : t.detail.card]] as [string, ReactNode][]) : []),
    [t.detail.fulfilmentLabel, t.fulfilment[fulfilmentState(order)]],
    ...(order.shippedAt ? ([[t.detail.shipped, formatDateTime(order.shippedAt)]] as [string, ReactNode][]) : []),
    ...(order.deliveredAt ? ([[t.detail.delivered, formatDateTime(order.deliveredAt)]] as [string, ReactNode][]) : []),
    ...(order.cancelledAt ? ([[t.detail.cancelled, formatDateTime(order.cancelledAt)]] as [string, ReactNode][]) : []),
    ...(order.cancelReason ? ([[t.detail.reason, order.cancelReason]] as [string, ReactNode][]) : []),
    ...(order.trackingNumber ? ([[order.trackingCarrier ?? t.detail.tracking, <span key="t" className="type-mono-s or-anywhere">{order.trackingNumber}</span>]] as [string, ReactNode][]) : []),
  ];
  return (
    <Section title={t.detail.paymentDelivery}>
      <dl className="or-kv">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function RefundsBlock({ order }: { order: Order }) {
  const t = useT(ordersDict);
  return (
    <Section title={t.detail.refunds} icon={<Scale size={16} aria-hidden="true" />}>
      <ul className="or-refunds">
        {order.refunds.map((refund) => (
          <li key={refund.id}>
            <div>
              <p className="type-label">{refund.reason || refund.returnNo || t.detail.refunds}</p>
              <p className="type-small or-muted">
                {refund.actor} · {formatDateTime(refund.createdAt)}
              </p>
            </div>
            <Money value={refund.amountRappen} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

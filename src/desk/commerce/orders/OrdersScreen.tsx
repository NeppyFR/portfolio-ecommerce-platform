"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ReceiptText, TriangleAlert, Undo2 } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { formatDateTime, dayKey } from "@/lib/format";
import { useStore } from "@/store/core";
import { attentionCount, isAttentionOrder, toPackCount } from "@/store/selectors";
import type { Order, OrderStop } from "@/store/types";
import { Button, DateInput, Empty, GlyphCluster, Input, Money, Pager, Sheet, Stops, Track, usePageSize, FLOW_STOPS, EXIT_STOPS, PAGE_SIZE_PHONE } from "@/ui";
import { OrderDetail } from "./OrderDetail";
import { pageOf, shownName } from "./rules/order-rules";
import { setParams } from "@/lib/routes";
import { classifyScan } from "./rules/scan";
import { ScanBar, type ScanMessage } from "./ScanBar";
import "./orders.css";

const WIDE = "(min-width: 1200px)";
const subscribeWide = (listener: () => void) => {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
/** Two panes from 1200 px up, which is what leaves room beside the sidebar. Below that the detail is a sheet: right side on a tablet, bottom on a phone. */
function useIsWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
}

const STOPS: OrderStop[] = [...FLOW_STOPS, ...EXIT_STOPS];
const isStop = (value: string | null): value is OrderStop => STOPS.includes(value as OrderStop);

export function OrdersScreen() {
  const t = useT(ordersDict);
  const c = useT(common);
  const params = useSearchParams();
  const orders = useStore((s) => s.orders);
  const toPack = useStore(toPackCount);
  const needYou = useStore(attentionCount);
  const openReturns = useStore((s) => s.returns.filter((r) => r.status === "requested" || r.status === "received").length);
  const wide = useIsWide();
  const pageSize = usePageSize();

  const statusParam = params.get("status");
  const active = isStop(statusParam) ? statusParam : null;
  const selectedParam = params.get("o");

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [datesOpen, setDatesOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<ScanMessage | null>(null);

  const counts = useMemo(() => {
    const out: Partial<Record<OrderStop, number>> = {};
    for (const o of orders) {
      out[o.status] = (out[o.status] ?? 0) + 1;
      if (isAttentionOrder(o)) out.attention = (out.attention ?? 0) + 1;
    }
    return out;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders
      .filter((o) => (active === "attention" ? isAttentionOrder(o) : active ? o.status === active : true))
      .filter((o) => !needle || o.orderNumber.toLowerCase().includes(needle) || o.email.toLowerCase().includes(needle) || o.customerName.toLowerCase().includes(needle))
      .filter((o) => {
        if (!from && !to) return true;
        const day = dayKey(o.placedAt);
        return (!from || day >= from) && (!to || day <= to);
      })
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  }, [orders, active, q, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const explicit = selectedParam ? orders.find((o) => o.orderNumber === selectedParam) ?? null : null;
  const shown = explicit ?? (wide ? rows[0] ?? null : null);

  const pane = useRef<HTMLElement>(null);
  useEffect(() => {
    pane.current?.scrollTo(0, 0);
  }, [shown?.orderNumber]);

  const selectedNumber = explicit?.orderNumber ?? null;
  // A deep link or a scan can pick an order on another page: go to that page, so its row carries the notch.
  useEffect(() => {
    if (!selectedNumber) return;
    const at = filtered.findIndex((o) => o.orderNumber === selectedNumber);
    if (at >= 0) setPage(pageOf(at, pageSize));
    // Only when the selection changes: paging away from a selected row stays allowed.
  }, [selectedNumber, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedNumber) return;
    document.querySelector(`[data-order="${selectedNumber}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedNumber, current]);

  const select = (number: string | null) => setParams({ o: number });
  /** On desktop with no ?o=, the pane already shows the first row, so there is nothing to open and no history entry to add. A phone shows nothing until the click, so it always opens its sheet. */
  const onRow = (number: string) => {
    if (wide && !selectedParam && shown?.orderNumber === number) return;
    select(number);
  };

  const onStop = (stop: OrderStop | null) => {
    setPage(1);
    setParams({ status: stop, o: null });
  };

  const onScan = (code: string) => {
    const scan = classifyScan(code);
    if (scan.kind !== "order") {
      setScanMessage({ tone: "bad", text: fmt(t.scan.notOrder, { code }) });
      return;
    }
    if (!orders.some((o) => o.orderNumber === scan.number)) {
      setScanMessage({ tone: "bad", text: fmt(t.scan.notFound, { number: scan.number }) });
      return;
    }
    setScanMessage({ tone: "ok", text: fmt(t.scan.opening, { number: scan.number }) });
    if (active || q || from || to) {
      setQ("");
      setFrom("");
      setTo("");
      setParams({ status: null, o: scan.number });
    } else select(scan.number);
  };

  const nextToScan = () => {
    const queue = orders.filter((o) => o.status === "paid");
    const at = shown ? queue.findIndex((o) => o.orderNumber === shown.orderNumber) : -1;
    return queue[at + 1]?.orderNumber ?? queue[0]?.orderNumber ?? orders[0]?.orderNumber ?? null;
  };

  const filteredNow = Boolean(active || q || from || to);
  const title = fmt(needYou === 1 ? t.title.sentenceOne : t.title.sentence, { n: toPack, a: needYou });

  const list = (
    <div className="or-list">
      <div className="or-list-head type-mono-s" aria-hidden="true">
        <span>{t.list.order}</span>
        <span>{t.list.customer}</span>
        <span>{t.list.items}</span>
        <span className="or-right">{t.list.total}</span>
      </div>
      {rows.length === 0 ? (
        <div className="or-list-empty">
          <Empty icon={ReceiptText} action={filteredNow ? <Button variant="outline" onClick={() => { setQ(""); setFrom(""); setTo(""); onStop(null); }}>{t.list.clear}</Button> : undefined}>
            {filteredNow ? t.list.emptyFiltered : t.list.empty}
          </Empty>
        </div>
      ) : (
        <ul className="or-rows">
          {rows.map((o) => (
            <OrderRow key={o.id} order={o} selected={shown?.orderNumber === o.orderNumber} onSelect={() => onRow(o.orderNumber)} />
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <div className="or-list-foot">
          <Pager page={current} pages={pages} onPage={setPage} labels={{ page: pageSize === PAGE_SIZE_PHONE ? c.page : fmt(t.list.page, { p: "{p}", n: "{n}", total: filtered.length }), previous: c.previous, next: c.next }} />
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHead
        id="orders"
        title={title}
        actions={
          openReturns > 0 ? (
            <Link href="/desk/orders/returns/" className="ui-btn ui-btn-ghost or-returns-link">
              <span className="ui-btn-label">
                <Undo2 size={16} aria-hidden="true" />
                {fmt(t.ret.linkOpen, { n: openReturns })}
              </span>
            </Link>
          ) : undefined
        }
      />
      <Stops className="or-stops" active={active} counts={counts} onChange={onStop} />
      <div className="or-card or-tools">
      <ScanBar label={t.scan.label} placeholder={t.scan.placeholder} onScan={onScan} message={scanMessage} nextLabel={t.scan.next} nextTitle={t.scan.nextTitle} nextCode={nextToScan} />
      <form className="or-filters" aria-label={t.list.filters} data-dates={datesOpen || from || to ? "open" : "closed"} onSubmit={(e) => e.preventDefault()}>
        <Input label={t.list.search} placeholder={t.list.searchPlaceholder} maxLength={60} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Button variant="outline" className="or-dates-toggle" aria-expanded={datesOpen || Boolean(from || to)} onClick={() => setDatesOpen((v) => !v)}>
          <CalendarDays size={16} aria-hidden="true" />
          {t.list.dates}
        </Button>
        <DateInput label={t.list.from} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <DateInput label={t.list.to} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        {q || from || to ? (
          <Button variant="ghost" onClick={() => { setQ(""); setFrom(""); setTo(""); setPage(1); }}>
            {t.list.clear}
          </Button>
        ) : null}
      </form>
      </div>

      <div className="or-panes">
        {list}
        <section ref={pane} className="or-pane" aria-label={shown?.orderNumber ?? t.list.order}>
          {wide && shown ? <OrderDetail key={shown.orderNumber} order={shown} /> : wide ? <div className="or-pane-empty"><Empty icon={ReceiptText}>{t.list.pick}</Empty></div> : null}
        </section>
      </div>

      {!wide ? (
        <Sheet open={Boolean(explicit)} onClose={() => select(null)} title={explicit?.orderNumber ?? t.list.order} wide className="or-sheet">
          {explicit ? <OrderDetail key={explicit.orderNumber} order={explicit} inSheet /> : null}
        </Sheet>
      ) : null}
    </>
  );
}

function OrderRow({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect: () => void }) {
  const t = useT(ordersDict);
  const attention = isAttentionOrder(order);
  const pieces = order.items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <li className="or-row-item">
      <button type="button" className="or-row" data-order={order.orderNumber} aria-current={selected ? "true" : undefined} onClick={onSelect}>
        <span className="or-row-id">
          <span className="type-mono or-row-number">
            {order.orderNumber}
            {attention ? <TriangleAlert size={14} aria-hidden="true" /> : null}
          </span>
          <span className="type-small or-muted">{formatDateTime(order.placedAt)}</span>
        </span>
        <span className="or-row-who">
          <span className="or-row-name">{shownName(order.customerName, t.erasedName)}</span>
          <Track status={order.status} attention={attention} attentionLabel={t.list.needsAttention} />
        </span>
        <GlyphCluster items={order.items.map((i) => ({ type: i.art, tone: i.tone }))} label={fmt(pieces === 1 ? t.list.itemsOne : t.list.itemsOther, { count: pieces })} className="or-row-glyphs" />
        <span className="or-row-total">
          <Money value={order.totalRappen} />
        </span>
      </button>
    </li>
  );
}

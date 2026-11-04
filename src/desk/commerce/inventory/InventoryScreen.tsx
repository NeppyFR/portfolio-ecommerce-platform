"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Boxes, History, Minus, PackageOpen, Plus, Printer, Trash2 } from "lucide-react";
import { ScanBar, type ScanMessage } from "@/desk/commerce/orders/ScanBar";
import { colourLabel, pageOf } from "@/desk/commerce/orders/rules/order-rules";
import { classifyScan } from "@/desk/commerce/orders/rules/scan";
import { MAX_LINES, MAX_PER_LINE, receiveTotal } from "@/desk/commerce/orders/rules/receive";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { inventory as dict } from "@/i18n/dict/inventory";
import { formatDateTime } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { orderHref, setParams } from "@/lib/routes";
import { bookDelivery, discardDelivery, removeFromDelivery, scanDelivery, stepDelivery, undoLastScan, usePendingDelivery, findBySku } from "@/store/actions/inventory";
import { getState, useStore } from "@/store/core";
import { stockAlerts } from "@/store/selectors";
import type { StockMove, Tone } from "@/store/types";
import { Button, Dialog, Empty, Garment, IconButton, Input, Pager, RuleLine, Segmented, Status, Table, Tabs, toast, usePageSize, type Column } from "@/ui";
import { labelsHref } from "@/print/label-rules";
import { AdjustDialog } from "./AdjustDialog";
import { filterCounts, filterRows, inventoryRows, tileFor, type InventoryRow, type StockFilter } from "./rules";
import "@/desk/commerce/orders/orders.css";
import "./inventory.css";

const FILTERS: StockFilter[] = ["all", "low", "out"];
const HISTORY_ROWS = 150;
const FLASH_MS = 2500;
const isFilter = (v: string | null): v is StockFilter => FILTERS.includes(v as StockFilter);
type ScanMode = "find" | "receive";

export function InventoryScreen() {
  const t = useT(dict);
  const lang = useLang();
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const purchaseOrders = useStore((s) => s.purchaseOrders);
  const settings = useStore((s) => s.settings);
  const alerts = useStore(stockAlerts);
  const pending = usePendingDelivery();
  const pageSize = usePageSize();
  const [page, setPage] = useState(1);

  const tab = params.get("tab") === "history" ? "history" : "stock";
  const filterParam = params.get("filter");
  const filter: StockFilter = isFilter(filterParam) ? filterParam : "all";

  const [q, setQ] = useState(params.get("q") ?? "");
  const [mode, setMode] = useState<ScanMode>("find");
  const [message, setMessage] = useState<ScanMessage | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const feed = useRef(0);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
  }, []);

  const allRows = useMemo(() => inventoryRows({ products, orders, purchaseOrders, settings }), [products, orders, purchaseOrders, settings]);
  const counts = useMemo(() => filterCounts(allRows), [allRows]);
  const rows = useMemo(() => filterRows(allRows, filter, q), [allRows, filter, q]);
  const adjustRow = allRows.find((r) => r.variantId === adjusting) ?? null;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shownRows = rows.slice((current - 1) * pageSize, current * pageSize);
  useEffect(() => setPage(1), [filter, q]);

  const low = alerts.low.length;
  const title = fmt(low === 1 ? t.sentenceOne : t.sentence, { l: low, o: alerts.out.length });

  const openAdjust = (variantId: string) => {
    setAdjusting(variantId);
    setFlash(variantId);
    const at = rows.findIndex((r) => r.variantId === variantId);
    if (at >= 0) setPage(pageOf(at, pageSize));
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  };

  const refuse = (raw: string): ScanMessage | null => {
    const scan = classifyScan(raw);
    const code = raw.trim().toUpperCase();
    if (scan.kind === "tracking") return { tone: "warn", text: fmt(t.scan.tracking, { code }) };
    if (scan.kind === "gtin") return { tone: "warn", text: fmt(t.scan.gtin, { code }) };
    if (scan.kind === "unknown") return { tone: "bad", text: fmt(t.scan.unknownCode, { code }) };
    return null;
  };

  const onFind = (raw: string) => {
    const scan = classifyScan(raw);
    const refused = refuse(raw);
    if (refused) return setMessage(refused);
    if (scan.kind === "order") {
      const exists = getState().orders.some((o) => o.orderNumber === scan.number);
      setMessage(
        exists
          ? { tone: "ok", text: fmt(t.scan.order, { number: scan.number }), action: <Link className="or-link" href={orderHref(scan.number)}>{fmt(t.scan.openOrder, { number: scan.number })}</Link> }
          : { tone: "bad", text: fmt(t.scan.orderMissing, { number: scan.number }) },
      );
      return;
    }
    if (scan.kind !== "sku") return;
    const found = findBySku(getState(), scan.sku);
    if (!found) return setMessage({ tone: "bad", text: fmt(t.scan.unknownSku, { code: scan.sku }) });
    setMessage({ tone: "ok", text: fmt(t.scan.opened, { sku: scan.sku, label: lang === "de" ? found.product.nameDe : found.product.nameEn }) });
    openAdjust(found.variant.id);
  };

  const onReceive = (raw: string) => {
    const scan = classifyScan(raw);
    const refused = refuse(raw);
    if (refused) return setMessage(refused);
    if (scan.kind === "order") return setMessage({ tone: "warn", text: fmt(t.scan.receiveOrder, { number: scan.number }) });
    if (scan.kind !== "sku") return;
    const added = scanDelivery(scan.sku);
    if (!added) return setMessage({ tone: "bad", text: fmt(t.scan.unknownSku, { code: scan.sku }) });
    if (added.result === "line_full") return setMessage({ tone: "bad", text: fmt(t.scan.lineFull, { sku: scan.sku, max: MAX_PER_LINE }) });
    if (added.result === "too_many_lines") return setMessage({ tone: "bad", text: fmt(t.scan.tooManyLines, { max: MAX_LINES }) });
    setMessage({ tone: "ok", text: fmt(t.scan.added, { sku: scan.sku, quantity: added.quantity, total: added.total }) });
  };

  /** Demo: walks the sizes that run low first, so each press shows something worth doing. */
  const nextCode = (): string | null => {
    const pool = [...allRows.filter((r) => r.onSale && r.state !== "ok"), ...allRows.filter((r) => r.onSale && r.state === "ok")];
    if (pool.length === 0) return null;
    const code = pool[feed.current % pool.length].sku;
    feed.current += 1;
    return code;
  };

  return (
    <>
      <PageHead id="inventory" title={title} rule={<RuleLine>{t.rule}</RuleLine>} />
      <section className="or-card in-scan" aria-label={t.scan.mode}>
        <Segmented<ScanMode>
          aria-label={t.scan.mode}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMessage(null);
          }}
          options={[{ value: "find", label: t.scan.find }, { value: "receive", label: t.scan.receive }]}
        />
        <ScanBar
          label={t.scan.label}
          placeholder={mode === "find" ? t.scan.findPlaceholder : t.scan.receivePlaceholder}
          onScan={mode === "find" ? onFind : onReceive}
          message={message}
          nextLabel={t.scan.next}
          nextTitle={t.scan.nextTitle}
          nextCode={nextCode}
          className="in-scan-bar"
        />
      </section>

      {mode === "receive" || pending.lines.length > 0 ? <PendingDelivery /> : null}

      <div className="or-card in-body">
      <Tabs
        aria-label={t.tabsLabel}
        active={tab}
        className="in-tabs"
        items={[{ id: "stock", label: t.tabStock, icon: Boxes }, { id: "history", label: t.tabHistory, icon: History }]}
        onChange={(id) => setParams({ tab: id === "history" ? "history" : null })}
      />

      {tab === "stock" ? (
        <>
          <div className="in-tools">
            <div className="in-pills" role="group" aria-label={t.filterLabel}>
              {FILTERS.map((f) => (
                <button key={f} type="button" className="in-pill" aria-pressed={f === filter} onClick={() => setParams({ filter: f === "all" ? null : f })}>
                  <span>{t.filter[f]}</span>
                  <span className="type-mono-s">{counts[f]}</span>
                </button>
              ))}
            </div>
            <Input label={t.search} placeholder={t.searchPlaceholder} value={q} maxLength={60} className="in-search" onChange={(e) => { setQ(e.target.value); setParams({ q: e.target.value }); }} />
            {rows.length > 0 ? (
              <Link href={labelsHref(rows.slice(0, 200).map((r) => r.variantId))} className="ui-btn ui-btn-outline in-labels" title={fmt(t.labelsTitle, { count: Math.min(rows.length, 200) })}>
                <span className="ui-btn-label">
                  <Printer size={16} aria-hidden="true" />
                  {fmt(t.labelsPrint, { count: Math.min(rows.length, 200) })}
                </span>
              </Link>
            ) : null}
          </div>
          <StockTable rows={shownRows} flash={flash} onAdjust={openAdjust} emptyText={allRows.length === 0 ? t.empty : t.noMatch} />
          {pages > 1 ? <Pager className="or-pager" page={current} pages={pages} onPage={setPage} /> : null}
          <p className="type-small or-muted in-foot">{fmt(t.shopDefaultNote, { n: settings.lowStockDefault })}</p>
        </>
      ) : (
        <HistoryList />
      )}
      </div>

      <AdjustDialog row={adjustRow} lowStockDefault={settings.lowStockDefault} onClose={() => setAdjusting(null)} />
    </>
  );
}

function stateOf(row: InventoryRow, t: typeof dict.en): { tone: Tone; text: string } {
  if (row.productStatus !== "active") return { tone: "off", text: t.productStatus[row.productStatus] };
  if (!row.isActive) return { tone: "off", text: t.sizeOff };
  if (row.state === "out") return { tone: "bad", text: t.state.out };
  if (row.state === "low") return { tone: "warn", text: t.state.low };
  return { tone: "ok", text: t.state.ok };
}

function StockTable({ rows, flash, onAdjust, emptyText }: { rows: InventoryRow[]; flash: string | null; onAdjust: (variantId: string) => void; emptyText: string }) {
  const t = useT(dict);
  const lang = useLang();
  const name = (r: InventoryRow) => (lang === "de" ? r.productNameDe : r.productName);
  const sub = (r: InventoryRow) => [colourLabel(r.color, lang), sizeLabel(r.size, lang)].filter(Boolean).join(" · ");
  const threshold = (r: InventoryRow) => (r.threshold === null ? `${r.effectiveThreshold}*` : String(r.threshold));
  const columns: Column<InventoryRow>[] = [
    {
      key: "product",
      header: t.col.product,
      cell: (r) => (
        <span className="in-product" data-off={!r.onSale || undefined}>
          <span className={`in-thumb ${tileFor(r.tone)}`}>
            <Garment type={r.garment} tone={r.tone} view="mini" />
          </span>
          <span className="in-product-text">
            <Link className="in-product-link" href={`/desk/products/?open=${encodeURIComponent(r.productId)}`}>{name(r)}</Link>
            <span className="type-small or-muted">{sub(r)}</span>
          </span>
        </span>
      ),
    },
    { key: "sku", header: t.col.sku, cell: (r) => <span className="type-mono-s">{r.sku}</span> },
    { key: "onHand", header: t.col.onHand, align: "right", cell: (r) => <span className="type-mono">{r.onHand}</span> },
    { key: "reserved", header: t.col.reserved, align: "right", cell: (r) => <span className="type-mono">{r.reserved}</span> },
    {
      key: "available",
      header: t.col.available,
      align: "right",
      cell: (r) => (
        <span className="in-available">
          <span className="type-mono">{r.available}</span>
          {r.incoming > 0 ? <span className="type-mono-s or-muted">{fmt(t.incoming, { n: r.incoming })}</span> : null}
        </span>
      ),
    },
    { key: "toShip", header: t.col.toShip, align: "right", cell: (r) => <span className="type-mono">{r.toShip}</span> },
    { key: "threshold", header: t.col.threshold, align: "right", cell: (r) => <span className="type-mono">{threshold(r)}</span> },
    { key: "state", header: t.col.state, cell: (r) => {
      const state = stateOf(r, t);
      return <Status tone={state.tone}>{state.text}</Status>;
    } },
    { key: "action", header: <span className="sr-only">{t.adjust.open}</span>, align: "right", cell: (r) => <Button variant="ghost" onClick={() => onAdjust(r.variantId)}>{t.adjust.open}</Button> },
  ];
  return (
    <Table
      className="in-table"
      caption={t.tabStock}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.variantId}
      selectedKey={flash}
      empty={<Empty icon={Boxes}>{emptyText}</Empty>}
      phoneRow={(r) => {
        const state = stateOf(r, t);
        return (
          <div className="in-card">
            <div className="in-card-top">
              <span className={`in-thumb ${tileFor(r.tone)}`}>
                <Garment type={r.garment} tone={r.tone} view="mini" />
              </span>
              <span className="in-product-text">
                <span className="in-product-link">{name(r)}</span>
                <span className="type-small or-muted or-anywhere">{sub(r)} · {r.sku}</span>
              </span>
            </div>
            <div className="in-card-line">
              <Status tone={state.tone}>{state.text}</Status>
              <span className="type-mono">
                {fmt(t.cardAvailable, { n: r.available })}
                {r.incoming > 0 ? ` ${fmt(t.incoming, { n: r.incoming })}` : ""}
              </span>
            </div>
            <div className="in-card-line">
              <span className="type-mono-s or-muted">{fmt(t.cardRest, { onHand: r.onHand, reserved: r.reserved, toShip: r.toShip })}</span>
              <Button variant="outline" onClick={() => onAdjust(r.variantId)}>{t.adjust.open}</Button>
            </div>
          </div>
        );
      }}
    />
  );
}

function PendingDelivery() {
  const t = useT(dict);
  const pending = usePendingDelivery();
  const [dialog, setDialog] = useState<"book" | "discard" | null>(null);
  const count = receiveTotal(pending);
  const lines = pending.lines.length;
  const book = () => {
    const result = bookDelivery();
    setDialog(null);
    if (!result.ok) return;
    if (result.data.failed > 0) toast(fmt(t.scan.partial, { failed: result.data.failed }));
    else toast(fmt(t.scan.booked, { count: result.data.booked }));
  };
  return (
    <section className="or-card in-pending" aria-label={t.scan.pendingTitle}>
      <header className="in-pending-head">
        <h2 className="type-h4">{t.scan.pendingTitle}</h2>
        <span className="in-tag type-mono-s">{t.scan.unsaved}</span>
        <span className="type-mono-s or-muted">{fmt(t.scan.summary, { count, lines })}</span>
      </header>
      {lines === 0 ? (
        <p className="type-small or-muted">{t.scan.empty}</p>
      ) : (
        <ul className="in-pending-rows">
          {pending.lines.map((line) => (
            <li key={line.sku}>
              <span className="type-mono-s or-anywhere">{line.sku}</span>
              <span className="in-pending-qty">
                <IconButton aria-label={fmt(t.scan.minus, { sku: line.sku })} onClick={() => stepDelivery(line.sku, -1)}>
                  <Minus size={16} aria-hidden="true" />
                </IconButton>
                <span className="type-mono">{line.quantity}</span>
                <IconButton aria-label={fmt(t.scan.plus, { sku: line.sku })} onClick={() => stepDelivery(line.sku, 1)}>
                  <Plus size={16} aria-hidden="true" />
                </IconButton>
                <IconButton aria-label={fmt(t.scan.remove, { sku: line.sku })} onClick={() => removeFromDelivery(line.sku)}>
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="in-pending-actions">
        <Button variant="ghost" disabled={count === 0} onClick={undoLastScan}>{t.scan.undo}</Button>
        <Button variant="ghost" disabled={count === 0} onClick={() => setDialog("discard")}>{t.scan.clear}</Button>
        <Button disabled={count === 0} onClick={() => setDialog("book")}>
          <PackageOpen size={16} aria-hidden="true" />
          {count === 1 ? t.scan.bookOne : fmt(t.scan.bookMany, { count })}
        </Button>
      </div>
      <Dialog open={dialog === "book"} onClose={() => setDialog(null)} title={t.scan.confirmTitle} confirmLabel={t.scan.confirm} cancelLabel={t.scan.cancel} onConfirm={book}>
        <p className="type-body">{fmt(t.scan.confirmBody, { count, lines })}</p>
      </Dialog>
      <Dialog
        open={dialog === "discard"}
        onClose={() => setDialog(null)}
        danger
        title={t.scan.clear}
        confirmLabel={t.scan.clear}
        cancelLabel={t.scan.keep}
        onConfirm={() => {
          discardDelivery();
          setDialog(null);
          toast(t.scan.discarded);
        }}
      >
        <p className="type-body">{fmt(t.scan.clearConfirm, { count })}</p>
      </Dialog>
    </section>
  );
}

function HistoryList() {
  const t = useT(dict);
  const lang = useLang();
  const movements = useStore((s) => s.movements);
  const products = useStore((s) => s.products);
  const nameByVariant = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of products) for (const v of p.variants) out.set(v.id, lang === "de" ? p.nameDe : p.nameEn);
    return out;
  }, [products, lang]);
  const rows = useMemo(() => [...movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, HISTORY_ROWS), [movements]);
  const pageSize = usePageSize();
  const [page, setPage] = useState(1);
  if (rows.length === 0) return <Empty icon={History}>{t.historyEmpty}</Empty>;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const meta = (m: StockMove) => [t.reason[m.reason], m.note].filter(Boolean).join(" · ");
  return (
    <>
      <p className="type-small or-muted in-history-note">{fmt(t.historyNote, { n: rows.length })}</p>
      <ul className="in-history">
        {rows.slice((current - 1) * pageSize, current * pageSize).map((m) => (
          <li key={m.id} className="in-move">
            <span className="in-move-delta type-mono" data-sign={m.delta > 0 ? "up" : "down"}>
              {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
            </span>
            <div className="in-move-text">
              <span className="type-label">
                {nameByVariant.get(m.variantId) ?? m.productName} · {sizeLabel(m.size, lang)}
              </span>
              <span className="type-small or-muted">
                {meta(m)}
                {m.orderNumber ? (
                  <>
                    {" · "}
                    <Link className="or-link" href={orderHref(m.orderNumber)}>{fmt(t.historyOrder, { number: m.orderNumber })}</Link>
                  </>
                ) : null}
              </span>
            </div>
            <span className="type-mono-s in-move-count">{m.before} → {m.after}</span>
            <span className="type-small or-muted in-move-who">{m.actor === "system" ? t.actorSystem : m.actor} · {formatDateTime(m.createdAt)}</span>
          </li>
        ))}
      </ul>
      {pages > 1 ? <Pager className="or-pager" page={current} pages={pages} onPage={setPage} /> : null}
    </>
  );
}

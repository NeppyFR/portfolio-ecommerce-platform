"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUp, Layers, Minus, Package, Plus, ShoppingBag, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { dashboard } from "@/i18n/dict/dashboard";
import { seedText } from "@/i18n/dict/seed-text";
import { canAccess } from "@/lib/features";
import { formatChf, formatMonth } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { orderHref } from "@/lib/routes";
import { addTask, tickTask } from "@/store/actions/tasks";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { registerReset, useStore } from "@/store/core";
import { simulateIncomingOrder } from "@/store/flows";
import { isAttentionOrder, stockAlerts } from "@/store/selectors";
import type { FeatureKey, Order, OrderStatus, Profile } from "@/store/types";
import { Checkbox, Empty, Garment, toast } from "@/ui";
import { useReducedMotion } from "@/ui/useReducedMotion";
import { CollectionDonut } from "./CollectionDonut";
import { RevenueChart, type ChartPoint } from "./RevenueChart";
import {
  NO_COLLECTION,
  OTHER_COLLECTIONS,
  RANGE_IDS,
  axisWord,
  dashboardKpis,
  dashboardTaskIds,
  newestOrders,
  plainName,
  pointWord,
  rangeFor,
  revenueSeries,
  roundToFranc,
  salesByCollection,
  shortName,
  stockRows,
  type Delta,
  type RangeId,
} from "./dashboard-rules";
import "./dashboard.css";

const RECENT_ROWS = 5;
const STOCK_ROWS = 3;
const TASK_ROWS = 5;
const THUMBS = 2;
const INSERT_DELAY_MS = 1200;
const EASE = [0.2, 0.7, 0.2, 1] as const;

let insertPlayed = false;
registerReset(() => {
  insertPlayed = false;
});

const francs = (rappen: number): string => formatChf(roundToFranc(rappen)).replace(/\.00$/, "");

export function DashboardScreen() {
  const t = useT(dashboard);
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const [rangeId, setRangeId] = useState<RangeId>("7d");
  const has = (feature: FeatureKey) => canAccess(profile, feature, switches);
  const seesOrders = has("orders");
  const seesRevenue = has("analytics") || has("finances");
  const seesStock = has("inventory");
  const seesTasks = has("tasks");
  const seesAnyNumber = seesOrders || seesRevenue;
  const lowCount = [seesOrders, seesStock, seesTasks].filter(Boolean).length;

  useEffect(() => {
    if (insertPlayed || !seesOrders) return;
    const timer = window.setTimeout(() => {
      insertPlayed = true;
      const result = simulateIncomingOrder();
      if (result.ok && result.data.orderNumber && !document.querySelector("dialog[open]")) toast(fmt(t.newOrder, { number: result.data.orderNumber }));
    }, INSERT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [seesOrders, t.newOrder]);

  return (
    <>
      <PageHead id="dashboard" title={t.subtitle} />
      <div className="db">
        {seesAnyNumber ? null : <p className="type-body db-muted">{t.noNumbers}</p>}
        {seesAnyNumber ? <KpiRow rangeId={rangeId} revenue={seesRevenue} orders={seesOrders} /> : null}
        {seesRevenue ? (
          <div className="db-mid">
            <RevenueCard rangeId={rangeId} onRange={setRangeId} />
            <CollectionCard rangeId={rangeId} />
          </div>
        ) : null}
        {lowCount > 0 ? (
          <div className="db-low" data-cols={lowCount} data-orders={seesOrders ? "" : undefined}>
            {seesOrders ? <RecentOrders /> : null}
            {seesStock ? <StockAlerts /> : null}
            {seesTasks ? <TasksCard /> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function CardHead({ title, href, more, action }: { title: string; href?: string; more?: string; action?: ReactNode }) {
  return (
    <header className="db-head">
      <h2 className="db-title">{title}</h2>
      {href && more ? (
        <Link href={href} className="db-more">
          <span>{more}</span>
          <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : null}
      {action}
    </header>
  );
}

function DeltaBadge({ value }: { value: Delta }) {
  const t = useT(dashboard);
  if (value === null) return <span className="db-delta" data-tone="flat">{t.noBase}</span>;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUp : ArrowDown;
  const tone = value === 0 ? "flat" : value > 0 ? "up" : "down";
  const text = `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
  return (
    <span className="db-delta" data-tone={tone}>
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

function Kpi({ icon: Icon, label, value, exact, delta, versus, accent }: { icon: LucideIcon; label: string; value: string; exact?: string; delta: Delta; versus: string; accent?: boolean }) {
  return (
    <section className="db-card db-kpi" data-accent={accent ? "" : undefined}>
      <Icon size={28} strokeWidth={1.5} aria-hidden="true" className="db-kpi-icon" />
      <div className="db-kpi-body">
        <h2 className="db-kpi-label">{label}</h2>
        <p className="db-kpi-value" title={exact}>
          {value}
        </p>
        <p className="db-kpi-foot">
          <DeltaBadge value={delta} />
          <span className="db-kpi-versus">{versus}</span>
        </p>
      </div>
    </section>
  );
}

function KpiRow({ rangeId, revenue, orders: seesOrders }: { rangeId: RangeId; revenue: boolean; orders: boolean }) {
  const t = useT(dashboard);
  const orders = useStore((s) => s.orders);
  const k = useMemo(() => dashboardKpis(orders, rangeFor(rangeId, DEMO_TODAY)), [orders, rangeId]);
  const versus = t.versus[rangeId];
  const count = (revenue ? 2 : 0) + (seesOrders ? 2 : 0);
  return (
    <div className="db-kpis" data-count={count}>
      {revenue ? <Kpi icon={ShoppingBag} label={t.kpiRevenue} value={francs(k.revenue.value)} exact={formatChf(k.revenue.value)} delta={k.revenue.delta} versus={versus} accent /> : null}
      {seesOrders ? <Kpi icon={Layers} label={t.kpiOrders} value={String(k.orders.value)} delta={k.orders.delta} versus={versus} /> : null}
      {seesOrders ? <Kpi icon={Users} label={t.kpiCustomers} value={String(k.customers.value)} delta={k.customers.delta} versus={versus} /> : null}
      {revenue ? <Kpi icon={Package} label={t.kpiAov} value={k.aov.value === null ? t.noBase : formatChf(k.aov.value)} delta={k.aov.delta} versus={versus} /> : null}
    </div>
  );
}

function RevenueCard({ rangeId, onRange }: { rangeId: RangeId; onRange: (id: RangeId) => void }) {
  const t = useT(dashboard);
  const lang = useLang();
  const orders = useStore((s) => s.orders);
  const k = useMemo(() => dashboardKpis(orders, rangeFor(rangeId, DEMO_TODAY)), [orders, rangeId]);
  const points = useMemo<ChartPoint[]>(() => {
    const words = { weekdays: t.weekdays, months: t.months, dayMonth: t.dayMonth, week: t.week };
    return revenueSeries(orders, rangeId, DEMO_TODAY).map((p) => ({
      key: p.key,
      axis: axisWord(p, rangeId, words),
      tip: pointWord(p, words, (month) => formatMonth(month, lang)),
      value: p.value,
      money: francs(p.value),
    }));
  }, [orders, rangeId, t, lang]);
  return (
    <section className="db-card db-revenue">
      <header className="db-revenue-head">
        <div className="db-revenue-top">
          <h2 className="db-title">{t.revenue}</h2>
          <div className="db-ranges" role="group" aria-label={t.rangesLabel}>
            {RANGE_IDS.map((id) => (
              <button key={id} type="button" className="db-range" aria-pressed={id === rangeId} aria-label={`${t.ranges[id].short}: ${t.ranges[id].long}`} title={t.ranges[id].long} onClick={() => onRange(id)}>
                {t.ranges[id].short}
              </button>
            ))}
          </div>
        </div>
        <p className="db-revenue-figure">
          <span className="db-revenue-value" title={formatChf(k.revenue.value)}>
            {francs(k.revenue.value)}
          </span>
          {k.revenue.delta === null ? null : <DeltaBadge value={k.revenue.delta} />}
        </p>
      </header>
      <RevenueChart points={points} series={rangeId} caption={fmt(t.chartCaption, { range: t.ranges[rangeId].long })} emptyText={t.chartEmpty} headLabel={t.chartPeriod} headValue={t.chartRevenue} />
    </section>
  );
}

function CollectionCard({ rangeId }: { rangeId: RangeId }) {
  const t = useT(dashboard);
  const lang = useLang();
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const collections = useStore((s) => s.collections);
  const { slices, totalRappen } = useMemo(() => salesByCollection(orders, products, rangeFor(rangeId, DEMO_TODAY)), [orders, products, rangeId]);
  const named = useMemo(
    () =>
      slices.map((slice) => {
        if (slice.key === NO_COLLECTION) return { ...slice, name: t.noCollection };
        if (slice.key === OTHER_COLLECTIONS) return { ...slice, name: t.otherCollections };
        const found = collections.find((c) => c.id === slice.key);
        return { ...slice, name: found ? (lang === "de" ? found.nameDe : found.nameEn) : t.noCollection };
      }),
    [slices, collections, lang, t],
  );
  return (
    <section className="db-card db-collections">
      <CardHead title={t.collections} />
      <CollectionDonut slices={named} totalRappen={totalRappen} caption={fmt(t.collectionCaption, { range: t.ranges[rangeId].long })} emptyText={t.collectionEmpty} note={t.collectionNote} headName={t.collectionName} headShare={t.collectionShare} headSales={t.collectionSales} />
    </section>
  );
}

function Thumb({ type, tone, printed, size }: { type: Order["items"][number]["garment"]; tone: Order["items"][number]["tone"]; printed?: boolean; size: "s" | "l" }) {
  return (
    <span className="db-thumb" data-size={size} data-tone={tone}>
      <Garment type={type} tone={tone} view="full" printed={printed} />
    </span>
  );
}

function StatusChip({ order }: { order: Order }) {
  const c = useT(common);
  const t = useT(dashboard);
  if (isAttentionOrder(order)) {
    return (
      <span className="db-chip" data-tone="attention" title={c.status.attention}>
        <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />
        <span>{t.needsYou}</span>
      </span>
    );
  }
  const status: OrderStatus = order.status;
  return (
    <span className="db-chip" data-tone={status}>
      <span className="db-chip-dot" aria-hidden="true" />
      <span>{c.status[status]}</span>
    </span>
  );
}

function RecentOrders() {
  const t = useT(dashboard);
  const orders = useStore((s) => s.orders);
  const reduced = useReducedMotion();
  const rows = useMemo(() => newestOrders(orders, RECENT_ROWS), [orders]);
  return (
    <section className="db-card db-orders">
      <CardHead title={t.recent} href="/desk/orders/" more={t.viewAll} />
      {rows.length === 0 ? (
        <Empty icon={Package}>{t.ordersEmpty}</Empty>
      ) : (
        <div className="db-table" role="table" aria-label={t.recent}>
          <div className="db-table-head" role="row">
            <span role="columnheader">{t.colOrder}</span>
            <span role="columnheader">{t.colCustomer}</span>
            <span role="columnheader">{t.colProducts}</span>
            <span role="columnheader">{t.colTotal}</span>
            <span role="columnheader">{t.colStatus}</span>
          </div>
          <div role="rowgroup" className="db-table-body">
            <AnimatePresence initial={false}>
              {rows.map((order) => (
                <motion.div key={order.id} role="row" className="db-row" layout={reduced ? false : "position"} initial={reduced ? false : { opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0 } }} transition={{ duration: 0.24, ease: EASE }}>
                  <OrderCells order={order} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
}

function OrderCells({ order }: { order: Order }) {
  const t = useT(dashboard);
  const pieces = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const shown = order.items.slice(0, THUMBS);
  const extra = order.items.length - shown.length;
  const label = fmt(pieces === 1 ? t.piecesOne : t.piecesOther, { count: pieces });
  return (
    <>
      <span role="cell" className="db-cell-number">
        <Link href={orderHref(order.orderNumber)} className="db-row-link">
          {order.orderNumber}
        </Link>
      </span>
      <span role="cell" className="db-cell-name">
        {shortName(order.customerName, order.customerErased)}
      </span>
      <span role="cell" className="db-cell-thumbs" aria-label={label}>
        {shown.map((item) => (
          <Thumb key={item.id} type={item.garment} tone={item.tone} size="s" />
        ))}
        {extra > 0 ? <span className="db-thumb-more">+{extra}</span> : null}
      </span>
      <span role="cell" className="db-cell-total">
        {formatChf(order.totalRappen)}
      </span>
      <span role="cell" className="db-cell-status">
        <StatusChip order={order} />
      </span>
    </>
  );
}

function StockAlerts() {
  const t = useT(dashboard);
  const lang = useLang();
  const alerts = useStore(stockAlerts);
  const rows = useMemo(() => stockRows(alerts).slice(0, STOCK_ROWS), [alerts]);
  return (
    <section className="db-card db-stock">
      <CardHead title={t.stock} href="/desk/inventory/?filter=low" more={t.viewInventory} />
      {rows.length === 0 ? (
        <Empty icon={Package}>{t.stockEmpty}</Empty>
      ) : (
        <ul className="db-stock-list">
          {rows.map(({ product, variant, left }) => (
            <li key={variant.id}>
              <Link href="/desk/inventory/?filter=low" className="db-stock-row">
                <Thumb type={product.garment} tone={product.tone} printed={product.printedName} size="l" />
                <span className="db-stock-text">
                  <span className="db-stock-name">{plainName(lang === "de" ? product.nameDe : product.nameEn)}</span>
                  <span className="db-stock-sub">{`${sizeLabel(variant.size, lang)} / ${t.colors[variant.color] ?? variant.color}`}</span>
                </span>
                <span className="db-left">
                  <TriangleAlert size={13} aria-hidden="true" />
                  {left <= 0 ? t.out : fmt(t.left, { n: left })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const personOf = (profile: Profile): string | null => (profile === "superUser" ? null : profile);

function TasksCard() {
  const t = useT(dashboard);
  const lang = useLang();
  const tasks = useStore((s) => s.tasks);
  const lists = useStore((s) => s.taskLists);
  const profile = useStore((s) => s.profile);
  const [view, setView] = useState(() => ({ profile, ids: dashboardTaskIds(tasks, personOf(profile), TASK_ROWS, DEMO_NOW_MS) }));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  // The rows hold their places while someone works through them, so a tick never moves the list under the pointer.
  if (view.profile !== profile) setView({ profile, ids: dashboardTaskIds(tasks, personOf(profile), TASK_ROWS, DEMO_NOW_MS) });
  const rows = view.ids.map((id) => tasks.find((task) => task.id === id)).filter((task) => task !== undefined).slice(0, adding ? TASK_ROWS - 1 : TASK_ROWS);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const close = () => {
    setAdding(false);
    setDraft("");
    plusRef.current?.focus();
  };

  const tick = (id: string, title: string, wasDone: boolean) => {
    const result = tickTask(id);
    toast(result.ok ? fmt(wasDone ? t.taskOpen : t.taskDone, { title }) : t.taskFailed);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const list = [...lists].sort((a, b) => a.position - b.position)[0];
    if (!draft.trim() || !list) {
      close();
      return;
    }
    const result = addTask(list.id, draft);
    if (!result.ok) {
      toast(t.taskFailed);
      return;
    }
    toast(fmt(t.taskAdded, { list: seedText(list.name, lang) }));
    setView((v) => ({ ...v, ids: [result.data.id, ...v.ids].slice(0, TASK_ROWS) }));
    setDraft("");
  };

  return (
    <section className="db-card db-tasks">
      <CardHead
        title={t.tasks}
        action={
          <button ref={plusRef} type="button" className="db-plus" aria-label={t.addTask} title={t.addTask} aria-expanded={adding} onClick={() => (adding ? close() : setAdding(true))}>
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        }
      />
      {adding ? (
        <form className="db-add" onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            className="db-add-input"
            value={draft}
            maxLength={200}
            aria-label={t.addTaskPlaceholder}
            placeholder={t.addTaskPlaceholder}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (!draft.trim()) {
                setAdding(false);
                setDraft("");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          />
        </form>
      ) : null}
      {rows.length === 0 ? (
        <Empty>{t.tasksEmpty}</Empty>
      ) : (
        <ul className="db-task-list">
          {rows.map((task) => {
            const done = task.doneAt !== null;
            const title = seedText(task.title, lang);
            return (
              <li key={task.id} className="db-task" data-done={done ? "" : undefined}>
                <Checkbox checked={done} onChange={() => tick(task.id, title, done)} label={<span title={title}>{title}</span>} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

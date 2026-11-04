"use client";

import { ChartColumn, Coins, Download, Package, ReceiptText, Wallet, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import "@/desk/commerce/products/catalogue.css";
import { fmt, plural, useLang, useT } from "@/i18n";
import { analytics as dict } from "@/i18n/dict/analytics";
import { downloadCsv } from "@/lib/download";
import { formatChf, formatDate } from "@/lib/format";
import { DEFAULT_RANGE_DAYS, deltaPercent, estimatedProfit, kpis, MAX_RANGE_DAYS, matchPreset, ordersByWeekday, paidOrdersIn, presetRange, previousRange, RANGE_PRESETS, rangeDays, rangeProblem, revenueByWeek, salesBy, type DayRange, type Kpis, type RangePreset } from "@/lib/metrics";
import { sizeLabel } from "@/lib/product-rules";
import { setParams } from "@/lib/routes";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Order, Product, SizeCode } from "@/store/types";
import { BarList, Button, DateInput, Delta, Empty, RuleLine, Select, toast, type BarListDatum } from "@/ui";
import { ColumnChart } from "./ColumnChart";
import { chfShort, dayMonth, inventoryCsv, marginPercent, orderItemsCsv, ordersCsv, profitSplit, rangeText, roundDelta, summaryCsv } from "./rules";

type T = (typeof dict)["en"];

const DEFAULT_RANGE: DayRange = presetRange(String(DEFAULT_RANGE_DAYS) as RangePreset, DEMO_TODAY);

type KpiRowSpec = { key: keyof Kpis; money: boolean; icon?: LucideIcon; neutral?: boolean; invert?: boolean };
const KPI_CARDS: KpiRowSpec[] = [
  { key: "grossRappen", money: true, icon: Wallet },
  { key: "orders", money: false, icon: ReceiptText },
  { key: "aovRappen", money: true, icon: Coins },
  { key: "unitsSold", money: false, icon: Package },
];
const KPI_STRIP: KpiRowSpec[] = [
  { key: "discountsRappen", money: true, neutral: true },
  { key: "refundsRappen", money: true, invert: true },
  { key: "netRappen", money: true },
];

function KpiRow({ current, previous, days, compare, t }: { current: Kpis; previous: Kpis; days: number; compare: boolean; t: T }) {
  const show = (value: number | null, money: boolean) => (value === null ? "–" : money ? formatChf(value) : String(value));
  const parts = ({ key, money, neutral, invert }: KpiRowSpec) => {
    const now = current[key];
    const before = previous[key];
    const prior = show(before, money);
    return {
      tip: compare ? fmt(plural(days, t.previousOne, t.previous), { count: days, value: prior }) : undefined,
      label: <span className="type-small cat-kpi-label">{t.kpi[key]}</span>,
      value: <span className="type-stat">{show(now, money)}</span>,
      foot: compare ? (
        <span className="cat-kpi-foot">
          <Delta percent={now === null || before === null ? null : roundDelta(deltaPercent(now, before))} neutral={neutral} invert={invert} />
          <span className="type-mono-s cat-kpi-vs">{fmt(t.vs, { value: prior })}</span>
        </span>
      ) : null,
    };
  };
  return (
    <section className="cat-stack" aria-label={t.rangeNav}>
      <div className="cat-kpi-cards">
        {KPI_CARDS.map((spec, i) => {
          const Icon = spec.icon as LucideIcon;
          const part = parts(spec);
          return (
            <article key={spec.key} className="cat-kpi-card" data-first={i === 0 || undefined} title={part.tip}>
              <span className="cat-kpi-icon">
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div className="cat-kpi-body">
                {part.label}
                {part.value}
                {part.foot}
              </div>
            </article>
          );
        })}
      </div>
      <div className="cat-kpi-strip">
        {KPI_STRIP.map((spec) => {
          const part = parts(spec);
          return (
            <div key={spec.key} className="cat-kpi" title={part.tip}>
              {part.label}
              {part.value}
              {part.foot}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Panel({ title, description, span, children }: { title: string; description: string; span: string; children: React.ReactNode }) {
  return (
    <section className={`cat-panel ${span}`}>
      <header className="cat-panel-head">
        <h2 className="type-h4">{title}</h2>
        <p className="type-small cat-sub">{description}</p>
      </header>
      {children}
    </section>
  );
}

function SalesBars({ rows, caption, t }: { rows: BarListDatum[]; caption: string; t: T }) {
  if (rows.length === 0) return <p className="type-small cat-sub">{t.barsEmpty}</p>;
  return <BarList data={rows} caption={caption} />;
}

function ProfitBlock({ orders, products, t }: { orders: Order[]; products: Product[]; t: T }) {
  const profit = useMemo(() => {
    const cost = new Map(products.map((p) => [p.id, p.costRappen]));
    return estimatedProfit(orders, (id) => cost.get(id) ?? null);
  }, [orders, products]);
  const margin = marginPercent(profit.profitRappen, profit.salesRappen);
  const missing = profit.itemsWithoutCost;
  const note =
    missing === 0
      ? fmt(t.profit.allCosted, { count: profit.itemsWithCost })
      : profit.itemsWithCost === 0
        ? fmt(plural(missing, t.profit.missingOne, t.profit.missing), { count: missing })
        : fmt(plural(missing, t.profit.missingCountedOne, t.profit.missingCounted), { count: missing, counted: profit.itemsWithCost });
  const split = profitSplit(profit.salesRappen, profit.costRappen);
  return (
    <div className="cat-profit">
      <span className="type-display-l cat-profit-value">{profit.itemsWithCost > 0 ? formatChf(profit.profitRappen) : "–"}</span>
      {profit.itemsWithCost > 0 ? (
        <>
          <p className="type-small cat-mono-line">
            {fmt(t.profit.breakdown, { sales: formatChf(profit.salesRappen), cost: formatChf(profit.costRappen) })}
            {margin !== null ? ` · ${fmt(t.profit.margin, { percent: margin })}` : ""}
          </p>
          <div className="cat-profit-split" aria-hidden="true">
            <span data-part="cost" style={{ width: `${split.cost}%` }} />
            <span data-part="profit" style={{ width: `${split.profit}%` }} />
          </div>
          <ul className="cat-legend type-small" aria-hidden="true">
            <li>
              <i data-part="cost" />
              {t.profit.costPart}
            </li>
            <li>
              <i data-part="profit" />
              {t.profit.profitPart}
            </li>
          </ul>
        </>
      ) : null}
      <p className="type-small cat-sub">{note}</p>
    </div>
  );
}

function Downloads({ orders, products, range, t }: { orders: Order[]; products: Product[]; range: DayRange; t: T }) {
  const items = [
    { id: "analytics", label: t.downloads.analytics, hint: t.downloads.analyticsHint, build: () => summaryCsv(orders, range, t.csv) },
    { id: "orders", label: t.downloads.orders, hint: t.downloads.ordersHint, build: () => ordersCsv(orders, range, t.csv) },
    { id: "order-items", label: t.downloads.orderItems, hint: t.downloads.orderItemsHint, build: () => orderItemsCsv(orders, products, range, t.csv, (c) => t.category[c]) },
    { id: "inventory", label: t.downloads.inventory, hint: t.downloads.inventoryHint, build: () => inventoryCsv(orders, products, range, t.csv) },
  ];
  return (
    <ul className="cat-downloads">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="cat-download"
            onClick={() => {
              downloadCsv(item.id, item.build());
              toast(fmt(t.downloads.done, { name: item.label }));
            }}
          >
            <Download size={16} aria-hidden="true" />
            <span className="cat-prod-text">
              <span className="cat-name">{item.label}</span>
              <span className="type-small cat-sub">{item.hint}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsScreen() {
  const t = useT(dict);
  const lang = useLang();
  const params = useSearchParams();
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const collections = useStore((s) => s.collections);

  const fromParam = params.get("from");
  const toParam = params.get("to");
  const compare = params.get("compare") !== "off";
  const asked = fromParam !== null || toParam !== null;
  const problem = asked ? rangeProblem(fromParam ?? "", toParam ?? "") : null;
  const range: DayRange = useMemo(() => (asked && !problem ? { from: fromParam as string, to: toParam as string } : DEFAULT_RANGE), [asked, problem, fromParam, toParam]);
  const days = rangeDays(range);
  const prior = previousRange(range);
  const preset = matchPreset(range, DEMO_TODAY);

  const [draftFrom, setDraftFrom] = useState(fromParam ?? range.from);
  const [draftTo, setDraftTo] = useState(toParam ?? range.to);
  const [draftCompare, setDraftCompare] = useState(compare ? "previous" : "off");
  useEffect(() => {
    setDraftFrom(fromParam ?? range.from);
    setDraftTo(toParam ?? range.to);
    setDraftCompare(compare ? "previous" : "off");
  }, [fromParam, toParam, range, compare]);

  const paid = useMemo(() => paidOrdersIn(orders, range), [orders, range]);
  const current = useMemo(() => kpis(paid), [paid]);
  const previous = useMemo(() => kpis(paidOrdersIn(orders, prior)), [orders, prior.from, prior.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => revenueByWeek(orders, range), [orders, range]);
  const weekdays = useMemo(() => ordersByWeekday(orders, range), [orders, range]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const unitsText = (n: number) => fmt(plural(n, t.unitsOne, t.units), { count: n });
  const categories = useMemo<BarListDatum[]>(
    () => salesBy(paid, (item) => [byId.get(item.productId)?.category ?? "other"]).map((r) => ({ key: r.key, label: t.category[r.key as Product["category"]], value: r.salesRappen, display: `${formatChf(r.salesRappen)} · ${fmt(plural(r.units, t.unitsOne, t.units), { count: r.units })}` })),
    [paid, byId, t],
  );
  const collectionRows = useMemo<BarListDatum[]>(() => {
    const none = "__none";
    const named = new Map(collections.map((c) => [c.id, lang === "de" ? c.nameDe : c.nameEn]));
    return salesBy(paid, (item) => {
      const ids = byId.get(item.productId)?.collectionIds ?? [];
      return ids.length ? ids : [none];
    }).map((r) => ({ key: r.key, label: r.key === none ? t.collections.none : (named.get(r.key) ?? r.key), value: r.salesRappen, display: `${formatChf(r.salesRappen)} · ${fmt(plural(r.units, t.unitsOne, t.units), { count: r.units })}` }));
  }, [paid, byId, collections, lang, t]);
  const sizes = useMemo<BarListDatum[]>(
    () =>
      salesBy(paid, (item) => [item.size])
        .sort((a, b) => b.units - a.units)
        .map((r) => ({ key: r.key, label: sizeLabel(r.key as SizeCode, lang), value: r.units, display: unitsText(r.units) })),
    [paid, lang, t], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const chf = formatChf(current.grossRappen);
  const title = range.to !== DEMO_TODAY ? fmt(t.titleCustom, { chf, from: formatDate(range.from), to: formatDate(range.to) }) : days === 1 ? fmt(t.titleOne, { chf }) : fmt(t.title, { chf, d: days });
  const problemText = problem ? (problem === "too_long" ? fmt(t.error.too_long, { max: MAX_RANGE_DAYS }) : t.error[problem]) : null;
  const last90 = presetRange("90", DEMO_TODAY);
  const onLast90 = preset === "90";

  const setPreset = (p: RangePreset) => {
    const next = presetRange(p, DEMO_TODAY);
    setParams({ from: p === "30" ? null : next.from, to: p === "30" ? null : next.to });
  };
  const apply = () => setParams({ from: draftFrom, to: draftTo, compare: draftCompare === "off" ? "off" : null });

  return (
    <div className="cat-stack">
      <PageHead id="analytics" title={title} rule={<RuleLine>{t.rule}</RuleLine>} />
      <div className="cat-rangebar">
        <nav className="cat-presets" aria-label={t.rangeNav}>
          {RANGE_PRESETS.map((p) => (
            <button key={p} type="button" className="cat-preset" aria-pressed={p === preset} onClick={() => setPreset(p)}>
              {t.range[p]}
            </button>
          ))}
        </nav>
        <form
          className="cat-tools"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <DateInput label={t.filter.from} value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
          <span className="cat-range-dash" aria-hidden="true">
            –
          </span>
          <DateInput label={t.filter.to} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
          <Select label={t.filter.comparison} className="cat-compare" value={draftCompare} onChange={(e) => setDraftCompare(e.target.value)}>
            <option value="previous">{t.filter.previousShort}</option>
            <option value="off">{t.filter.noneShort}</option>
          </Select>
          <Button type="submit" variant="outline">
            {t.filter.apply}
          </Button>
        </form>
      </div>
      <p className="type-small cat-sub">
        {rangeText(range)} · {fmt(plural(days, t.daysOne, t.days), { count: days })}
        {compare ? ` · ${fmt(t.comparedWith, { range: rangeText(prior) })}` : ""}
      </p>
      {problemText ? (
        <p className="type-small cat-note" data-tone="warn" role="alert">
          {problemText} {t.error.fallback}
        </p>
      ) : null}
      <KpiRow current={current} previous={previous} days={days} compare={compare} t={t} />
      {paid.length === 0 ? (
        <Empty
          icon={ChartColumn}
          action={
            onLast90 ? null : (
              <Button variant="outline" onClick={() => setParams({ from: last90.from, to: last90.to })}>
                {t.emptyLast90}
              </Button>
            )
          }
        >
          {fmt(t.empty, { from: formatDate(range.from), to: formatDate(range.to) })}
        </Empty>
      ) : (
        <div className="cat-grid">
          <Panel title={t.weeks.title} description={t.weeks.description} span="cat-span-8">
            <ColumnChart
              height={240}
              caption={t.weeks.caption}
              columns={[t.weeks.colWeek, t.weeks.colDays, t.weeks.colRevenue, t.weeks.colOrders]}
              formatValue={chfShort}
              data={weeks.map((w) => {
                const count = fmt(plural(w.orders, t.orderCountOne, t.orderCount), { count: w.orders });
                return {
                  key: w.start,
                  label: fmt(t.weeks.label, { week: w.week }),
                  value: w.grossRappen,
                  tipTitle: fmt(t.weeks.tip, { week: w.week, year: w.year, from: dayMonth(w.from), to: dayMonth(w.to) }),
                  tipValue: formatChf(w.grossRappen),
                  tipNote: count,
                  cells: [fmt(t.weeks.label, { week: w.week }), `${dayMonth(w.from)}–${dayMonth(w.to)}`, formatChf(w.grossRappen), String(w.orders)],
                };
              })}
            />
          </Panel>
          <Panel title={t.weekdays.title} description={t.weekdays.description} span="cat-span-4">
            <ColumnChart
              height={240}
              caption={t.weekdays.caption}
              columns={[t.weekdays.colWeekday, t.weeks.colOrders, t.weeks.colRevenue]}
              data={weekdays.map((d) => ({
                key: String(d.index),
                label: t.weekdays.names[d.index],
                value: d.orders,
                tipTitle: t.weekdays.names[d.index],
                tipValue: fmt(plural(d.orders, t.orderCountOne, t.orderCount), { count: d.orders }),
                tipNote: formatChf(d.grossRappen),
                cells: [t.weekdays.names[d.index], String(d.orders), formatChf(d.grossRappen)],
              }))}
            />
          </Panel>
          <Panel title={t.categories.title} description={t.categories.description} span="cat-span-7">
            <SalesBars rows={categories} caption={t.categories.title} t={t} />
          </Panel>
          <Panel title={t.collections.title} description={t.collections.description} span="cat-span-5">
            <SalesBars rows={collectionRows} caption={t.collections.title} t={t} />
          </Panel>
          <Panel title={t.sizes.title} description={t.sizes.description} span="cat-span-5">
            <SalesBars rows={sizes} caption={t.sizes.title} t={t} />
          </Panel>
          <Panel title={t.profit.title} description={t.profit.description} span="cat-span-7">
            <ProfitBlock orders={paid} products={products} t={t} />
          </Panel>
          <Panel title={t.downloads.title} description={t.downloads.description} span="cat-span-12">
            <Downloads orders={orders} products={products} range={range} t={t} />
          </Panel>
        </div>
      )}
    </div>
  );
}

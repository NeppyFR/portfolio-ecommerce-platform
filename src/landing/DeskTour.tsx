"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { ArrowRight, Boxes, Inbox, MonitorCog, Rocket, Truck, Undo2, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { plainName, stockRows } from "@/desk/dashboard/dashboard-rules";
import { StepInChips } from "@/desk/enter/StepInChips";
import { bookOrder } from "@/desk/finance/rules/ledger";
import { screenById, type ScreenId } from "@/desk/registry";
import { screenName } from "@/desk/shell/sidebar-nav";
import { fmt, useLang, useT } from "@/i18n";
import { dashboard } from "@/i18n/dict/dashboard";
import { landing } from "@/i18n/dict/landing";
import { seedText } from "@/i18n/dict/seed-text";
import { STORY_ORDER } from "@/lib/brand";
import { formatChf, formatDate } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { orderHref, slipHref } from "@/lib/routes";
import { setProfile } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import {
  attentionCount,
  dueThisWeekCount,
  healthSummary,
  inboundPurchaseCount,
  isAttentionOrder,
  latestFullRun,
  moneyOutByMonth,
  monthlyRunningCost,
  nextDrop,
  onSaleCounts,
  openReturnCount,
  priorityMailCount,
  stockAlerts,
  systemAreas,
  systemAttentionCount,
  teamLoad,
  toPackCount,
} from "@/store/selectors";
import type { OrderStop } from "@/store/types";
import { Bars, GlyphCluster, ProductArt, Status, Stops, Track } from "@/ui";

const TILES = ["t-mist", "t-deep", "t-ice", "t-vio", "t-lil", "t-cob", "t-sky", "t-pale"];
const SHELF = 8;

const one = (n: number, words: string[]): string => fmt(words[n === 1 ? 0 : 1], { n });

/** A sentence whose numbers carry the gradient. */
function Big({ text, vars }: { text: string; vars: Record<string, string | number> }) {
  return (
    <p className="lt-big">
      {text.split(/(\{\w+\})/).map((part, i) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return key ? <b key={i}>{vars[key]}</b> : part;
      })}
    </p>
  );
}

type ScreenLink = { id: ScreenId; href?: string; label?: string; onClick?: () => void };

function Screens({ links }: { links: ScreenLink[] }) {
  const lang = useLang();
  return (
    <ul className="lt-links">
      {links.map(({ id, href, label, onClick }) => {
        const screen = screenById(id);
        return (
          <li key={id}>
            <Link href={href ?? screen.route} className="lt-link" onClick={onClick}>
              <screen.icon size={14} strokeWidth={1.75} aria-hidden="true" />
              {label ?? screenName(screen, lang)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Panel({ id, icon: Icon, name, children }: { id: string; icon: LucideIcon; name: string; children: ReactNode }) {
  return (
    <section className={`lt-panel lt-${id}`} aria-labelledby={`lt-${id}-name`}>
      <h3 id={`lt-${id}-name`} className="lt-name">
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
        {name}
      </h3>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="lt-fact">
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      {children}
    </p>
  );
}

function OrdersPanel() {
  const t = useT(landing);
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const toPack = useStore(toPackCount);
  const need = useStore(attentionCount);
  const returns = useStore(openReturnCount);
  const counts = useMemo(() => {
    const out: Partial<Record<OrderStop, number>> = {};
    for (const o of orders) {
      out[o.status] = (out[o.status] ?? 0) + 1;
      if (isAttentionOrder(o)) out.attention = (out.attention ?? 0) + 1;
    }
    return out;
  }, [orders]);
  const rows = useMemo(() => {
    const sorted = [...orders].sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
    const newest = sorted.slice(0, 3);
    const flagged = sorted.find(isAttentionOrder);
    return flagged && !newest.includes(flagged) ? [...newest, flagged] : sorted.slice(0, 4);
  }, [orders]);
  return (
    <Panel id="orders" icon={Truck} name={t.ordersName}>
      <div className="lt-side">
        <Big text={t.ordersBig[need === 1 ? 0 : 1]} vars={{ n: toPack, a: need }} />
        <p className="lt-text">{t.ordersText}</p>
        <Fact icon={Undo2}>{one(returns, t.ordersReturns)}</Fact>
        <Screens links={[{ id: "orders" }, { id: "returns" }, { id: "customers" }, { id: "slip", href: slipHref(STORY_ORDER) }]} />
      </div>
      <div className="lt-work">
        <Stops
          active={null}
          counts={counts}
          className="lt-stops"
          onChange={(stop) => {
            if (stop) router.push(`/desk/orders/?status=${stop}`);
          }}
        />
        <ul className="lt-rows" aria-label={t.ordersAria}>
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={orderHref(o.orderNumber)} className="lt-row">
                <span className="lt-row-no">{o.orderNumber}</span>
                <span className="lt-row-name">{o.customerName}</span>
                <GlyphCluster className="lt-row-glyphs" items={o.items.map((i) => ({ type: i.art, tone: i.tone }))} />
                <Track className="lt-row-track" status={o.status} attention={isAttentionOrder(o)} />
                <span className="lt-row-total">{formatChf(o.totalRappen)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function StockPanel() {
  const t = useT(landing);
  const d = useT(dashboard);
  const lang = useLang();
  const alerts = useStore(stockAlerts);
  const inbound = useStore(inboundPurchaseCount);
  const rows = useMemo(() => stockRows(alerts), [alerts]);
  return (
    <Panel id="stock" icon={Boxes} name={t.stockName}>
      <Big text={t.stockBig[rows.length === 1 ? 0 : 1]} vars={{ n: rows.length }} />
      <p className="lt-text">{t.stockText}</p>
      <ul className="lt-alerts">
        {rows.slice(0, 4).map(({ product, variant, left }) => (
          <li key={variant.id}>
            <Link href="/desk/inventory/?filter=low" className="lt-alert">
              <span className="lt-thumb">
                <ProductArt type={product.art} tone={product.tone} printed={product.printedName} />
              </span>
              <span className="lt-alert-text">
                <span className="lt-alert-name">{plainName(lang === "de" ? product.nameDe : product.nameEn)}</span>
                <span className="lt-alert-sub">{`${sizeLabel(variant.size, lang)} / ${d.colors[variant.color] ?? variant.color}`}</span>
              </span>
              <span className="lt-left" data-out={left <= 0 ? "" : undefined}>
                {left <= 0 ? d.out : fmt(d.left, { n: left })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Fact icon={Truck}>{one(inbound, t.stockInbound)}</Fact>
      <Screens links={[{ id: "inventory" }, { id: "production" }, { id: "stockcount" }, { id: "labels", href: "/print/labels/?copies=1" }]} />
    </Panel>
  );
}

function LaunchPanel() {
  const t = useT(landing);
  const lang = useLang();
  const products = useStore((s) => s.products);
  const counts = useStore(onSaleCounts);
  const next = useStore(nextDrop);
  const shelf = useMemo(() => products.filter((p) => p.status === "active").slice(0, SHELF), [products]);
  return (
    <Panel id="launch" icon={Rocket} name={t.launchName}>
      <div className="lt-launch-top">
        <div className="lt-launch-words">
          <Big text={t.launchBig[counts.products === 1 ? 0 : 1]} vars={{ n: counts.products }} />
          <p className="lt-sub">{one(counts.variants, t.launchVariants)}</p>
          <p className="lt-text">{t.launchText}</p>
        </div>
        {next ? (
          <Link href={`/desk/drops/?open=${next.drop.id}`} className="lt-drop f-stage" aria-label={fmt(t.dropOpen, { name: next.drop.name })}>
            <span className="lt-drop-label">{t.dropNext}</span>
            <span className="lt-drop-name">{next.drop.name}</span>
            <span className="lt-drop-days">{one(next.daysLeft, t.dropDays)}</span>
            <span className="lt-drop-bar" aria-hidden="true">
              <i style={{ width: `${next.tasksTotal ? (next.tasksDone / next.tasksTotal) * 100 : 0}%` }} />
            </span>
            <span className="lt-drop-foot">
              <span>{fmt(t.dropTasks, { a: next.tasksDone, b: next.tasksTotal })}</span>
              <span>{fmt(t.dropWaiting, { n: next.waiting })}</span>
            </span>
          </Link>
        ) : null}
      </div>
      <ul className="lt-shelf" aria-label={t.launchShelf}>
        {shelf.map((p, i) => {
          const name = lang === "de" ? p.nameDe : p.nameEn;
          return (
            <li key={p.id} className={TILES[i % TILES.length]}>
              <Link href={`/desk/products/?open=${p.id}`} aria-label={name} title={name}>
                <ProductArt type={p.art} tone={p.tone} printed={p.printedName} />
              </Link>
            </li>
          );
        })}
      </ul>
      <Screens links={[{ id: "products" }, { id: "collections" }, { id: "drops" }, { id: "discounts" }, { id: "marketing" }, { id: "analytics" }]} />
    </Panel>
  );
}

function MoneyPanel() {
  const t = useT(landing);
  const d = useT(dashboard);
  const lang = useLang();
  const running = useStore(monthlyRunningCost);
  const months = useStore(moneyOutByMonth);
  const ledger = useStore((s) => s.ledger);
  const newest = useMemo(() => [...ledger].sort(bookOrder).slice(-4).reverse(), [ledger]);
  const bars = useMemo(() => months.map((m) => ({ key: m.month, label: d.months[Number(m.month.slice(5, 7)) - 1], value: m.rappen })), [months, d.months]);
  const francs = (rappen: number) => formatChf(Math.round(rappen / 100) * 100).replace(/\.00$/, "");
  return (
    <Panel id="money" icon={Wallet} name={t.moneyName}>
      <Big text={t.moneyBig} vars={{ chf: formatChf(running) }} />
      <p className="lt-text">{t.moneyText}</p>
      <div className="lt-money-work">
        <div className="lt-money-bars">
          <p className="lt-mini-title">{t.moneyBars}</p>
          <Bars data={bars} caption={t.moneyBarsCaption} formatValue={francs} height={132} />
        </div>
        <div className="lt-money-book">
          <p className="lt-mini-title">{t.moneyBook}</p>
          <ul className="lt-book">
            {newest.map((e) => (
              <li key={e.id}>
                <Link href="/desk/finance/" className="lt-entry">
                  <span className="lt-entry-title">{seedText(e.title, lang)}</span>
                  <span className="lt-entry-when">{formatDate(e.occurredOn)}</span>
                  <span className="lt-entry-amount" data-in={e.amountRappen > 0 ? "" : undefined}>
                    {formatChf(e.amountRappen)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Screens links={[{ id: "ledger" }, { id: "costs" }, { id: "reports" }, { id: "refunds" }]} />
    </Panel>
  );
}

function TeamPanel() {
  const t = useT(landing);
  const lang = useLang();
  const router = useRouter();
  const due = useStore(dueThisWeekCount);
  const mail = useStore(priorityMailCount);
  const load = useStore(teamLoad);
  return (
    <Panel id="team" icon={UsersRound} name={t.teamName}>
      <Big text={t.teamBig[due === 1 ? 0 : 1]} vars={{ n: due }} />
      <p className="lt-text">{t.teamText}</p>
      <ul className="lt-people">
        {load.map(({ member, openTasks, areas, areasTotal }) => (
          <li key={member.profile}>
            <button
              type="button"
              className="lt-person"
              aria-label={fmt(t.teamStepInAria, { name: member.name })}
              onClick={() => {
                if (setProfile(member.profile).ok) router.push("/desk/");
              }}
            >
              <span className="lt-avatar" aria-hidden="true">
                {member.initials}
              </span>
              <span className="lt-person-text">
                <span className="lt-person-name">{member.name}</span>
                <span className="lt-person-role">{lang === "de" ? member.roleDe : member.roleEn}</span>
                <span className="lt-person-load">{fmt(t.teamRow, { t: openTasks, a: areas, b: areasTotal })}</span>
              </span>
              <span className="lt-person-go">
                {t.teamStepIn}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Fact icon={Inbox}>{one(mail, t.teamMail)}</Fact>
      <Screens links={[{ id: "checklist" }, { id: "calendar" }, { id: "inbox" }, { id: "files" }, { id: "team" }]} />
    </Panel>
  );
}

function RunPanel() {
  const t = useT(landing);
  const lang = useLang();
  const health = useStore(healthSummary);
  const run = useStore(latestFullRun);
  const areas = useStore(systemAreas);
  const attention = useStore(systemAttentionCount);
  return (
    <Panel id="run" icon={MonitorCog} name={t.runName}>
      <div className="lt-side">
        <Big text={t.runBig} vars={{ p: health.pass, t: health.total }} />
        <p className="lt-text">{t.runText}</p>
        <Screens
          links={[
            { id: "system" },
            { id: "map" },
            { id: "health" },
            { id: "deploys" },
            { id: "su-access", label: t.runAccess, onClick: () => void setProfile("superUser") },
          ]}
        />
      </div>
      <div className="lt-work lt-run-work">
        <Link href="/desk/system/health/" className="lt-checks-link">
          <span className="lt-checks" role="img" aria-label={fmt(t.runChecksAria, { p: health.pass, w: health.warn, f: health.fail })}>
            {run?.checks.map((check) => (
              <i key={check.id} data-status={check.status} title={check.id} />
            ))}
          </span>
          <span className="lt-checks-legend">
            <Status tone="ok">{fmt(t.runPass, { n: health.pass })}</Status>
            <Status tone="warn">{fmt(t.runWarn, { n: health.warn })}</Status>
            <Status tone="bad">{fmt(t.runFail, { n: health.fail })}</Status>
          </span>
        </Link>
        <div className="lt-lights-box">
          <p className="lt-mini-title">{one(attention, t.runAreas)}</p>
          <ul className="lt-lights">
            {areas.map((area) => {
              const screen = screenById(area.id);
              return (
                <li key={area.id}>
                  <Link href={screen.route} className="lt-light">
                    <Status tone={area.tone}>{screenName(screen, lang)}</Status>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** What staff actually do, area by area, with live numbers and a real piece of each area's work. */
export function DeskTour() {
  const t = useT(landing);
  return (
    <section className="lt" id="inside" aria-labelledby="lt-title">
      <div className="lt-head">
        <p className="lt-eyebrow">{t.tourEyebrow}</p>
        <h2 id="lt-title" className="lt-title">
          {t.tourTitle}
        </h2>
        <p className="lt-lead">{t.tourLead}</p>
      </div>
      <div className="lt-grid">
        <OrdersPanel />
        <StockPanel />
        <LaunchPanel />
        <MoneyPanel />
        <TeamPanel />
        <RunPanel />
      </div>
      <div className="lt-foot">
        <div className="lt-foot-words">
          <p className="lt-foot-title">{t.tourFootTitle}</p>
          <p className="lt-text">{t.tourFootText}</p>
        </div>
        <Link href="/desk/" className="lp-go-main">
          {t.openDesk}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <StepInChips className="lp-chips-row" />
      </div>
    </section>
  );
}

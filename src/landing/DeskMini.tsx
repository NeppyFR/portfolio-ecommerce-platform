"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, Search } from "lucide-react";
import { CollectionCard, KpiRow, RecentOrders, RevenueCard } from "@/desk/dashboard/DashboardScreen";
import { incomingOrderPlayed, playIncomingOrder } from "@/desk/dashboard/incoming-order";
import { screenById } from "@/desk/registry";
import { NAV_GROUPS } from "@/desk/shell/sidebar-nav";
import { fmt, useLang, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { dashboard } from "@/i18n/dict/dashboard";
import { landing } from "@/i18n/dict/landing";
import { shell } from "@/i18n/dict/shell";
import { PROJECT, TEAM } from "@/lib/brand";
import { useStore } from "@/store/core";
import { priorityMailCount } from "@/store/selectors";
import { DemoPill, Mark } from "@/ui";

const INSERT_DELAY_MS = 1200;
const ORDER_ROWS = 6;
const noRange = () => undefined;

function MiniSidebar() {
  const lang = useLang();
  const mail = useStore(priorityMailCount);
  return (
    <div className="dm-side">
      <div className="dm-brand">
        <Mark size={18} />
        <span>{PROJECT.title}</span>
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="dm-group">
          {group.id === "main" || group.id === "start" ? null : <p className="dm-label">{group[lang]}</p>}
          {group.items
            .filter((item) => !item.superUserOnly)
            .map((item) => (
              <span key={item.id} className="dm-item" data-on={item.id === "dashboard" ? "" : undefined}>
                <item.icon size={15} strokeWidth={1.75} aria-hidden="true" />
                <span className="dm-word">{item[lang]}</span>
                {item.id === "inbox" && mail > 0 ? <span className="dm-badge">{mail}</span> : null}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The real Dashboard cards in a window frame, reading the real store: nothing in here is drawn for the page.
 * The frame is inert under one link, so the cards keep their own links and buttons without nesting them.
 * The order that arrives is the Dashboard's own simulated one, so opening the desk shows that same order and no second one.
 */
export function DeskMini() {
  const t = useT(landing);
  const d = useT(dashboard);
  const c = useT(common);
  const s = useT(shell);
  const lang = useLang();
  const title = screenById("dashboard")[lang];
  const [arrived, setArrived] = useState<string | null>(null);

  useEffect(() => {
    if (incomingOrderPlayed()) return;
    const timer = window.setTimeout(() => {
      const result = playIncomingOrder();
      if (result?.ok && result.data.orderNumber) setArrived(result.data.orderNumber);
    }, INSERT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="dm">
      <Link href="/desk/" className="dm-cover" aria-label={t.miniAria} />
      <div className="dm-frame" inert aria-hidden="true">
        <div className="dm-bar">
          <span className="dm-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="dm-where">
            {PROJECT.title}
            <span className="dm-sep">/</span>
            {title}
          </span>
          <span className="dm-open">
            {t.miniOpen}
            <ArrowRight size={14} />
          </span>
        </div>
        <div className="dm-body">
          <MiniSidebar />
          <div className="dm-main">
            <div className="dm-head">
              <div className="dm-head-words">
                <p className="dm-title">{title}</p>
                <p className="dm-sub">{d.subtitle}</p>
              </div>
              <DemoPill className="dm-pill" />
              <span className="dm-search">
                <Search size={14} />
                <span>{s.jumpShort}</span>
              </span>
              <span className="dm-bell">
                <Bell size={16} strokeWidth={1.75} />
              </span>
              <span className="dm-me">{TEAM[0].initials}</span>
            </div>
            <div className="db dm-db">
              <KpiRow rangeId="7d" revenue orders />
              <div className="dm-mid">
                <RevenueCard rangeId="7d" onRange={noRange} />
                <CollectionCard rangeId="7d" />
                <RecentOrders count={ORDER_ROWS} />
              </div>
            </div>
          </div>
        </div>
        {arrived ? (
          <div className="dm-toast">
            <span>{fmt(d.newOrder, { number: arrived })}</span>
            <span>{c.demoToast}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

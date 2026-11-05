"use client";

import "./shop.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { fmt, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { LABEL } from "@/lib/brand";
import { itemCount } from "@/lib/cart";
import { useStore } from "@/store/core";
import { LangToggle } from "@/ui/LangToggle";
import { Sheet } from "@/ui/Sheet";
import { useReducedMotion } from "@/ui/useReducedMotion";
import { packetSeq, serverPacketSeq, subscribePacket } from "./packet";

function Wire() {
  const seq = useSyncExternalStore(subscribePacket, packetSeq, serverPacketSeq);
  const reduced = useReducedMotion();
  return (
    <div className="sp-wire" aria-hidden="true">
      {seq > 0 && !reduced ? (
        <motion.span key={seq} className="sp-packet-run" initial={{ x: "0%", opacity: 1 }} animate={{ x: "100%", opacity: [1, 1, 0] }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], times: [0, 0.92, 1] }}>
          <span className="sp-packet" />
        </motion.span>
      ) : null}
    </div>
  );
}

function BagLink() {
  const t = useT(shop);
  const count = useStore((s) => itemCount(s.bag));
  const seq = useSyncExternalStore(subscribePacket, packetSeq, serverPacketSeq);
  const reduced = useReducedMotion();
  const label = count === 1 ? t.nav.bagWithOne : count > 1 ? fmt(t.nav.bagWith, { n: count }) : t.nav.bag;
  return (
    <Link href="/shop/bag/" className="sp-bag" aria-label={label} title={t.nav.bag}>
      <motion.span key={seq} className="sp-bag-inner" initial={seq > 0 && !reduced ? { scale: 1.12 } : false} animate={{ scale: 1 }} transition={{ delay: 0.36, duration: 0.14 }}>
        <ShoppingBag size={20} aria-hidden="true" />
        <span className="sp-bag-count type-mono">{count}</span>
      </motion.span>
    </Link>
  );
}

function Nav({ onPick }: { onPick?: () => void }) {
  const t = useT(shop);
  const path = usePathname();
  const items = [
    { href: "/shop/", label: t.nav.shop, on: path === "/shop/" || path === "/shop" },
    { href: "/shop/all/", label: t.nav.all, on: path.startsWith("/shop/all") || path.startsWith("/shop/c/") },
    { href: "/shop/search/", label: t.nav.search, on: path.startsWith("/shop/search") },
  ];
  return (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.on ? "page" : undefined} onClick={onPick}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

/** Demo strip, black header with its wire into the bag, skip link, and the footer row. */
export function ShopShell({ children }: { children: ReactNode }) {
  const t = useT(shop);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenu(false), [pathname]);
  return (
    <div className="sp-root">
      <a className="sp-skip" href="#main">
        {t.skip}
      </a>
      <div className="sp-strip type-small">
        <span>{fmt(t.strip, { label: LABEL.name })}</span>
        <Link href="/">{t.stripLink}</Link>
      </div>
      <header className="sp-head">
        <div className="sp-head-row">
          <div className="sp-head-left">
            <button type="button" className="ui-iconbtn sp-menu-btn" aria-label={t.nav.openMenu} title={t.nav.openMenu} onClick={() => setMenu(true)}>
              <Menu size={22} aria-hidden="true" />
            </button>
            <nav className="sp-nav" aria-label={t.nav.label}>
              <Nav />
            </nav>
          </div>
          <Link href="/shop/" className="sp-wordmark">
            {LABEL.name}
          </Link>
          <div className="sp-head-right">
            <LangToggle className="sp-head-lang" />
            <BagLink />
          </div>
        </div>
        <Wire />
      </header>
      <Sheet open={menu} onClose={() => setMenu(false)} title={t.nav.menu}>
        <nav className="sp-menu" aria-label={t.nav.label}>
          <Nav onPick={() => setMenu(false)} />
        </nav>
        <LangToggle className="sp-menu-lang" />
      </Sheet>
      <main id="main" tabIndex={-1} className="sp-main">
        {children}
      </main>
      <footer className="sp-foot">
        <span className="sp-foot-word">{LABEL.name}</span>
        <nav aria-label={t.nav.footer} className="sp-foot-nav">
          <Link href="/shop/search/">
            <Search size={14} aria-hidden="true" />
            {t.nav.search}
          </Link>
          <LangToggle />
        </nav>
        <p className="type-small sp-foot-demo">{t.footerDemo}</p>
      </footer>
    </div>
  );
}

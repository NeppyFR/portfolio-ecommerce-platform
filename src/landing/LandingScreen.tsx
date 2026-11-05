"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { StepInChips } from "@/desk/enter/StepInChips";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { landing } from "@/i18n/dict/landing";
import { LABEL, PROJECT } from "@/lib/brand";
import { formatChf, formatDateTime } from "@/lib/format";
import { orderHref, productHref } from "@/lib/routes";
import { EDGES, VIEWBOX, nodeById } from "@/map/data";
import { MapSheet } from "@/map/MapSheet";
import { createClock } from "@/map/packets";
import { useStore } from "@/store/core";
import { attentionCount, isAttentionOrder, toPackCount } from "@/store/selectors";
import type { GarmentTone, GarmentType, NodeId, OrderStop } from "@/store/types";
import { Garment, GlyphCluster, LangToggle, Mark, Stops, Track } from "@/ui";
import { LiveMap, MapDefs } from "./LiveMap";
import { PublicRail } from "./PublicRail";
import { StoryPanel } from "./StoryPanel";
import "./landing.css";

const LEDGER: { value: string; key: keyof typeof landing.en.ledger }[] = [
  { value: "435", key: "commits" },
  { value: "65", key: "prs" },
  { value: "45", key: "migrations" },
  { value: "64", key: "tables" },
  { value: "87", key: "functions" },
  { value: "1'134", key: "assertions" },
  { value: "1'301", key: "unit" },
  { value: "195", key: "browser" },
  { value: "60", key: "probes" },
  { value: "53", key: "screens" },
  { value: "2", key: "languages" },
];

const STRIP: { slug: string; type: GarmentType; tone: GarmentTone; tile: string; en: string; de: string; printed?: boolean }[] = [
  { slug: "lagoon-zip-hoodie", type: "zip", tone: "azure", tile: "t-mist", en: "Lagoon Zip Hoodie", de: "Lagoon Zip-Hoodie" },
  { slug: "heavyweight-tee-lilac", type: "tee", tone: "lilac", tile: "t-deep", en: "Heavyweight Tee, Lilac", de: "Heavyweight-Tee, Flieder" },
  { slug: "essential-hoodie-cobalt", type: "hoodie", tone: "dusk", tile: "t-ice", en: "Essential Hoodie, Cobalt", de: "Essential Hoodie, Kobalt" },
  { slug: "washed-cap-lagoon", type: "cap", tone: "sky", tile: "t-vio", en: "Washed Cap, Lagoon", de: "Washed Cap, Lagoon" },
  { slug: "relaxed-cargo-pants", type: "cargo", tone: "sky", tile: "t-lil", en: "Relaxed Cargo Pants, Ice", de: "Relaxed Cargo-Hose, Eis" },
  { slug: "canvas-tote-cloud", type: "tote", tone: "ice", tile: "t-cob", en: "Canvas Tote, Cloud", de: "Canvas-Tasche, Wolke", printed: true },
];

function Hero() {
  const t = useT(landing);
  const lang = useLang();
  const router = useRouter();
  const clock = useRef(createClock()).current;
  const [sheet, setSheet] = useState<NodeId | null>(null);

  const onNode = (id: NodeId) => {
    if (id === "customers") router.push("/shop/");
    else if (id === "staff") router.push("/desk/enter/");
    else setSheet(id);
  };

  return (
    <div className="lp-hero-wrap">
      <section className="lp-hero f-landing" aria-labelledby="lp-title">
        <div className="lp-stage">
          <PublicRail active="map" />
          <div className="lp-copy" id="main">
            <h1 id="lp-title" className="lp-h1">
              <span>{t.headline1}</span>
              <span>{t.headline2}</span>
              <em>{t.headline3}</em>
            </h1>
          </div>
          <div className="lp-side">
            <p className="lp-sentence">{t.sentence}</p>
            <p className="lp-honest">{t.honesty}</p>
          </div>
          <div className="lp-cta">
            <StepInChips className="lp-chips" />
            <Link href="/shop/" className="lp-enter">
              {t.enterShop}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <MapDefs />
          <LiveMap mode="hero" viewBox={VIEWBOX.hero} onNode={onNode} clock={clock} className="lp-map lp-map-wide" ariaLabel={t.mapAria} />
          <div className="lp-map-low">
            <LiveMap mode="phone" labels={false} onNode={onNode} clock={clock} className="lp-map lp-map-phone" ariaLabel={t.mapAria} />
            <div className="lp-low-side">
              <StoryPanel clock={clock} className="lp-panel-flow" />
              <details className="lp-all">
                <summary>{t.allConnections}</summary>
                <p className="lp-all-hint">{t.connectionsHint}</p>
                <ul>
                  {EDGES.map((e) => {
                    const a = nodeById(e.from);
                    const b = nodeById(e.to);
                    return (
                      <li key={e.id}>
                        <span className="lp-all-route">
                          {lang === "de" ? a.de : a.en} <span aria-hidden="true">→</span> {lang === "de" ? b.de : b.en}
                        </span>
                        <span className="lp-all-what">{lang === "de" ? e.de : e.en}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </div>
          </div>
          <StoryPanel clock={clock} className="lp-panel-float" />
        </div>
      </section>
      <dl className="lp-ledger" aria-label={t.ledgerAria}>
        {LEDGER.map((c) => (
          <div key={c.key}>
            <dt>{t.ledger[c.key]}</dt>
            <dd>{c.value}</dd>
          </div>
        ))}
      </dl>
      <MapSheet node={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function ShopStrip() {
  const t = useT(landing);
  const lang = useLang();
  return (
    <section className="lp-shop" aria-labelledby="lp-shop-title">
      <div className="lp-shop-head">
        <h2 id="lp-shop-title" className="lp-shop-line">
          {LABEL.tagline[lang]}
        </h2>
        <p className="lp-shop-copy">{t.shopSentence}</p>
        <Link href="/shop/" className="lp-shop-link">
          {t.shopLink}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ul className="lp-band">
        {STRIP.map((g) => {
          const name = lang === "de" ? g.de : g.en;
          return (
            <li key={g.slug} className={g.tile}>
              <Link href={productHref(g.slug)} aria-label={fmt(t.shopTileAria, { name })}>
                <Garment type={g.type} tone={g.tone} printed={g.printed} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DeskStrip() {
  const t = useT(landing);
  const router = useRouter();
  const orders = useStore((s) => s.orders);
  const toPack = useStore(toPackCount);
  const need = useStore(attentionCount);
  const counts = useMemo(() => {
    const out: Partial<Record<OrderStop, number>> = {};
    for (const o of orders) {
      out[o.status] = (out[o.status] ?? 0) + 1;
      if (isAttentionOrder(o)) out.attention = (out.attention ?? 0) + 1;
    }
    return out;
  }, [orders]);
  const newest = useMemo(() => [...orders].sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1)).slice(0, 3), [orders]);
  return (
    <section className="lp-desk" aria-labelledby="lp-desk-title">
      <div className="lp-desk-head">
        <p className="lp-eyebrow">{t.deskEyebrow}</p>
        <h2 id="lp-desk-title" className="lp-desk-title">
          {fmt(need === 1 ? t.deskTitleOne : t.deskTitle, { n: toPack, a: need })}
        </h2>
        <p className="lp-desk-copy">{t.deskSentence}</p>
      </div>
      <Stops
        active={null}
        counts={counts}
        className="lp-desk-stops"
        onChange={(stop) => {
          if (stop) router.push(`/desk/orders/?status=${stop}`);
        }}
      />
      <ul className="lp-rows" aria-label={t.deskAria}>
        {newest.map((o) => (
          <li key={o.id}>
            <Link href={orderHref(o.orderNumber)} className="lp-row">
              <span className="lp-row-no">{o.orderNumber}</span>
              <span className="lp-row-when">{formatDateTime(o.placedAt)}</span>
              <span className="lp-row-name">{o.customerName}</span>
              <GlyphCluster className="lp-row-glyphs" items={o.items.map((i) => ({ type: i.garment, tone: i.tone }))} />
              <Track className="lp-row-track" status={o.status} attention={isAttentionOrder(o)} />
              <span className="lp-row-total">{formatChf(o.totalRappen)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="lp-desk-foot">
        <StepInChips />
        <Link href="/desk/orders/" className="lp-shop-link">
          {t.deskAll}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function tornEdge(): string {
  const heights = [3, 7, 1, 6, 2, 8, 3, 5, 1, 7, 4, 8, 2, 6, 3, 7, 1, 5, 4, 8, 2, 6, 1, 7, 3, 5, 2, 8, 4, 6, 1, 7, 3, 5];
  const step = 100 / (heights.length - 1);
  return `M0 10 ${heights.map((h, i) => `L${(i * step).toFixed(2)} ${h}`).join(" ")} L100 10 Z`;
}

function Receipt() {
  const t = useT(landing);
  const rows = [t.receiptDatabase, t.receiptPayments, t.receiptEmail, t.receiptStorage, t.receiptApis];
  const zero = formatChf(0);
  return (
    <section className="lp-receipt f-receipt" aria-labelledby="lp-receipt-title">
      <div className="lp-receipt-copy">
        <p className="lp-eyebrow">{t.receiptEyebrow}</p>
        <h2 id="lp-receipt-title" className="lp-receipt-title">
          {t.receiptTitle}
        </h2>
        <p className="lp-receipt-text">{t.receiptSentence}</p>
      </div>
      <div className="lp-slip">
        <svg className="lp-slip-edge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <path d={tornEdge()} />
        </svg>
        <div className="lp-slip-body">
          <p className="lp-slip-head">{t.receiptHead}</p>
          <p className="lp-slip-sub">{t.receiptSub}</p>
          <dl>
            {rows.map((r) => (
              <div key={r}>
                <dt>{r}</dt>
                <dd>{zero}</dd>
              </div>
            ))}
            <div className="lp-slip-total">
              <dt>{t.receiptTotal}</dt>
              <dd>{zero}</dd>
            </div>
          </dl>
          <Link href="/built/" className="lp-shop-link">
            {t.receiptLink}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useT(landing);
  return (
    <footer className="lp-foot">
      <span className="lp-foot-brand">
        <Mark size={18} />
        {PROJECT.title}
      </span>
      <span className="lp-foot-note">{t.footerNote}</span>
      <LangToggle />
    </footer>
  );
}

export function LandingScreen() {
  useDocTitle(null);
  return (
    <main className="lp">
      <Hero />
      <ShopStrip />
      <DeskStrip />
      <Receipt />
      <Footer />
    </main>
  );
}

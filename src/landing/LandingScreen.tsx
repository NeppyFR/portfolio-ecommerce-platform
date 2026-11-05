"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { StepInChips } from "@/desk/enter/StepInChips";
import { fmt, useDocTitle, useLang, useT } from "@/i18n";
import { landing } from "@/i18n/dict/landing";
import { LABEL, PROJECT } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { productHref } from "@/lib/routes";
import { EDGES, VIEWBOX, nodeById } from "@/map/data";
import { MapSheet } from "@/map/MapSheet";
import { createClock } from "@/map/packets";
import type { ArtTone, ProductArtType, NodeId } from "@/store/types";
import { ProductArt, Mark } from "@/ui";
import { DeskMini } from "./DeskMini";
import { DeskTour } from "./DeskTour";
import { LiveMap, MapDefs } from "./LiveMap";
import { StoryPanel } from "./StoryPanel";
import "./landing.css";
import "./desk.css";

const LEDGER: { value: string; key: keyof typeof landing.en.ledger }[] = [
  { value: "53", key: "screens" },
  { value: "435", key: "commits" },
  { value: "65", key: "prs" },
  { value: "45", key: "migrations" },
  { value: "64", key: "tables" },
  { value: "87", key: "functions" },
  { value: "1'134", key: "assertions" },
  { value: "1'301", key: "unit" },
  { value: "195", key: "browser" },
  { value: "60", key: "probes" },
  { value: "2", key: "languages" },
];

const STRIP: { slug: string; type: ProductArtType; tone: ArtTone; tile: string; en: string; de: string; printed?: boolean }[] = [
  { slug: "lagoon-speaker", type: "speaker", tone: "azure", tile: "t-mist", en: "Lagoon Speaker", de: "Lagoon-Lautsprecher" },
  { slug: "trail-bottle", type: "bottle", tone: "lilac", tile: "t-deep", en: "Trail Bottle", de: "Trail-Flasche" },
  { slug: "desk-lamp", type: "lamp", tone: "dusk", tile: "t-ice", en: "Desk Lamp", de: "Schreibtischlampe" },
  { slug: "zip-pouch-lagoon", type: "pouch", tone: "sky", tile: "t-vio", en: "Zip Pouch, Lagoon", de: "Zip-Etui, Lagoon" },
  { slug: "stoneware-planter", type: "planter", tone: "sky", tile: "t-lil", en: "Stoneware Planter", de: "Steinzeug-Topf" },
  { slug: "logo-notebook-cloud", type: "notebook", tone: "ice", tile: "t-cob", en: "Logo Notebook, Cloud", de: "Logo-Notizbuch, Wolke", printed: true },
];

/** Every wire in words, closed until asked for. The drawing's labels only show under a pointer, so this is the way in without one. */
function AllConnections({ className }: { className?: string }) {
  const t = useT(landing);
  const lang = useLang();
  return (
    <details className={`lp-all ${className ?? ""}`}>
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
  );
}

function Hero() {
  const t = useT(landing);
  return (
    <section className="lp-top" aria-labelledby="lp-title">
      <div className="lp-top-stage">
        <div className="lp-top-head">
          <h1 id="lp-title" className="lp-h1">
            <span>{t.headline1}</span>
            <span>{t.headline2}</span>
            <em>{t.headline3}</em>
          </h1>
          <div className="lp-top-side">
            <p className="lp-sentence">{fmt(t.sentence, { label: LABEL.name })}</p>
            <div className="lp-go">
              <Link href="/desk/" className="lp-go-main">
                {t.openDesk}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/shop/" className="lp-go-quiet">
                {t.enterShop}
              </Link>
              <StepInChips className="lp-chips-row" />
            </div>
          </div>
        </div>
        <DeskMini />
      </div>
    </section>
  );
}

function HostingMap() {
  const t = useT(landing);
  const router = useRouter();
  const clock = useRef(createClock()).current;
  const [sheet, setSheet] = useState<NodeId | null>(null);

  const onNode = (id: NodeId) => {
    if (id === "customers") router.push("/shop/");
    else if (id === "staff") router.push("/desk/enter/");
    else setSheet(id);
  };

  return (
    <>
      <section id="map" className="lp-hero f-landing" aria-labelledby="lp-map-title">
        <div className="lp-stage">
          <div className="lp-copy">
            <h2 id="lp-map-title" className="lp-h1">
              <span>{t.mapTitle1}</span>
              <span>{t.mapTitle2}</span>
            </h2>
            <div className="lp-side">
              <p className="lp-sentence">{t.mapSentence}</p>
              <p className="lp-honest">{t.honesty}</p>
            </div>
          </div>
          <StoryPanel clock={clock} className="lp-panel-float" />
          <MapDefs />
          <LiveMap mode="hero" viewBox={VIEWBOX.hero} onNode={onNode} clock={clock} className="lp-map lp-map-wide" ariaLabel={t.mapAria} />
          <LiveMap mode="snug" viewBox={VIEWBOX.snug} onNode={onNode} clock={clock} className="lp-map lp-map-snug" ariaLabel={t.mapAria} />
          <AllConnections className="lp-all-wide" />
          <div className="lp-map-low">
            <LiveMap mode="phone" labels={false} onNode={onNode} clock={clock} className="lp-map lp-map-phone" ariaLabel={t.mapAria} />
            <div className="lp-low-side">
              <StoryPanel clock={clock} className="lp-panel-flow" />
              <AllConnections />
            </div>
          </div>
        </div>
      </section>
      <MapSheet node={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

function Ledger() {
  const t = useT(landing);
  return (
    <dl className="lp-ledger" aria-label={t.ledgerAria}>
      {LEDGER.map((c) => (
        <div key={c.key}>
          <dt>{t.ledger[c.key]}</dt>
          <dd>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShopStrip() {
  const t = useT(landing);
  const lang = useLang();
  return (
    <section className="lp-shop" aria-labelledby="lp-shop-title">
      <div className="lp-shop-bar">
        <ul className="lp-band">
          {STRIP.map((g) => {
            const name = lang === "de" ? g.de : g.en;
            return (
              <li key={g.slug} className={g.tile}>
                <Link href={productHref(g.slug)} aria-label={fmt(t.shopTileAria, { name })}>
                  <ProductArt type={g.type} tone={g.tone} printed={g.printed} />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="lp-shop-words">
          <h2 id="lp-shop-title" className="lp-shop-line">
            {LABEL.tagline[lang]}
          </h2>
          <p className="lp-shop-copy">{t.shopSentence}</p>
        </div>
        <Link href="/shop/" className="lp-shop-link">
          {t.shopLink}
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
    </footer>
  );
}

/** The overview. It renders inside the desk shell, which brings the sidebar, the header cluster and the one main landmark. */
export function LandingScreen() {
  useDocTitle(null);
  return (
    <div className="lp lp-in-desk">
      <div className="lp-hero-wrap">
        <Hero />
        <DeskTour />
        <HostingMap />
        <Ledger />
        <ShopStrip />
        <Receipt />
        <Footer />
      </div>
    </div>
  );
}

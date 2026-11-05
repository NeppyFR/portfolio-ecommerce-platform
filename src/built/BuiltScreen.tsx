"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDocTitle, useLang, useT } from "@/i18n";
import { built } from "@/i18n/dict/built";
import { shell } from "@/i18n/dict/shell";
import { PROJECT } from "@/lib/brand";
import { EDGES, VIEWBOX, nodeById } from "@/map/data";
import { MapSheet } from "@/map/MapSheet";
import { LiveMap, MapDefs } from "@/landing/LiveMap";
import { HEALTH_CHECKS } from "@/store/seed/system";
import type { NodeId } from "@/store/types";
import { Mark, Status, Table, type Column } from "@/ui";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import "@/landing/landing.css";
import "./built.css";

type Sentence = string[];
type EdgeRow = (typeof EDGES)[number];

const ANCHORS = [
  { id: "map", key: "map" },
  { id: "architecture", key: "architecture" },
  { id: "money-path", key: "moneyPath" },
  { id: "security", key: "security" },
  { id: "testing", key: "testing" },
  { id: "timeline", key: "timeline" },
  { id: "demo", key: "demo" },
] as const;

const CHECK_GROUPS: { key: keyof typeof built.en.checkGroups; test: (id: string) => boolean }[] = [
  { key: "site", test: (id) => id.startsWith("env.") || id.startsWith("site.") },
  { key: "admin", test: (id) => id.startsWith("admin.") },
  { key: "database", test: (id) => id.startsWith("supabase.") || id.startsWith("rls.") || id.startsWith("db.") || id.startsWith("stock.") },
  { key: "payments", test: (id) => id.startsWith("stripe.") || id.startsWith("webhook.") },
  { key: "email", test: (id) => id.startsWith("email.") },
  { key: "inbox", test: (id) => id.startsWith("inbox.") },
  { key: "outside", test: (id) => id.startsWith("headers.") || id.startsWith("exposure.") || id.startsWith("tls.") || id.startsWith("npm.") },
];

function Head({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="bt-head">
      <p className="bt-eyebrow">{eyebrow}</p>
      <h2 className="bt-title">{title}</h2>
      {children}
    </header>
  );
}

function Anchors() {
  const t = useT(built);
  const [active, setActive] = useState<string>("map");
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const current = ANCHORS.find((a) => seen.get(a.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const a of ANCHORS) {
      const el = document.getElementById(a.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav className="bt-anchors" aria-label={t.anchorsLabel}>
      <ul>
        {ANCHORS.map((a) => (
          <li key={a.id}>
            <a href={`#${a.id}`} aria-current={active === a.id ? "true" : undefined}>
              {t.anchors[a.key]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MapSection() {
  const t = useT(built);
  const lang = useLang();
  const router = useRouter();
  const [sheet, setSheet] = useState<NodeId | null>(null);
  const onNode = (id: NodeId) => {
    if (id === "customers") router.push("/shop/");
    else if (id === "staff") router.push("/desk/enter/");
    else setSheet(id);
  };
  const columns = useMemo<Column<EdgeRow>[]>(
    () => [
      { key: "from", header: t.connFrom, cell: (e) => (lang === "de" ? nodeById(e.from).de : nodeById(e.from).en), width: "20%" },
      { key: "to", header: t.connTo, cell: (e) => (lang === "de" ? nodeById(e.to).de : nodeById(e.to).en), width: "20%" },
      { key: "what", header: t.connWhat, cell: (e) => (lang === "de" ? e.de : e.en) },
    ],
    [t, lang],
  );
  return (
    <section id="map" className="bt-section bt-map" aria-labelledby="bt-map-title">
      <div className="bt-col">
        <header className="bt-head">
          <p className="bt-eyebrow">{t.mapEyebrow}</p>
          <h2 id="bt-map-title" className="bt-title">
            {t.mapTitle}
          </h2>
          <p className="bt-line">{t.mapLine}</p>
        </header>
      </div>
      <div className="bt-map-band f-landing">
        <MapDefs />
        <LiveMap mode="hero" viewBox={VIEWBOX.hero} onNode={onNode} className="lp-map lp-map-wide-k bt-map-wide" ariaLabel={t.mapAria} />
        <LiveMap mode="snug" viewBox={VIEWBOX.snug} onNode={onNode} className="lp-map bt-map-snug" ariaLabel={t.mapAria} />
        <LiveMap mode="phone" labels={false} onNode={onNode} className="lp-map bt-map-phone" ariaLabel={t.mapAria} />
      </div>
      <div className="bt-col">
        <p className="bt-staff">{t.mapStaff}</p>
        <p className="bt-hint">{t.mapHint}</p>
        <Table
          className="bt-conn"
          caption={t.connCaption}
          columns={columns}
          rows={EDGES}
          rowKey={(e) => e.id}
          phoneRow={(e) => (
            <div className="bt-conn-card">
              <span className="type-label">
                {lang === "de" ? nodeById(e.from).de : nodeById(e.from).en} <span aria-hidden="true">→</span> {lang === "de" ? nodeById(e.to).de : nodeById(e.to).en}
              </span>
              <span className="type-small">{lang === "de" ? e.de : e.en}</span>
            </div>
          )}
        />
      </div>
      <MapSheet node={sheet} onClose={() => setSheet(null)} />
    </section>
  );
}

function ArchitectureSection() {
  const t = useT(built);
  return (
    <section id="architecture" className="bt-section" aria-label={t.archEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.archEyebrow} title={t.archTitle} />
        <ArchitectureDiagram t={t} />
      </div>
    </section>
  );
}

function Rail({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="bt-rail">
      <h3 className="bt-rail-title">{title}</h3>
      <ol>
        {steps.map((s, i) => (
          <li key={s}>
            <span className="bt-rail-no" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoneySection() {
  const t = useT(built);
  return (
    <section id="money-path" className="bt-section bt-money f-finance" aria-label={t.moneyEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.moneyEyebrow} title={t.moneyTitle} />
        <div className="bt-rails">
          <Rail title={t.railCheckout} steps={t.checkout} />
          <Rail title={t.railWebhook} steps={t.webhook} />
        </div>
        <div className="bt-promises">
          <div className="bt-promise bt-promise-main">
            <p className="bt-promise-big">{t.declinedTitle}</p>
            <p>{t.declined}</p>
          </div>
          <div className="bt-promise">
            <h3 className="type-h4">{t.lateTitle}</h3>
            <p>{t.late}</p>
          </div>
          <div className="bt-promise">
            <h3 className="type-h4">{t.pricingTitle}</h3>
            <dl className="bt-prices">
              {t.pricingRows.map(([what, total]) => (
                <div key={what}>
                  <dt>{what}</dt>
                  <dd>{total}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const t = useT(built);
  const columns = useMemo<Column<Sentence>[]>(
    () => [
      { key: "request", header: t.pathRequest, cell: (r) => <code className="type-mono">{r[0]}</code>, width: "28%" },
      { key: "what", header: t.pathWhat, cell: (r) => r[1] },
      {
        key: "result",
        header: t.pathResult,
        cell: (r) => <Status tone={r[2] === "gate" ? "ok" : "warn"}>{r[2] === "gate" ? t.pathGate : t.path400}</Status>,
        width: "16%",
      },
    ],
    [t],
  );
  return (
    <section id="security" className="bt-section" aria-label={t.securityEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.securityEyebrow} title={t.securityTitle} />
        <div className="bt-sec-grid">
          <ol className="bt-layers" aria-label={t.layersAria}>
            {t.layers.map(([name, text], i) => (
              <li key={name} data-level={i + 1}>
                <span className="bt-layer-no" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="bt-layer-text">
                  <strong>{name}</strong>
                  <span>{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="bt-details">
            <h3 className="type-h3">{t.detailsTitle}</h3>
            <dl>
              {t.details.map(([name, text]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="bt-paths">
          <h3 className="type-h3">{t.pathsTitle}</h3>
          <p className="bt-sub">{t.pathsLead}</p>
          <Table
            caption={t.pathsTitle}
            columns={columns}
            rows={t.paths}
            rowKey={(r) => r[0]}
            phoneRow={(r) => (
              <div className="bt-conn-card">
                <code className="type-mono">{r[0]}</code>
                <span className="type-small">{r[1]}</span>
                <Status tone={r[2] === "gate" ? "ok" : "warn"}>{r[2] === "gate" ? t.pathGate : t.path400}</Status>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}

function TestingSection() {
  const t = useT(built);
  return (
    <section id="testing" className="bt-section bt-testing" aria-label={t.testingEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.testingEyebrow} title={t.testingTitle} />
        <dl className="bt-ledger" aria-label={t.ledgerAria}>
          {t.ledger.map(([value, label, proof]) => (
            <div key={label}>
              <dd className="bt-ledger-value">{value}</dd>
              <dt>{label}</dt>
              <dd className="bt-ledger-proof">{proof}</dd>
            </div>
          ))}
        </dl>
        <div className="bt-health">
          <div className="bt-health-lead">
            <h3 className="type-h3">{t.healthTitle}</h3>
            <p className="bt-sub">{t.healthLead}</p>
            <dl className="bt-meanings" aria-label={t.meaningAria}>
              <div>
                <dt>
                  <Status tone="ok">{t.meanPass}</Status>
                </dt>
                <dd>{t.meanPassText}</dd>
              </div>
              <div>
                <dt>
                  <Status tone="warn">{t.meanWarn}</Status>
                </dt>
                <dd>{t.meanWarnText}</dd>
              </div>
              <div>
                <dt>
                  <Status tone="bad">{t.meanFail}</Status>
                </dt>
                <dd>{t.meanFailText}</dd>
              </div>
              <div>
                <dt>
                  <Status tone="off">{t.meanSkip}</Status>
                </dt>
                <dd>{t.meanSkipText}</dd>
              </div>
            </dl>
          </div>
          <div className="bt-checks">
            {CHECK_GROUPS.map((g) => (
              <div key={g.key} className="bt-check-group">
                <h4 className="type-h4">{t.checkGroups[g.key]}</h4>
                <ul>
                  {HEALTH_CHECKS.filter((c) => g.test(c.id)).map((c) => (
                    <li key={c.id}>
                      <code className="type-mono-s">{c.id}</code>
                      {c.security ? <span className="bt-check-tag">{t.securityTag}</span> : null}
                      <span className="bt-check-text">{t.checks[c.id]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineSection() {
  const t = useT(built);
  return (
    <section id="timeline" className="bt-section" aria-label={t.timelineEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.timelineEyebrow} title={t.timelineTitle} />
        <ol className="bt-timeline" aria-label={t.timelineAria}>
          {t.milestones.map(([date, name, text], i) => (
            <li key={date} data-side={i % 2 === 0 ? "up" : "down"}>
              <span className="bt-tl-dot" aria-hidden="true" />
              <time className="bt-tl-date">{date}</time>
              <strong className="bt-tl-name">{name}</strong>
              <span className="bt-tl-text">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function DemoSection() {
  const t = useT(built);
  type Row = (typeof t.demoRows)[number];
  const columns = useMemo<Column<Row>[]>(
    () => [
      { key: "what", header: t.demoColWhat, cell: (r) => <strong className="bt-demo-what">{r[0]}</strong>, width: "20%" },
      { key: "real", header: t.demoColReal, cell: (r) => r[1], width: "38%" },
      { key: "demo", header: t.demoColDemo, cell: (r) => r[2] },
    ],
    [t],
  );
  return (
    <section id="demo" className="bt-section bt-demo f-receipt" aria-label={t.demoEyebrow}>
      <div className="bt-col">
        <Head eyebrow={t.demoEyebrow} title={t.demoTitle}>
          <p className="bt-demo-lead">{t.demoLead}</p>
        </Head>
        <div className="bt-demo-card">
          <Table
            caption={t.demoTitle}
            columns={columns}
            rows={t.demoRows}
            rowKey={(r) => r[0]}
            phoneRow={(r) => (
              <div className="bt-conn-card">
                <strong className="bt-demo-what">{r[0]}</strong>
                <span className="type-small">
                  <span className="bt-demo-tag">{t.demoColReal}: </span>
                  {r[1]}
                </span>
                <span className="type-small">
                  <span className="bt-demo-tag">{t.demoColDemo}: </span>
                  {r[2]}
                </span>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}

export function BuiltScreen() {
  const t = useT(built);
  useDocTitle(useT(shell).built);
  return (
    <div className="lp lp-in-desk bt">
      <div className="bt-top f-landing">
        <div className="bt-col bt-hero">
          <p className="bt-eyebrow">{t.metaEyebrow}</p>
          <h1 className="bt-h1">{t.title}</h1>
          <p className="bt-intro">{t.intro}</p>
        </div>
      </div>
      <Anchors />
      <MapSection />
      <ArchitectureSection />
      <MoneySection />
      <SecuritySection />
      <TestingSection />
      <TimelineSection />
      <DemoSection />
      <footer className="lp-foot">
        <span className="lp-foot-brand">
          <Mark size={18} />
          {PROJECT.title}
        </span>
        <span className="lp-foot-note">{t.footerNote}</span>
      </footer>
    </div>
  );
}

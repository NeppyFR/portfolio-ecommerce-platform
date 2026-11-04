"use client";

import { useMemo, useState } from "react";
import { CreditCard, Database, GitBranch, HeartPulse, Mail, Rocket, ShieldCheck, SlidersHorizontal, Timer, TriangleAlert, Unplug, type LucideIcon } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { screenById, type ScreenId } from "@/desk/registry";
import { attentionAreas, countChecks, latestPerWorkflow, loginSummary, nodeLights, whenOf, type AreaId, type AreaLight } from "@/desk/system/rules/lights";
import { Facts, Intro, Panel, Strip, TabLink, lightText, nodeStatus, useLights, type StripCell } from "@/desk/system/parts/parts";
import { SystemMap } from "@/desk/system/parts/SystemMap";
import { fmt, plural, useLang, useT } from "@/i18n";
import { system } from "@/i18n/dict/system";
import { rotationRows, rotationSummary } from "@/lib/security-rules";
import { MapSheet } from "@/map/MapSheet";
import { setFailedSource, useFailedSource } from "@/store/actions/system";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { CheckStatus, NodeId, State } from "@/store/types";
import { RuleLine } from "@/ui/RuleLine";
import { Select } from "@/ui/Field";
import { Status } from "@/ui/Status";
import { toast } from "@/ui/Toast";

const AREA_SCREEN: Record<AreaId, ScreenId> = { health: "health", database: "database", payments: "payments", email: "email", security: "security", config: "config", deploys: "deploys", ci: "ci" };
const AREA_ICON: Record<AreaId, LucideIcon> = { health: HeartPulse, database: Database, payments: CreditCard, email: Mail, security: ShieldCheck, config: SlidersHorizontal, deploys: Rocket, ci: GitBranch };
/** Unequal on purpose: three rows of different shapes. */
const AREA_SPAN: Record<AreaId, number> = { health: 5, database: 3, payments: 4, email: 4, security: 3, config: 5, deploys: 7, ci: 5 };

const stripState = (status: CheckStatus): StripCell["state"] => (status === "pass" ? "ok" : status === "warn" ? "warn" : status === "fail" ? "bad" : "off");

function AreaCard({ light, state }: { light: AreaLight; state: State }) {
  const t = useT(system);
  const lang = useLang();
  const Icon = AREA_ICON[light.id];
  const screen = screenById(AREA_SCREEN[light.id]);
  const title = t.area[light.id];
  const unknown = light.tone === "unknown";
  const stat = areaStat(light.id, state, t);
  return (
    <article className="sy-card" data-tone={light.tone} style={{ "--span": AREA_SPAN[light.id] } as React.CSSProperties}>
      <header className="sy-card-head">
        <span className="sy-tile" aria-hidden="true">
          <Icon size={16} />
        </span>
        <h3 className="type-h4">{title}</h3>
        <Status tone={light.tone}>{t.tone[light.tone]}</Status>
      </header>
      {unknown ? null : (
        <p className="sy-card-stat">
          <span className="type-stat">{stat.value}</span>
          <small>{stat.caption}</small>
        </p>
      )}
      {!unknown && stat.cells ? <Strip cells={stat.cells} caption={stat.stripCaption ?? stat.caption} /> : null}
      <p className="sy-card-sentence type-small">{lightText(t, light)}</p>
      <TabLink href={screen.route}>{fmt(t.linkTab, { tab: lang === "de" ? screen.de : screen.en })}</TabLink>
    </article>
  );
}

function areaStat(id: AreaId, s: State, t: (typeof system)["en"]): { value: string | number; caption: string; cells?: StripCell[]; stripCaption?: string } {
  switch (id) {
    case "health": {
      const run = s.healthRuns.find((r) => r.checks.length === 27);
      const pass = run ? countChecks(run.checks).pass : 0;
      return { value: pass, caption: t.overview.stat.health, cells: run?.checks.map((c) => ({ key: c.id, state: stripState(c.status), label: c.id })), stripCaption: t.health.dots };
    }
    case "database": {
      const applied = s.migrations.filter((m) => m.state === "applied").length;
      return { value: applied, caption: fmt(t.overview.stat.database, { n: s.migrations.length }) };
    }
    case "payments": {
      const n = s.holds.filter((h) => h.overdue).length;
      return { value: n, caption: plural(n, t.overview.stat.paymentsOne, t.overview.stat.payments) };
    }
    case "email": {
      const n = s.outbox.filter((m) => m.status === "failed").length;
      return { value: n, caption: plural(n, t.overview.stat.emailOne, t.overview.stat.email) };
    }
    case "security": {
      const day = loginSummary(s.signIns, DEMO_NOW_MS);
      return { value: day.failure + day.pending, caption: t.overview.stat.security };
    }
    case "config": {
      const n = rotationSummary(rotationRows(s.configVars, DEMO_TODAY)).due.length;
      return { value: n, caption: plural(n, t.overview.stat.configOne, t.overview.stat.config) };
    }
    case "deploys": {
      const prod = s.deploys.find((d) => d.target === "production" && d.state === "ready");
      return {
        value: prod?.commit ?? "–",
        caption: t.overview.stat.deploys,
        cells: s.deploys.map((d) => ({ key: d.id, state: d.state === "ready" ? "ok" : d.state === "error" || d.state === "blocked" ? "bad" : "off", label: d.commit })),
        stripCaption: t.deploys.list,
      };
    }
    case "ci": {
      const failing = latestPerWorkflow(s.ciRuns).filter((r) => r.conclusion === "failure").length;
      return {
        value: failing,
        caption: plural(failing, t.overview.stat.ciOne, t.overview.stat.ci),
        cells: s.ciRuns.map((r) => ({ key: r.id, state: r.conclusion === "failure" ? "bad" : r.conclusion === "success" ? "ok" : "off", label: r.workflow })),
        stripCaption: t.ci.runs,
      };
    }
  }
}

function Watchdog({ state }: { state: State }) {
  const t = useT(system);
  const run = state.healthRuns.find((r) => r.source === "watchdog");
  const runs = useMemo(() => state.healthRuns.slice(0, 20), [state.healthRuns]);
  if (!run) {
    return (
      <Panel icon={Timer} title={t.overview.watchdog}>
        <p className="type-body">{t.overview.watchdogNone}</p>
      </Panel>
    );
  }
  const c = countChecks(run.checks);
  const tone = run.overall === "pass" ? "ok" : run.overall === "warn" ? "warn" : "bad";
  return (
    <Panel icon={Timer} title={t.overview.watchdog} aside={<Status tone={tone}>{t.overall[run.overall]}</Status>}>
      <Facts
        items={[
          { label: t.overview.watchdogStarted, value: whenOf(run.startedAt, DEMO_NOW_MS) },
          { label: t.overview.watchdogChecks, value: fmt(t.overview.watchdogCounts, { pass: c.pass, warn: c.warn, fail: c.fail, skip: c.skip }) },
          { label: t.overview.watchdogTarget, value: <span className="type-mono">{run.target ?? t.overview.watchdogLocal}</span>, wide: true },
        ]}
      />
      <div className="mt-4">
        <p className="type-small sy-muted mb-1">{fmt(t.overview.watchdogStrip, { n: runs.length })}</p>
        <Strip cells={runs.map((r) => ({ key: r.id, state: r.overall === "pass" ? "ok" : r.overall === "warn" ? "warn" : "bad", label: t.overall[r.overall] }))} caption={fmt(t.overview.watchdogStrip, { n: runs.length })} />
      </div>
    </Panel>
  );
}

function FailDemo() {
  const t = useT(system);
  const failed = useFailedSource();
  const onChange = (value: string) => {
    const area = value === "" ? null : (value as AreaId);
    setFailedSource(area);
    toast(area ? fmt(t.overview.failToast, { area: t.area[area] }) : t.overview.failClearToast);
  };
  return (
    <Panel icon={Unplug} title={t.overview.failTitle}>
      <div className="sy-fail">
        <p className="type-small sy-intro">{t.overview.failBody}</p>
        <Select label={t.overview.failLabel} value={failed ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t.overview.failNone}</option>
          {(Object.keys(t.area) as AreaId[]).map((area) => (
            <option key={area} value={area}>
              {t.area[area]}
            </option>
          ))}
        </Select>
      </div>
    </Panel>
  );
}

export function SystemScreen() {
  const t = useT(system);
  const lang = useLang();
  const state = useStore((s) => s);
  const lights = useLights();
  const failed = useFailedSource();
  const boxes = useMemo(() => nodeLights(state, DEMO_NOW_MS, failed), [state, failed]);
  const [node, setNode] = useState<NodeId | null>(null);
  const attention = useMemo(() => attentionAreas(lights), [lights]);
  const w = attention.length;
  const title = w === 0 ? t.overview.titleNone : fmt(plural(w, t.overview.titleOne, t.overview.titleOther), { w });
  const mapHref = screenById("map").route;

  return (
    <div className="sy-page">
      <PageHead id="system" title={title} rule={<Intro>{t.overview.intro}</Intro>} />
      <div className="sy-top">
        <div className="sy-stack">
          <section className="sy-panel sy-soft">
            <header className="sy-panel-head">
              <span className="sy-tile" aria-hidden="true">
                <TriangleAlert size={16} />
              </span>
              <h2 className="type-h4">{t.overview.attention}</h2>
            </header>
            {attention.length === 0 ? (
              <p className="type-body">{t.overview.attentionNone}</p>
            ) : (
              <ol className="sy-attn-list">
                {attention.map((a) => {
                  const screen = screenById(AREA_SCREEN[a.id]);
                  return (
                    <li key={a.id} className="sy-attn-row">
                      <span className="sy-attn-status">
                        <Status tone={a.tone}>{t.tone[a.tone]}</Status>
                      </span>
                      <span className="sy-attn-text">
                        <span className="type-label">{t.area[a.id]}</span>
                        <span className="type-small sy-muted">{lightText(t, a)}</span>
                      </span>
                      <span className="sy-attn-open">
                        <TabLink href={screen.route}>{fmt(t.linkTab, { tab: lang === "de" ? screen.de : screen.en })}</TabLink>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <Watchdog state={state} />
          <FailDemo />
        </div>
        <section className="sy-mapcard" aria-label={t.overview.mapTitle}>
          <header className="sy-mapcard-head">
            <h2 className="type-h4">{t.overview.mapTitle}</h2>
            <TabLink href={mapHref}>{t.overview.mapOpen}</TabLink>
          </header>
          <div className="sy-mapcard-field">
            <SystemMap scope="sy-map-medium" mode="phone" onNode={setNode} />
          </div>
          <p className="sy-mapcard-foot type-small">{t.overview.mapHint}</p>
        </section>
      </div>
      <RuleLine>{t.overview.honest}</RuleLine>
      <section aria-label={t.overview.areas}>
        <h2 className="type-h3 mb-3">{t.overview.areas}</h2>
        <div className="sy-areas">
          {lights.map((light) => (
            <AreaCard key={light.id} light={light} state={state} />
          ))}
        </div>
      </section>
      <MapSheet node={node} live={node ? nodeStatus(t, boxes[node]) : undefined} onClose={() => setNode(null)} />
    </div>
  );
}

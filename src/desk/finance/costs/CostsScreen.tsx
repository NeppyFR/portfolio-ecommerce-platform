"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronRight, ListChecks, Plus, TriangleAlert } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { DEMO_MONTH } from "@/store/clock";
import { fmt, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { formatChf } from "@/lib/format";
import { runningPerMonth } from "@/lib/running-costs";
import { useStore } from "@/store/core";
import { monthlyRunningCost } from "@/store/selectors";
import type { Cost } from "@/store/types";
import { Button, Empty, RuleLine } from "@/ui";
import { cashOnHand, draftPlanId, findPlan, isStoragePlan, measureStorage, normaliseDraft, plannerTotals, rowCost, runway, savedUsage, scenarioUsage, toRappen, type PlanDraft, type UsageScenario } from "../rules/planner";
import { DebouncedLive, Tick, useCostLabel } from "../shared";
import { setParam } from "@/lib/routes";
import { CostsSheet, PricesSheet } from "./CostSheets";
import { DueList } from "./DueList";
import { PlanRow } from "./PlanRow";
import { StorageCard } from "./StorageCard";
import { TwelveMonths } from "./TwelveMonths";

const SEGMENT_COLOURS = ["#2f6bff", "#6fd3ff", "#8c7bff", "#b9f3ff", "#7ea4ff", "#c9c0ff", "#4f7fe8", "#9aa3b5"];

export function CostsScreen() {
  const costLabel = useCostLabel();
  const dict = useT(finance);
  const t = dict.costs;
  const params = useSearchParams();
  const open = params.get("open");
  const month = params.get("month") && /^\d{4}-\d{2}$/.test(params.get("month") as string) ? (params.get("month") as string) : DEMO_MONTH;

  const costs = useStore((s) => s.costs);
  const plans = useStore((s) => s.pricePlans);
  const fx = useStore((s) => s.fxRates);
  const files = useStore((s) => s.files);
  const ledger = useStore((s) => s.ledger);
  const bookings = useStore((s) => s.costBookings);
  const accounts = useStore((s) => s.accounts);
  const running = useStore(monthlyRunningCost);

  const measure = useMemo(() => measureStorage(files, ledger, DEMO_MONTH), [files, ledger]);
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["cost_app", "cost_db"]));
  const [focusPlan, setFocusPlan] = useState<string | null>(null);
  const [scenario, setScenario] = useState<UsageScenario | null>(null);
  const [gliding, setGliding] = useState(false);
  const dirtyCount = Object.keys(drafts).length;

  const totals = useMemo(() => plannerTotals(costs, plans, fx, drafts, measure, DEMO_MONTH), [costs, plans, fx, drafts, measure]);

  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const patchDraft = useCallback(
    (cost: Cost, patch: PlanDraft) => {
      setDrafts((all) => {
        const merged: PlanDraft = { ...(all[cost.id] ?? {}), ...patch };
        const normal = normaliseDraft(cost, plans, merged);
        const next = { ...all };
        if (normal) next[cost.id] = merged;
        else delete next[cost.id];
        return next;
      });
    },
    [plans],
  );
  const dropDraft = useCallback((id: string) => {
    setDrafts((all) => {
      if (!(id in all)) return all;
      const next = { ...all };
      delete next[id];
      return next;
    });
  }, []);
  const toggle = (id: string) =>
    setExpanded((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearFocus = useCallback(() => setFocusPlan(null), []);

  /* A slider that jumps across the rail glides for longer than one that steps. */
  useEffect(() => {
    if (!gliding) return;
    const timer = window.setTimeout(() => setGliding(false), 460);
    return () => window.clearTimeout(timer);
  }, [gliding]);

  const applyScenario = (next: UsageScenario) => {
    setScenario(next);
    setGliding(true);
    for (const cost of costs) {
      const draft = drafts[cost.id];
      const plan = findPlan(plans, draftPlanId(cost, draft));
      if (!plan || cost.billing === "yearly" || (draft?.state ?? cost.state) === "off") continue;
      patchDraft(cost, { usage: scenarioUsage(plan, next, draft?.usage ?? savedUsage(plan, cost)) });
    }
  };

  const onRows = costs.filter((c) => c.state !== "off");
  const offRows = costs.filter((c) => c.state === "off");

  /* The share bar: every cost that counts towards the plans, in CHF a month. */
  const segments = useMemo(() => {
    const rows = costs
      .filter((c) => (drafts[c.id]?.state ?? c.state) !== "off")
      .map((cost) => {
        const row = rowCost(cost, plans, measure, drafts[cost.id]);
        const rappen = toRappen(row.minor, row.currency, fx) ?? 0;
        return { id: cost.id, label: cost.label, month: row.yearly ? rappen / 12 : rappen };
      })
      .filter((row) => row.month > 0);
    return rows;
  }, [costs, plans, fx, drafts, measure]);
  const barScale = Math.max(1, totals.plansMonth, totals.nowMonth, segments.reduce((sum, s) => sum + s.month, 0));

  const diff = totals.plansMonth - totals.nowMonth;
  const nowPosition = (totals.nowMonth / barScale) * 100;

  const unchecked = fx.some((r) => r.asOf === null);
  const perMonth = runningPerMonth(costs, bookings, DEMO_MONTH);
  const cash = cashOnHand(accounts, ledger);
  const months = runway(cash, perMonth);
  const carrier = costs.find((c) => c.state !== "off" && isStoragePlan(findPlan(plans, c.planId))) ?? costs.find((c) => isStoragePlan(findPlan(plans, drafts[c.id]?.planId ?? c.planId)));

  const onCreated = (cost: Cost) => {
    setExpanded((all) => new Set(all).add(cost.id));
    setFocusPlan(cost.id);
  };

  const row = (cost: Cost) => (
    <PlanRow
      key={cost.id}
      cost={cost}
      plans={plans}
      costs={costs}
      fx={fx}
      measure={measure}
      draft={drafts[cost.id]}
      expanded={expanded.has(cost.id)}
      focusPlan={focusPlan === cost.id}
      onToggle={() => toggle(cost.id)}
      onDraft={(patch) => {
        setScenario(null);
        patchDraft(cost, patch);
      }}
      onReset={() => {
        setScenario(null);
        dropDraft(cost.id);
      }}
      onSaved={() => {
        setScenario(null);
        dropDraft(cost.id);
      }}
      onFocused={clearFocus}
    />
  );

  return (
    <div className="fin-cq" data-gliding={gliding || undefined}>
      <PageHead
        id="costs"
        title={fmt(t.title, { chf: formatChf(running) })}
        rule={<RuleLine>{t.rule}</RuleLine>}
        actions={
          <>
            <Button variant="outline" onClick={() => setParam("open", "costs")}>
              <ListChecks size={15} aria-hidden="true" />
              {t.costsButton}
            </Button>
            <Button variant="outline" onClick={() => setParam("open", "prices")}>
              {t.pricesButton}
            </Button>
          </>
        }
      />

      <div className="fin-shell" data-costs="true">
        <aside className="fin-a fin-glow" aria-label={t.subscriptions}>
          <div>
            <h2 className="fin-h">{t.subscriptions}</h2>
            <div className="fin-total mt-3">
              <span className="fin-total-k">{t.expectedNow}</span>
              <span className="fin-total-v">
                <Tick>{formatChf(totals.nowMonth)}</Tick>
              </span>
              <span className="fin-total-s">{fmt(t.aMonth, { amount: formatChf(totals.nowYear) })}</span>
            </div>
            <div className="fin-total" data-changed={diff !== 0 || undefined}>
              <span className="fin-total-k">{t.expectedPlans}</span>
              <span className="fin-total-v">
                <Tick>{formatChf(totals.plansMonth)}</Tick>
              </span>
              <span className="fin-total-s">{fmt(t.aMonth, { amount: formatChf(totals.plansYear) })}</span>
              <span className="fin-total-d" data-dir={diff > 0 ? "up" : diff < 0 ? "down" : undefined}>
                {diff > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : diff < 0 ? <ArrowDownRight size={14} aria-hidden="true" /> : null}
                <Tick>{diff === 0 ? t.diffSame : fmt(diff > 0 ? t.diffUp : t.diffDown, { amount: formatChf(Math.abs(diff)) })}</Tick>
              </span>
            </div>

            <div className="fin-bar" role="img" aria-label={t.stackLabel}>
              {segments.reduce<{ left: number; nodes: ReactNode[] }>(
                (acc, segment, i) => {
                  const share = segment.month / barScale;
                  acc.nodes.push(<i key={segment.id} style={{ background: SEGMENT_COLOURS[i % SEGMENT_COLOURS.length], transform: `translateX(${acc.left * 100}%) scaleX(${share})` }} />);
                  acc.left += share;
                  return acc;
                },
                { left: 0, nodes: [] },
              ).nodes}
            </div>
            <div className="fin-bar-now" aria-hidden="true">
              <span style={{ transform: `translateX(${Math.min(100, nowPosition)}%)` } as CSSProperties}>
                <em style={{ display: "inline-flex", transform: `translateX(${-Math.min(100, nowPosition)}%)` }}>{t.nowMark}</em>
              </span>
            </div>
            <div className="fin-legend">
              {segments.map((segment, i) => (
                <FragmentRow key={segment.id} colour={SEGMENT_COLOURS[i % SEGMENT_COLOURS.length]} label={costLabel(segment.label)} value={formatChf(Math.round(segment.month))} />
              ))}
            </div>

            <div className="fin-row mt-3">
              <span className="fin-chip" data-tone={dirtyCount ? "warn" : "plain"}>
                {dirtyCount ? fmt(t.notSavedN, { n: dirtyCount }) : t.allSaved}
              </span>
              {dirtyCount ? (
                <button
                  type="button"
                  className="fin-reset"
                  onClick={() => {
                    setScenario(null);
                    setGliding(true);
                    setDrafts({});
                  }}
                >
                  {t.resetAll}
                </button>
              ) : null}
              {unchecked ? (
                <span className="fin-chip fin-wrap" data-tone="warn">
                  <TriangleAlert size={13} aria-hidden="true" />
                  {t.fxUnchecked}
                </span>
              ) : null}
            </div>
            <p className="fin-note mt-2">{t.fromExpected}</p>
          </div>
        </aside>

        <section className="fin-b" aria-label={t.planHeading}>
          <div className="fin-between">
            <h2 className="fin-h3">{t.planHeading}</h2>
            <Button variant="outline" onClick={() => setParam("open", "new")}>
              <Plus size={15} aria-hidden="true" />
              {t.addSubscription}
            </Button>
          </div>
          <p className="fin-note mt-1">{t.planIntro}</p>

          <div className="fin-scen mt-3" role="group" aria-label={t.scenarioLabel}>
            <span className="fin-scen-k">{t.scenarioLabel}</span>
            {(
              [
                ["quiet", t.scenarioQuiet],
                ["busy", t.scenarioBusy],
                ["peak", t.scenarioPeak],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className="fin-scen-b" aria-pressed={scenario === key} onClick={() => applyScenario(key)}>
                {label}
              </button>
            ))}
            <span className="fin-scen-hint">{t.scenarioHint}</span>
          </div>

          {carrier ? (
            <div className="mt-3">
              <StorageCard carrier={carrier} plans={plans} fx={fx} measure={measure} draft={drafts[carrier.id]} />
            </div>
          ) : null}

          <div className="mt-2">
            {onRows.length === 0 ? <Empty>{t.empty}</Empty> : onRows.map(row)}
            {offRows.length ? (
              <details className="fin-more mt-2">
                <summary>
                  <ChevronRight size={14} aria-hidden="true" />
                  {fmt(t.switchedOff, { n: offRows.length })}
                </summary>
                <div>{offRows.map(row)}</div>
              </details>
            ) : null}
          </div>

          <div className="fin-stack mt-3" style={{ gap: 6 }}>
            {totals.missingCurrencies.length ? <p className="fin-note fin-amber">{fmt(t.noRate, { currencies: totals.missingCurrencies.join(", ") })}</p> : null}
            {totals.freeLabels.length ? <p className="fin-note">{fmt(t.countedFree, { labels: totals.freeLabels.join(", ") })}</p> : null}
            <p className="fin-note">{t.plannerNote}</p>
            <p className="fin-note fin-faint">{t.listPrices}</p>
          </div>

          <div className="fin-live" aria-hidden="true">
            <span className="type-small">{t.expectedPlans}</span>
            <span className="fin-row" style={{ flexWrap: "nowrap" }}>
              {diff !== 0 ? <span className={`type-mono-s ${diff > 0 ? "fin-up" : ""}`}>{`${diff > 0 ? "+" : "−"}${formatChf(Math.abs(diff))}`}</span> : null}
              <b>
                <Tick>{formatChf(totals.plansMonth)}</Tick>
              </b>
            </span>
          </div>
        </section>

        <aside className="fin-c" aria-label={t.bookedTruth}>
          <h2 className="fin-h">{t.bookedTruth}</h2>
          <ul className="fin-truth">
            <li>
              <b>{perMonth === null ? "–" : formatChf(perMonth)}</b>
              <span>{t.runningPerMonth}</span>
              <small>{perMonth === null ? t.runningNone : t.runningSub}</small>
            </li>
            <li>
              <b>{formatChf(cash)}</b>
              <span>{t.cash}</span>
              <small>{t.cashSub}</small>
            </li>
            <li>
              <b>{months === null ? "–" : fmt(months === 1 ? dict.shared.month1 : dict.shared.months, { n: months })}</b>
              <span>{t.runway}</span>
              <small>{t.runningPerMonth}</small>
            </li>
          </ul>
          <DueList month={month} onMonth={(next) => setParam("month", next)} />
        </aside>
      </div>

      <TwelveMonths selected={month} />

      <DebouncedLive text={fmt(t.announce, { now: formatChf(totals.nowMonth), plans: formatChf(totals.plansMonth) })} />

      <CostsSheet open={open === "prices" ? null : open} onOpen={(value) => setParam("open", value)} onClose={() => setParam("open", null)} onCreated={onCreated} />
      <PricesSheet open={open === "prices"} onClose={() => setParam("open", null)} />
    </div>
  );
}

function FragmentRow({ colour, label, value }: { colour: string; label: string; value: string }) {
  return (
    <>
      <span>
        <u style={{ background: colour }} />
        {label}
      </span>
      <span>{value}</span>
    </>
  );
}

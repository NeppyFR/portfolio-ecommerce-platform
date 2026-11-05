"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Download, TriangleAlert } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { DEMO_NOW_MS, DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { LABEL } from "@/lib/brand";
import { downloadText } from "@/lib/download";
import { dayKey, formatChf, formatDate } from "@/lib/format";
import { colourLabel } from "@/desk/commerce/orders/rules/order-rules";
import { sizeLabel } from "@/lib/product-rules";
import { BOOKS_START_YEAR, confirmCount, discardCount, reopenCount, saveCountLines, startCount, type LinePatch } from "@/store/actions/finance";
import { identityOf } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import type { StockCount, StockCountLine } from "@/store/types";
import { Button, Checkbox, Dialog, Empty, Input, RuleLine, Textarea, toast } from "@/ui";
import { canConfirmYet, canDiscardDraft, countableYear, countTotals, expectedOnShelf, lineOrder, lineSums, liveFigures, parseCounted, parseTypedCost, stockCountCsv, withCounted, type LineFigures, type LiveFigures } from "../rules/stock-count";
import { useFinanceAccess } from "../shared";
import { setParam } from "@/lib/routes";

type Edit = { counted?: string; cost?: string };
type Row = { saved: StockCountLine; line: StockCountLine; figures: LineFigures; countedText: string; costText: string; countedBad: boolean; costBad: boolean; changed: boolean; toShip: number; moved: number | null; faint: boolean };

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const moneyText = (r: number | null) => (r === null ? "" : (r / 100).toFixed(2));

/** A line with its unsaved edits applied, so totals and year-end figures move while typing. */
function deriveRow(saved: StockCountLine, edit: Edit | undefined, live: Map<string, LiveFigures>): Row {
  let line = saved;
  let countedBad = false;
  let costBad = false;
  if (edit?.counted !== undefined) {
    const parsed = parseCounted(edit.counted);
    if (parsed.ok) line = parsed.value === saved.counted ? line : withCounted(line, parsed.value, live);
    else countedBad = true;
  }
  if (edit?.cost !== undefined) {
    const parsed = parseTypedCost(edit.cost);
    if (parsed.ok) line = { ...line, typedCostRappen: parsed.value };
    else costBad = true;
  }
  const figures = lineSums(line);
  const liveRow = line.variantId ? live.get(line.variantId) : undefined;
  const faint = line.counted === null;
  const countedChanged = edit?.counted !== undefined && edit.counted.trim() !== (saved.counted === null ? "" : String(saved.counted));
  const costChanged = edit?.cost !== undefined && edit.cost.trim() !== moneyText(saved.typedCostRappen);
  return {
    saved, line, figures, countedBad, costBad, changed: countedChanged || costChanged, faint,
    countedText: edit?.counted ?? (saved.counted === null ? "" : String(saved.counted)),
    costText: edit?.cost ?? moneyText(saved.typedCostRappen),
    toShip: faint ? liveRow?.toShip ?? 0 : line.toShip,
    moved: faint ? (liveRow ? liveRow.stock - line.systemQty : 0) : figures.moved,
  };
}

export function StockCountScreen() {
  const dict = useT(finance);
  const t = dict.stock;
  const lang = useLang();
  const params = useSearchParams();
  const counts = useStore((s) => s.stockCounts);
  const { canCount, isSuper } = useFinanceAccess();

  const countable = countableYear(DEMO_TODAY, BOOKS_START_YEAR);
  const asked = Number(params.get("year"));
  const years = useMemo(() => [...new Set([...(countable ? [countable] : []), ...counts.map((c) => c.year)])].sort((a, b) => b - a), [countable, counts]);
  const year = years.includes(asked) ? asked : countable ?? years[0];
  const count = counts.find((c) => c.year === year) ?? null;
  const savedTotals = count ? countTotals(count.lines) : null;
  const percent = count?.status === "confirmed" ? 100 : savedTotals && savedTotals.totalLines > 0 ? Math.round((savedTotals.countedLines / savedTotals.totalLines) * 100) : 0;

  if (!canCount) {
    return (
      <div className="fin-cq">
        <PageHead id="stockcount" title={t.titleRestricted} />
        <p className="fin-note mt-3" style={{ maxWidth: 640 }}>{t.intro}</p>
        <div className="fin-banner">{t.restricted}</div>
      </div>
    );
  }

  return (
    <div className="fin-cq">
      <PageHead id="stockcount" title={count ? fmt(t.title, { y: year, p: percent }) : t.titleNone} rule={<RuleLine>{t.rule}</RuleLine>} />
      <p className="fin-note mt-3" style={{ maxWidth: 760 }}>{t.intro}</p>

      {years.length > 1 ? (
        <nav className="fin-years" aria-label={t.counts}>
          {years.map((y) => {
            const c = counts.find((x) => x.year === y);
            const label = fmt(c ? (c.status === "draft" ? t.chipDraft : t.chipConfirmed) : t.chipNotStarted, { year: y });
            return (
              <button key={y} type="button" className="fin-year" aria-current={y === year ? "true" : undefined} onClick={() => setParam("year", String(y))}>
                {label}
              </button>
            );
          })}
        </nav>
      ) : null}

      <p className="fin-help">{t.help}</p>

      {count ? (
        <CountView key={`${count.year}-${count.status}`} count={count} isSuper={isSuper} lang={lang} />
      ) : (
        <section className="fin-card mt-4">
          <p className="type-body" style={{ maxWidth: 640 }}>{fmt(t.startBody, { year })}</p>
          <Button
            className="mt-3"
            onClick={() => {
              const result = startCount(year);
              if (result.ok) toast(fmt(t.started, { year, n: result.data }));
            }}
          >
            {fmt(t.start, { year })}
          </Button>
        </section>
      )}
    </div>
  );
}

function CountView({ count, isSuper, lang }: { count: StockCount; isSuper: boolean; lang: "en" | "de" }) {
  const dict = useT(finance);
  const t = dict.stock;
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const draft = count.status === "draft";
  const year = count.year;

  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [query, setQuery] = useState("");
  const [uncountedOnly, setUncountedOnly] = useState(false);
  const [jumpMiss, setJumpMiss] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [dialog, setDialog] = useState<"confirm" | "discard" | "reopen" | null>(null);
  const [typedYear, setTypedYear] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => liveFigures(products, orders), [products, orders]);
  const german = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) for (const v of p.variants) map.set(v.id, p.nameDe);
    return map;
  }, [products]);
  const nameOf = (line: StockCountLine) => (lang === "de" && line.variantId ? german.get(line.variantId) ?? line.productName : line.productName);

  const rows = useMemo(() => count.lines.slice().sort(lineOrder).map((line) => deriveRow(line, draft ? edits[line.id] : undefined, live)), [count.lines, edits, live, draft]);
  const liveTotals = useMemo(() => countTotals(rows.map((r) => r.line)), [rows]);
  const savedTotals = useMemo(() => countTotals(count.lines), [count.lines]);
  const changed = rows.filter((r) => r.changed);
  const bad = rows.some((r) => r.countedBad || r.costBad);
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (uncountedOnly && r.line.counted !== null) return false;
    if (!needle) return true;
    return `${r.line.sku} ${nameOf(r.line)} ${r.line.color}`.toLowerCase().includes(needle);
  });

  const patch = (id: string, next: Edit) => setEdits((all) => ({ ...all, [id]: { ...all[id], ...next } }));

  const focusLine = (id: string) => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>(`[data-count-line="${id}"]`)];
    const target = inputs.find((el) => el.offsetParent !== null);
    if (!target) return;
    target.focus();
    target.select();
    target.scrollIntoView({ block: "center" });
  };
  const jump = () => {
    const sku = query.trim();
    if (!sku) return;
    const exact = rows.find((r) => r.line.sku.toLowerCase() === sku.toLowerCase());
    const hit = exact ?? (shown.length === 1 ? shown[0] : null);
    if (!hit) {
      setJumpMiss(fmt(t.noSku, { sku }));
      return;
    }
    setJumpMiss(null);
    setQuery("");
    window.requestAnimationFrame(() => focusLine(hit.line.id));
  };
  const backToSearch = () => searchRef.current?.querySelector("input")?.focus();

  const fill = () => {
    const open = rows.filter((r) => r.saved.counted === null && edits[r.saved.id]?.counted === undefined);
    if (open.length === 0) {
      toast(t.allCounted);
      return;
    }
    setEdits((all) => {
      const next = { ...all };
      for (const r of open) next[r.saved.id] = { ...next[r.saved.id], counted: String(expectedOnShelf(r.saved, live)) };
      return next;
    });
    toast(fmt(t.filled, { n: open.length }));
  };

  const save = () => {
    const patches: LinePatch[] = changed.map((r) => ({ id: r.line.id, counted: r.line.counted, toShip: r.line.toShip, stockAtCount: r.line.stockAtCount, typedCostRappen: r.line.typedCostRappen }));
    const result = saveCountLines(year, patches);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    setEdits({});
    toast(t.saved);
  };

  const canConfirmTime = canConfirmYet(year, DEMO_NOW_MS);
  const blocked = !canConfirmTime ? fmt(t.confirmFrom, { year: year + 1 }) : dirty ? t.saveFirst : savedTotals.uncountedLines > 0 ? (savedTotals.uncountedLines === 1 ? t.notCountedOne : fmt(t.notCounted, { n: savedTotals.uncountedLines })) : savedTotals.negativeLines > 0 ? (savedTotals.negativeLines === 1 ? t.negativeOne : fmt(t.negative, { n: savedTotals.negativeLines })) : null;
  const discardable = canDiscardDraft(year, DEMO_TODAY, BOOKS_START_YEAR);

  const runConfirm = () => {
    const result = confirmCount(year, typedYear);
    if (result.ok) {
      setDialog(null);
      toast(fmt(t.confirmed, { year, pieces: result.data.pieces, value: formatChf(result.data.valueRappen) }));
      return;
    }
    const messages: Record<string, string> = { wrong_year: fmt(t.errWrongYear, { year }), before_cutoff: t.errBefore, missing_sizes: t.errMissing, uncounted: t.errUncounted, negative: t.errNegative };
    if (result.code === "missing_sizes") {
      setShowMissing(true);
      setDialog(null);
      toast(t.errMissing);
      return;
    }
    setConfirmError(messages[result.code] ?? result.message);
  };

  const sizeLine = (line: StockCountLine) => `${[sizeLabel(line.size, lang), colourLabel(line.color, lang), line.sku].filter(Boolean).join(" · ")}${line.sizeDeleted ? t.sizeDeleted : ""}`;
  const startedBy = identityOf(count.startedBy).name;
  const confirmedBy = count.confirmedBy ? identityOf(count.confirmedBy).name : "";

  const countedField = (r: Row) => (
    <input
      className="fin-qty"
      inputMode="numeric"
      data-count-line={r.line.id}
      data-changed={r.changed || undefined}
      aria-label={fmt(t.countedAria, { sku: r.line.sku })}
      aria-invalid={r.countedBad || undefined}
      title={r.countedBad ? t.countedInvalid : undefined}
      value={r.countedText}
      onChange={(e) => patch(r.saved.id, { counted: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          backToSearch();
        }
      }}
    />
  );
  const costCell = (r: Row) => {
    if (draft && r.line.productCostRappen === null) {
      return (
        <input
          className="fin-qty fin-cost-in"
          inputMode="decimal"
          aria-label={fmt(t.costAria, { sku: r.line.sku })}
          aria-invalid={r.costBad || undefined}
          title={r.costBad ? t.costInvalid : undefined}
          placeholder={t.costPlaceholder}
          value={r.costText}
          onChange={(e) => patch(r.saved.id, { cost: e.target.value })}
        />
      );
    }
    if (r.figures.unit === null) return <span className="fin-amber">{t.unknown}</span>;
    return (
      <span title={r.line.productCostRappen !== null ? t.fromProduct : t.typedIn}>
        {formatChf(r.figures.unit, { symbol: false })}
      </span>
    );
  };
  const valueCell = (r: Row) => (r.figures.yearEnd === null ? "–" : r.figures.value === null ? <span className="fin-amber">{t.unknown}</span> : formatChf(r.figures.value, { symbol: false }));
  const yearEndCell = (r: Row) =>
    r.figures.yearEnd === null ? (
      "–"
    ) : r.figures.yearEnd < 0 ? (
      <span className="fin-rose">
        {signed(r.figures.yearEnd)}
        <span className="sr-only"> {t.belowZero}</span>
      </span>
    ) : (
      r.figures.yearEnd
    );

  return (
    <>
      <p className="fin-note mt-3">
        {draft
          ? fmt(t.statusDraft, { date: formatDate(count.startedOn), name: startedBy })
          : fmt(t.statusConfirmed, { date: count.confirmedAt ? formatDate(dayKey(count.confirmedAt)) : "", name: confirmedBy })}
      </p>

      <div className="fin-count-head">
        <div className="fin-glow">
          <span className="fin-total-k">{t.totalLabel}</span>
          <span className="fin-big">{formatChf(liveTotals.valueRappen)}</span>
          <span className="fin-total-s">
            {fmt(t.piecesCost, { n: liveTotals.valuedPieces })}
            {draft ? t.soFar : ""}
          </span>
        </div>
        <div className="fin-count-prog">
          <b className="type-label">{fmt(t.progress, { counted: savedTotals.countedLines, total: savedTotals.totalLines })}</b>
          <div className="fin-progress" aria-hidden="true">
            <i style={{ transform: `scaleX(${savedTotals.totalLines ? savedTotals.countedLines / savedTotals.totalLines : 0})` }} />
          </div>
          {liveTotals.unknownCostPieces > 0 ? <p className="fin-note fin-amber">{fmt(liveTotals.unknownCostLines === 1 ? t.unknownCostOne : t.unknownCost, { pieces: liveTotals.unknownCostPieces, lines: liveTotals.unknownCostLines })}</p> : null}
          {liveTotals.negativeLines > 0 ? <p className="fin-note fin-rose">{liveTotals.negativeLines === 1 ? t.negativeOne : fmt(t.negative, { n: liveTotals.negativeLines })}</p> : null}
        </div>
      </div>

      {showMissing && draft ? (
        <div className="fin-banner">
          <span>{t.missingBanner}</span>
          <Button
            variant="outline"
            onClick={() => {
              const result = startCount(year);
              setShowMissing(false);
              if (result.ok) toast(fmt(t.missingAdded, { n: result.data }));
            }}
          >
            {t.addMissing}
          </Button>
        </div>
      ) : null}

      <div className="fin-tools">
        <div className="fin-tools-search" ref={searchRef}>
          <Input
            type="search"
            label={t.search}
            title={t.searchTitle}
            value={query}
            error={jumpMiss}
            onChange={(e) => {
              setQuery(e.target.value);
              setJumpMiss(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                jump();
              }
            }}
          />
        </div>
        <Checkbox label={fmt(t.uncountedOnly, { n: liveTotals.uncountedLines })} checked={uncountedOnly} onChange={(e) => setUncountedOnly(e.target.checked)} />
        {draft ? (
          <Button variant="outline" onClick={fill}>
            {t.fill}
          </Button>
        ) : (
          <p className="fin-note">{t.frozen}</p>
        )}
      </div>
      {draft ? <p className="fin-note fin-faint mt-2">{t.fillHint}</p> : null}

      {count.lines.length === 0 ? (
        <Empty>{t.noLines}</Empty>
      ) : shown.length === 0 ? (
        <Empty>{t.noMatch}</Empty>
      ) : (
        <>
          <div className="fin-count-wide">
            <table className="fin-ct">
              <caption className="sr-only">{t.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.colProduct}</th>
                  <th scope="col">{t.colSystem}</th>
                  <th scope="col">{t.colCounted}</th>
                  <th scope="col">{t.colToShip}</th>
                  <th scope="col">{t.colMoved}</th>
                  <th scope="col">{t.colYearEnd}</th>
                  <th scope="col">{t.colDiff}</th>
                  <th scope="col">{t.colCost}</th>
                  <th scope="col">{t.colValue}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line.id} data-low={r.figures.yearEnd !== null && r.figures.yearEnd < 0 ? true : undefined}>
                    <td>
                      {nameOf(r.line)}
                      <small>{sizeLine(r.line)}</small>
                    </td>
                    <td>{r.line.systemQty}</td>
                    <td>{draft ? countedField(r) : r.line.counted ?? "–"}</td>
                    <td data-faint={r.faint || undefined}>{r.toShip}</td>
                    <td data-faint={r.faint || undefined}>{r.moved === null ? "–" : signed(r.moved)}</td>
                    <td style={{ fontWeight: 700 }}>{yearEndCell(r)}</td>
                    <td>{r.figures.difference === null ? "–" : signed(r.figures.difference)}</td>
                    <td>{costCell(r)}</td>
                    <td>{valueCell(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="fin-count-cards">
            {shown.map((r) => (
              <li key={r.line.id} className="fin-cc" data-low={r.figures.yearEnd !== null && r.figures.yearEnd < 0 ? true : undefined}>
                <div className="fin-cc-top">
                  <div className="min-w-0">
                    <b>{nameOf(r.line)}</b>
                    <small>{sizeLine(r.line)}</small>
                  </div>
                  {draft ? countedField(r) : <b className="type-stat">{r.line.counted ?? "–"}</b>}
                </div>
                <div className="fin-cc-grid">
                  <div>
                    <span>{t.colSystem}</span>
                    {r.line.systemQty}
                  </div>
                  <div>
                    <span>{t.colToShip}</span>
                    {r.toShip}
                  </div>
                  <div>
                    <span>{t.colMoved}</span>
                    {r.moved === null ? "–" : signed(r.moved)}
                  </div>
                  <div>
                    <span>{t.colYearEnd}</span>
                    <b>{yearEndCell(r)}</b>
                  </div>
                  <div>
                    <span>{t.colDiff}</span>
                    {r.figures.difference === null ? "–" : signed(r.figures.difference)}
                  </div>
                  <div>
                    <span>{t.colValue}</span>
                    {valueCell(r)}
                  </div>
                </div>
                <div className="fin-cc-cost">
                  <span className="type-small">{t.colCost}</span>
                  {costCell(r)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {draft && dirty ? (
        <div className="fin-savebar">
          <span className={bad ? "fin-rose type-label" : "type-label"}>{bad ? t.fixMarked : changed.length === 1 ? t.changedOne : fmt(t.changedMany, { n: changed.length })}</span>
          <span className="fin-row">
            <Button variant="ghost" onClick={() => setEdits({})}>
              {t.undo}
            </Button>
            <Button disabled={bad} onClick={save}>
              {changed.length === 1 ? t.saveOne : fmt(t.saveMany, { n: changed.length })}
            </Button>
          </span>
        </div>
      ) : null}

      <div className="fin-foot">
        {draft ? (
          <>
            <Button
              disabled={blocked !== null}
              onClick={() => {
                setTypedYear("");
                setConfirmError(null);
                setDialog("confirm");
              }}
            >
              <CircleCheck size={15} aria-hidden="true" />
              {t.confirm}
            </Button>
            {blocked ? (
              <p className="fin-note fin-row" style={{ flexWrap: "nowrap", gap: 6, alignItems: "flex-start" }}>
                <TriangleAlert size={14} style={{ flex: "none", marginTop: 2, color: "var(--amber)" }} aria-hidden="true" />
                {blocked}
              </p>
            ) : null}
            {discardable ? (
              <Button variant="ghost" className="ml-auto" onClick={() => setDialog("discard")}>
                {t.discard}
              </Button>
            ) : (
              <p className="fin-note ml-auto">{fmt(t.keptDraft, { year })}</p>
            )}
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => {
                const name = `${LABEL.name.toLowerCase()}-stock-count-${year}.csv`;
                downloadText(name, stockCountCsv(count), "text/csv;charset=utf-8");
                toast(fmt(dict.shared.csvDone, { name }));
              }}
            >
              <Download size={15} aria-hidden="true" />
              {dict.shared.downloadCsv}
            </Button>
            {isSuper ? (
              <Button
                variant="danger"
                onClick={() => {
                  setReason("");
                  setReasonError(false);
                  setDialog("reopen");
                }}
              >
                {t.reopen}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={dialog === "confirm"} onClose={() => setDialog(null)} title={fmt(t.confirmTitle, { year })} confirmLabel={dict.stock.confirm} confirmDisabled={typedYear.trim() !== String(year)} onConfirm={runConfirm}>
        <div className="fin-stack">
          <p>{fmt(t.confirmBody, { pieces: savedTotals.pieces, value: formatChf(savedTotals.valueRappen), year })}</p>
          {savedTotals.unknownCostPieces > 0 ? <p className="fin-note fin-amber">{fmt(t.confirmWarn, { pieces: savedTotals.unknownCostPieces })}</p> : null}
          <Input label={fmt(t.confirmType, { year })} inputMode="numeric" value={typedYear} error={confirmError} onChange={(e) => setTypedYear(e.target.value)} />
        </div>
      </Dialog>
      <Dialog
        open={dialog === "discard"}
        onClose={() => setDialog(null)}
        title={fmt(t.discardTitle, { year })}
        danger
        confirmLabel={t.discard}
        onConfirm={() => {
          const result = discardCount(year);
          setDialog(null);
          if (result.ok) toast(t.discarded);
        }}
      >
        <p>{t.discardBody}</p>
      </Dialog>
      <Dialog
        open={dialog === "reopen"}
        onClose={() => setDialog(null)}
        title={fmt(t.reopenTitle, { year })}
        danger
        confirmLabel={t.reopen}
        onConfirm={() => {
          const result = reopenCount(year, reason);
          if (!result.ok) {
            setReasonError(true);
            return;
          }
          setDialog(null);
          toast(fmt(t.reopened, { year }));
        }}
      >
        <div className="fin-stack">
          <p>{t.reopenBody}</p>
          <Textarea label={t.reason} rows={2} maxLength={200} value={reason} error={reasonError ? t.errReason : null} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </>
  );
}


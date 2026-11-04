"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, TriangleAlert } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { LABEL } from "@/lib/brand";
import { downloadText } from "@/lib/download";
import { formatChf, formatDate, dayKey } from "@/lib/format";
import { vatRatePercent } from "@/lib/vat";
import { setVatEnabled } from "@/store/actions/finance";
import { useStore } from "@/store/core";
import { BarList, Button, Dialog, Status, Switch, toast } from "@/ui";
import { refundRows, refundsIn, summariseRefunds } from "../rules/refunds";
import { columnHead, defaultPeriod, financeCsv, isPeriod, periodLabel, periodOptions, reportTable, showsYearEnd, vatSummary, yearOfPeriod, type ReportRow } from "../rules/report";
import { countTotals } from "../rules/stock-count";
import { PeriodPicker, useFinanceAccess } from "../shared";
import { setParam } from "@/lib/routes";

/** A zero cell prints a dash, a zero total prints 0.00, and money out stays negative. */
const cellText = (rappen: number, total = false) => (rappen === 0 && !total ? "–" : formatChf(rappen, { symbol: false }));

export function ReportsScreen() {
  const dict = useT(finance);
  const t = dict.reports;
  const lang = useLang();
  const params = useSearchParams();
  const asked = params.get("period");
  const period = asked && isPeriod(asked) ? asked : defaultPeriod(DEMO_TODAY);
  const label = periodLabel(period);

  const entries = useStore((s) => s.ledger);
  const categories = useStore((s) => s.categories);
  const accounts = useStore((s) => s.accounts);
  const drops = useStore((s) => s.drops);
  const orders = useStore((s) => s.orders);
  const returns = useStore((s) => s.returns);
  const counts = useStore((s) => s.stockCounts);
  const vatOn = useStore((s) => s.settings.vatEnabled);
  const { full, canCount } = useFinanceAccess();
  const [askVat, setAskVat] = useState(false);

  const table = useMemo(() => reportTable(entries, categories, period, vatOn), [entries, categories, period, vatOn]);
  const options = useMemo(() => periodOptions(entries.map((e) => e.occurredOn), DEMO_TODAY), [entries]);
  const refunds = useMemo(() => summariseRefunds(refundsIn(refundRows(orders, returns), period)), [orders, returns, period]);
  const vat = useMemo(() => (vatOn ? vatSummary(entries, categories, period) : null), [vatOn, entries, categories, period]);

  const heads = table.columns.map((c) => columnHead(c, lang));
  const lineName = (row: ReportRow) => t.lines[row.line];
  const spend = table.rows
    .filter((r) => r.total < 0)
    .map((r) => ({ key: r.line, label: lineName(r), value: -r.total, display: formatChf(-r.total) }))
    .sort((a, b) => b.value - a.value);

  const year = yearOfPeriod(period);
  const count = counts.find((c) => c.year === year);

  const download = () => {
    const name = `${LABEL.name.toLowerCase()}-finances-${period}.csv`;
    downloadText(name, financeCsv({ entries, categories, accounts, drops, vatOn }, period), "text/csv;charset=utf-8");
    toast(fmt(dict.shared.csvDone, { name }));
  };

  const body = [...table.rows, table.result, table.transfers];
  const rowAttrs = (row: ReportRow) => (row === table.result ? { "data-result": true } : row === table.transfers ? { "data-transfer": true } : {});
  const nameOf = (row: ReportRow) => (row === table.result ? t.result : lineName(row));

  return (
    <div className="fin-cq">
      <PageHead id="reports" title={fmt(t.title, { q: label, chf: formatChf(table.result.total) })} />

      <div className="fin-report-head">
        <div className="fin-glow">
          <span className="fin-total-k">{t.result}</span>
          <span className="fin-big" data-low={table.result.total < 0 || undefined}>
            {formatChf(table.result.total)}
          </span>
          <span className="fin-total-s">{label}</span>
          {spend.length ? (
            <div className="mt-4">
              <BarList data={spend} caption={t.caption} />
            </div>
          ) : null}
        </div>
        <div className="fin-report-ctl">
          <p className="fin-note">{t.intro}</p>
          <div className="fin-row" style={{ alignItems: "flex-end" }}>
            <PeriodPicker label={dict.shared.period} value={period} options={options} onChange={(next) => setParam("period", next)} />
            {full ? (
              <div>
                <Button variant="outline" onClick={download}>
                  <Download size={15} aria-hidden="true" />
                  {t.csv}
                </Button>
              </div>
            ) : (
              <p className="fin-note">{dict.shared.ownerCsvNote}</p>
            )}
          </div>
          {full ? <p className="fin-note fin-faint">{fmt(t.csvSub, { period: label })}</p> : null}
          <div>
            <Switch label={t.vatSwitch} checked={vatOn} onChange={() => setAskVat(true)} />
          </div>
          <p className="fin-note">
            {fmt(t.refundLine, { period: label, n: refunds.count, amount: formatChf(refunds.total) })} <span className="fin-faint">{t.refundNote}</span>{" "}
            <Link className="fin-link" href={`/desk/finance/refunds/?period=${encodeURIComponent(period)}`}>
              {t.openRefunds}
            </Link>
          </p>
        </div>
      </div>

      {table.entryCount === 0 ? <p className="fin-note mt-3">{fmt(t.empty, { period: label })}</p> : null}
      {vatOn ? <p className="fin-note mt-3">{t.netNote}</p> : null}

      <section className="fin-panel fin-rep-panel" aria-label={t.caption}>
        <div className="fin-rep-wide">
          <table className="fin-rep">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.line}</th>
                {heads.map((head) => (
                  <th key={head} scope="col">
                    {head}
                  </th>
                ))}
                <th scope="col">{t.totalChf}</th>
              </tr>
            </thead>
            <tbody>
              {body.map((row) => (
                <tr key={row === table.result ? "result" : row.line} {...rowAttrs(row)}>
                  <td>{nameOf(row)}</td>
                  {table.columns.map((column) => (
                    <td key={column} data-neg={(row.cells[column] ?? 0) < 0 || undefined}>
                      {cellText(row.cells[column] ?? 0)}
                    </td>
                  ))}
                  <td data-neg={row.total < 0 || undefined}>{cellText(row.total, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="fin-rep-cards">
          {body.map((row) => (
            <li key={row === table.result ? "result" : row.line} className="fin-rep-card" {...rowAttrs(row)}>
              <div className="fin-rep-card-top">
                <span>{nameOf(row)}</span>
                <b data-neg={row.total < 0 || undefined}>{formatChf(row.total)}</b>
              </div>
              <div className="fin-rep-card-cols">
                {table.columns.map((column, i) => (
                  <span key={column}>{`${heads[i]} ${cellText(row.cells[column] ?? 0)}`}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {showsYearEnd(period) ? (
        <section className="fin-card fin-sec">
          <h2 className="fin-h">{fmt(t.stockTitle, { year })}</h2>
          {count?.status === "confirmed" ? (
            <StockValue lines={count.lines} confirmedAt={count.confirmedAt} />
          ) : count ? (
            <p className="fin-note mt-1">{fmt(t.stockDraft, { year })}</p>
          ) : (
            <p className="fin-note mt-1">{fmt(t.stockNone, { year })}</p>
          )}
          {canCount ? (
            <Link className="fin-link type-small mt-2" style={{ display: "inline-block" }} href={`/desk/finance/stock-count/?year=${year}`}>
              {t.openCount}
            </Link>
          ) : null}
        </section>
      ) : null}

      {vat ? (
        <section className="fin-card fin-vat">
          <h2 className="fin-h3">{fmt(t.vatTitle, { period: label })}</h2>
          <p className="fin-note mt-1">{t.vatIntro}</p>
          <div className="fin-vat-part mt-3">
            <div className="fin-row">
              <h3 className="fin-h">{t.salesVat}</h3>
              <Status tone="warn">{t.pending}</Status>
            </div>
            <p className="fin-note mt-1">{t.salesPending}</p>
            {vat.payouts > 0 ? <p className="fin-note fin-mono mt-1">{fmt(t.payoutsBooked, { n: vat.payouts, amount: formatChf(vat.payoutRappen) })}</p> : null}
          </div>
          <div className="fin-vat-part">
            <h3 className="fin-h">{t.otherOutput}</h3>
            {vat.output.length === 0 ? (
              <p className="fin-note mt-1">{t.noOutput}</p>
            ) : (
              <table className="fin-subtable">
                <thead>
                  <tr>
                    <th scope="col">{t.rate}</th>
                    <th scope="col">{t.entries}</th>
                    <th scope="col">{t.base}</th>
                    <th scope="col">{t.tax}</th>
                    <th scope="col">{t.sumEntries}</th>
                    <th scope="col">{t.rounding}</th>
                  </tr>
                </thead>
                <tbody>
                  {vat.output.map((row) => (
                    <tr key={row.bp}>
                      <td>{`${vatRatePercent(row.bp)} %`}</td>
                      <td>{row.entries}</td>
                      <td>{formatChf(row.base, { symbol: false })}</td>
                      <td>{formatChf(row.tax, { symbol: false })}</td>
                      <td>{formatChf(row.typed, { symbol: false })}</td>
                      <td className={row.rounding !== 0 ? "fin-amber" : ""}>{formatChf(row.rounding, { symbol: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="fin-vat-part">
            <h3 className="fin-h">{t.inputTax}</h3>
            {vat.input.length === 0 ? (
              <p className="fin-note mt-1">{t.noInput}</p>
            ) : (
              <table className="fin-subtable">
                <thead>
                  <tr>
                    <th scope="col">{t.group}</th>
                    <th scope="col">{t.entries}</th>
                    <th scope="col">{t.tax}</th>
                  </tr>
                </thead>
                <tbody>
                  {vat.input.map((row) => (
                    <tr key={row.group}>
                      <td>{t.lines[row.group]}</td>
                      <td>{row.entries}</td>
                      <td>{formatChf(row.tax, { symbol: false })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t.total}</td>
                    <td />
                    <td>{formatChf(vat.inputTotal, { symbol: false })}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          <div className="fin-vat-part fin-stack" style={{ gap: 6 }}>
            <p className="fin-note">{t.payableHidden}</p>
            {vat.missingVat > 0 ? (
              <p className="fin-note fin-amber fin-row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 6 }}>
                <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} aria-hidden="true" />
                {fmt(vat.missingVat === 1 ? t.missingOne : t.missingMany, { n: vat.missingVat })}
              </p>
            ) : null}
            {vat.uncategorisedVat > 0 ? (
              <p className="fin-note fin-amber fin-row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 6 }}>
                <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} aria-hidden="true" />
                {fmt(vat.uncategorisedVat === 1 ? t.uncatOne : t.uncatMany, { n: vat.uncategorisedVat })}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <Dialog
        open={askVat}
        onClose={() => setAskVat(false)}
        title={vatOn ? t.vatOffTitle : t.vatOnTitle}
        confirmLabel={vatOn ? t.vatOffConfirm : t.vatOnConfirm}
        onConfirm={() => {
          const next = !vatOn;
          setVatEnabled(next);
          setAskVat(false);
          toast(next ? t.vatOnToast : t.vatOffToast);
        }}
      >
        <p>{vatOn ? t.vatOffBody : t.vatOnBody}</p>
      </Dialog>
    </div>
  );
}

function StockValue({ lines, confirmedAt }: { lines: Parameters<typeof countTotals>[0]; confirmedAt: string | null }) {
  const { reports: t } = useT(finance);
  const totals = countTotals(lines);
  return (
    <div className="mt-2">
      <span className="fin-big">{formatChf(totals.valueRappen)}</span>
      <p className="fin-note mt-1">
        {fmt(t.stockPieces, { n: totals.pieces })}
        {confirmedAt ? ` · ${fmt(t.stockConfirmedOn, { date: formatDate(dayKey(confirmedAt)) })}` : ""}
      </p>
      {totals.unknownCostPieces > 0 ? <p className="fin-note fin-amber mt-1">{fmt(t.stockUnknown, { n: totals.unknownCostPieces, m: totals.unknownCostLines })}</p> : null}
    </div>
  );
}

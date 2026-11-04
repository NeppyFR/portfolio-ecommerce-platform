"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Undo2 } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { DEMO_TODAY } from "@/store/clock";
import { fmt, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { formatChf, formatDate, dayKey } from "@/lib/format";
import { LABEL } from "@/lib/brand";
import { downloadText } from "@/lib/download";
import { orderHref } from "@/lib/routes";
import { useStore } from "@/store/core";
import type { ReturnRecord } from "@/store/types";
import { Button, Empty, Money, RuleLine, Status, Table, toast, type Column } from "@/ui";
import { openReturnsIn, refundRows, refundsCsv, refundsIn, summariseRefunds, type RefundRow } from "../rules/refunds";
import { defaultPeriod, isPeriod, periodLabel, periodOptions } from "../rules/report";
import { PeriodPicker, useFinanceAccess } from "../shared";
import { setParam } from "@/lib/routes";

const STATUS_TONE = { requested: "warn", received: "unknown", refunded: "ok", closed: "off" } as const;

export function RefundsScreen() {
  const dict = useT(finance);
  const t = dict.refunds;
  const params = useSearchParams();
  const asked = params.get("period");
  const period = asked && isPeriod(asked) ? asked : defaultPeriod(DEMO_TODAY);
  const orders = useStore((s) => s.orders);
  const returns = useStore((s) => s.returns);
  const { full, orders: ordersAccess } = useFinanceAccess();

  const rows = useMemo(() => refundRows(orders, returns), [orders, returns]);
  const inPeriod = useMemo(() => refundsIn(rows, period), [rows, period]);
  const open = useMemo(() => openReturnsIn(returns, period), [returns, period]);
  const summary = summariseRefunds(inPeriod);
  const options = useMemo(() => periodOptions([...rows.map((r) => r.day), ...returns.map((r) => dayKey(r.createdAt))], DEMO_TODAY), [rows, returns]);
  const label = periodLabel(period);

  const orderCell = (number: string) => (ordersAccess ? <Link className="fin-link type-mono-s" href={orderHref(number)}>{number}</Link> : <span className="type-mono-s">{number}</span>);
  const reasonOf = (r: RefundRow) => {
    if (r.type === "return") return r.reasonCode ? t.reasons[r.reasonCode] : "—";
    if (!ordersAccess) return t.reasonHidden;
    return r.reasonText || "—";
  };

  const columns: Column<RefundRow>[] = [
    { key: "date", header: t.colDate, cell: (r) => <span className="type-mono-s">{formatDate(r.day)}</span> },
    { key: "type", header: t.colType, cell: (r) => (r.type === "return" ? t.typeReturn : t.typeOrder) },
    { key: "return", header: t.colReturn, cell: (r) => <span className="type-mono-s">{r.returnNo ?? ""}</span> },
    { key: "order", header: t.colOrder, cell: (r) => orderCell(r.orderNumber) },
    { key: "reason", header: t.colReason, cell: reasonOf },
    { key: "amount", header: t.colAmount, align: "right", cell: (r) => <Money value={r.amountRappen} /> },
  ];
  const openColumns: Column<ReturnRecord>[] = [
    { key: "return", header: t.colReturn, cell: (r) => <span className="type-mono-s">{r.returnNo}</span> },
    { key: "order", header: t.colOrder, cell: (r) => orderCell(r.orderNumber) },
    { key: "reason", header: t.colReason, cell: (r) => t.reasons[r.reason] },
    { key: "status", header: t.colStatus, cell: (r) => <Status tone={STATUS_TONE[r.status]}>{t.statuses[r.status]}</Status> },
    { key: "opened", header: t.colOpened, align: "right", cell: (r) => <span className="type-mono-s">{formatDate(dayKey(r.createdAt))}</span> },
  ];

  const download = () => {
    const name = `${LABEL.name.toLowerCase()}-refunds-${period}.csv`;
    downloadText(name, refundsCsv(inPeriod, ordersAccess), "text/csv;charset=utf-8");
    toast(fmt(dict.shared.csvDone, { name }));
  };

  return (
    <div className="fin-cq">
      <PageHead id="refunds" title={fmt(t.title, { n: summary.count, q: label })} rule={<RuleLine>{t.rule}</RuleLine>} />

      <div className="fin-report-head">
        <div className="fin-glow">
          <span className="fin-total-k">{fmt(t.recorded, { period: label })}</span>
          <span className="fin-big">{formatChf(summary.total)}</span>
          <span className="fin-total-s">{fmt(summary.count === 1 ? t.totalOne : t.totalMany, { count: summary.count, amount: formatChf(summary.total) })}</span>
        </div>
        <div className="fin-report-ctl">
          <p className="fin-note">{t.intro}</p>
          <div className="fin-row" style={{ alignItems: "flex-end" }}>
            <PeriodPicker label={dict.shared.period} value={period} options={options} onChange={(next) => setParam("period", next)} />
            {full ? (
              <Button variant="outline" onClick={download}>
                <Download size={15} aria-hidden="true" />
                {dict.shared.downloadCsv}
              </Button>
            ) : (
              <p className="fin-note">{dict.shared.ownerCsvNote}</p>
            )}
          </div>
        </div>
      </div>

      <section className="fin-card fin-ref-card">
        <h2 className="fin-h3">{fmt(t.recorded, { period: label })}</h2>
        <div className="mt-2">
          <Table
            caption={fmt(t.recorded, { period: label })}
            columns={columns}
            rows={inPeriod}
            rowKey={(r) => r.id}
            empty={<Empty icon={Undo2}>{fmt(t.emptyRecorded, { period: label })}</Empty>}
            phoneRow={(r) => (
              <div className="fin-pcard">
                <div className="fin-pcard-top">
                  <div>
                    <b>{`${r.type === "return" ? t.typeReturn : t.typeOrder}${r.returnNo ? ` · ${r.returnNo}` : ""}`}</b>
                  </div>
                  <Money value={r.amountRappen} />
                </div>
                <span className="fin-pcard-sub">
                  {formatDate(r.day)} · {fmt(t.orderN, { n: "" })}
                  {orderCell(r.orderNumber)}
                </span>
                <span className="fin-pcard-sub">{reasonOf(r)}</span>
              </div>
            )}
          />
        </div>
        <div className="fin-ref-total">
          <b className="type-label">{fmt(summary.count === 1 ? t.totalOne : t.totalMany, { count: summary.count, amount: formatChf(summary.total) })}</b>
          <span className="fin-note">{t.footnote}</span>
        </div>
      </section>

      <section className="fin-card fin-ref-card">
        <h2 className="fin-h3">{fmt(t.openTitle, { period: label })}</h2>
        <p className="fin-note mt-1">{t.openIntro}</p>
        <div className="mt-2">
          <Table
            caption={fmt(t.openTitle, { period: label })}
            columns={openColumns}
            rows={open}
            rowKey={(r) => r.id}
            empty={<Empty icon={Undo2}>{fmt(t.emptyOpen, { period: label })}</Empty>}
            phoneRow={(r) => (
              <div className="fin-pcard">
                <div className="fin-pcard-top">
                  <div>
                    <b className="type-mono">{r.returnNo}</b>
                    <span className="fin-pcard-sub">{`${formatDate(dayKey(r.createdAt))} · ${t.reasons[r.reason]}`}</span>
                  </div>
                  {orderCell(r.orderNumber)}
                </div>
                <div>
                  <Status tone={STATUS_TONE[r.status]}>{t.statuses[r.status]}</Status>
                </div>
              </div>
            )}
          />
        </div>
      </section>
    </div>
  );
}

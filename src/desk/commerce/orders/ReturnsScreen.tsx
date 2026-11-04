"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Undo2 } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { formatChf, formatDate } from "@/lib/format";
import { orderHref, setParams } from "@/lib/routes";
import { useStore } from "@/store/core";
import type { ReturnRecord } from "@/store/types";
import { Empty, Money, Pager, RuleLine, Status, Table, Tabs, usePageSize, type Column } from "@/ui";
import { RETURN_TONE } from "./OrderReturns";
import { shownName } from "./rules/order-rules";
import { isOpenReturn, returnPieces } from "./rules/returns";
import "./orders.css";

export function ReturnsScreen() {
  const t = useT(ordersDict);
  const router = useRouter();
  const params = useSearchParams();
  const all = useStore((s) => s.returns);
  const pageSize = usePageSize();
  const [page, setPage] = useState(1);
  const tab = params.get("tab") === "done" ? "done" : "open";

  const rows = useMemo(() => {
    const open = all.filter(isOpenReturn).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const done = all.filter((r) => !isOpenReturn(r)).sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
    return tab === "open" ? open : done;
  }, [all, tab]);

  const waiting = useMemo(() => all.filter((r) => r.status === "requested").length, [all]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);
  const pieces = (r: ReturnRecord) => {
    const n = returnPieces(r);
    return fmt(n === 1 ? t.ret.piecesOne : t.ret.piecesOther, { count: n });
  };

  const columns: Column<ReturnRecord>[] = [
    { key: "return", header: t.ret.colReturn, cell: (r) => <Link className="type-mono or-link" href={orderHref(r.orderNumber)}>{r.label}</Link> },
    { key: "order", header: t.ret.colOrder, cell: (r) => <span className="type-mono">{r.orderNumber}</span> },
    { key: "customer", header: t.ret.colCustomer, cell: (r) => shownName(r.customerName, t.erasedName) },
    { key: "reason", header: t.ret.colReason, cell: (r) => t.ret.reason[r.reason] },
    { key: "pieces", header: t.ret.colPieces, align: "right", cell: (r) => <span className="type-mono">{returnPieces(r)}</span> },
    { key: "status", header: t.ret.colStatus, cell: (r) => <Status tone={RETURN_TONE[r.status]}>{t.ret.status[r.status]}</Status> },
    tab === "open"
      ? { key: "opened", header: t.ret.colOpened, cell: (r) => formatDate(r.createdAt) }
      : { key: "closed", header: t.ret.colClosed, cell: (r) => (r.closedAt ? formatDate(r.closedAt) : "–") },
    ...(tab === "done" ? [{ key: "refund", header: t.ret.colRefund, align: "right" as const, cell: (r: ReturnRecord) => (r.refundRappen > 0 ? <Money value={r.refundRappen} /> : "–") }] : []),
  ];

  return (
    <>
      <PageHead id="returns" title={fmt(waiting === 1 ? t.returnsTitle.one : t.returnsTitle.many, { n: waiting })} rule={<RuleLine>{t.ret.intro}</RuleLine>} />
      <div className="or-card or-returns-card">
      <Tabs
        aria-label={t.ret.tabs}
        active={tab}
        className="or-tabs"
        items={[{ id: "open", label: t.ret.tabOpen }, { id: "done", label: t.ret.tabDone }]}
        onChange={(id) => {
          setPage(1);
          setParams({ tab: id === "done" ? "done" : null });
        }}
      />
      <Table
        className="or-returns-table"
        caption={t.ret.title}
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(orderHref(r.orderNumber))}
        empty={<Empty icon={Undo2}>{tab === "open" ? t.ret.emptyOpen : t.ret.emptyDone}</Empty>}
        phoneRow={(r) => (
          <>
            <div className="or-card-top">
              <span className="type-mono">{r.label}</span>
              <Status tone={RETURN_TONE[r.status]}>{t.ret.status[r.status]}</Status>
            </div>
            <div className="type-small">
              <span className="type-mono-s">{r.orderNumber}</span> · {shownName(r.customerName, t.erasedName)} · {pieces(r)}
            </div>
            <div className="type-small or-muted">
              {t.ret.reason[r.reason]} · {tab === "open" ? fmt(t.ret.opened, { date: formatDate(r.createdAt) }) : fmt(t.ret.closed, { date: formatDate(r.closedAt ?? r.createdAt) })}
              {r.refundRappen > 0 ? ` · ${fmt(t.ret.refundedAmount, { amount: formatChf(r.refundRappen) })}` : null}
            </div>
          </>
        )}
      />
      {pages > 1 ? <Pager className="or-pager" page={current} pages={pages} onPage={setPage} /> : null}
      </div>
    </>
  );
}

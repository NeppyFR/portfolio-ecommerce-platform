"use client";

import { Factory, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { awaitsBooking, comparePoNewest, isOpenPo, matchesPoFilter, PO_FILTERS, poTotals, type PoFilter } from "@/desk/commerce/products/rules";
import { TableCard, useOpenParam } from "@/desk/commerce/products/shared";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useT } from "@/i18n";
import { production as dict } from "@/i18n/dict/production";
import { formatDate, formatMinor } from "@/lib/format";
import { setParam } from "@/lib/routes";
import { useStore } from "@/store/core";
import type { PurchaseOrder } from "@/store/types";
import { Button, Empty, RuleLine, Status, Table, type Column } from "@/ui";
import { OrderDialog, PoStatus, PoSheet, SuppliersDialog } from "./PoSheet";

export function ProductionScreen() {
  const t = useT(dict);
  const params = useSearchParams();
  const orders = useStore((s) => s.purchaseOrders);
  const suppliers = useStore((s) => s.suppliers);
  const drops = useStore((s) => s.drops);
  const [openId, setOpen] = useOpenParam();
  const [creating, setCreating] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const showParam = params.get("show") as PoFilter | null;
  const show: PoFilter = showParam && PO_FILTERS.includes(showParam) ? showParam : "open";
  const rows = useMemo(() => orders.filter((o) => matchesPoFilter(o.status, show)).sort(comparePoNewest), [orders, show]);
  const onWay = useMemo(() => orders.filter((o) => isOpenPo(o.status)).length, [orders]);
  const hasSupplier = suppliers.some((s) => s.isActive);

  const supplierName = (o: PurchaseOrder) => suppliers.find((s) => s.id === o.supplierId)?.name ?? "–";
  const dropName = (o: PurchaseOrder) => drops.find((d) => d.id === o.dropId)?.name ?? "–";
  const dateText = (o: PurchaseOrder) => (o.receivedAt ? formatDate(o.receivedAt) : o.expectedOn ? formatDate(o.expectedOn) : "–");
  const piecesText = (o: PurchaseOrder) => {
    const totals = poTotals(o.lines, o.shippingMinor);
    return totals.receivedUnits > 0 && totals.receivedUnits < totals.units ? `${totals.receivedUnits}/${totals.units}` : String(totals.units);
  };
  const totalText = (o: PurchaseOrder) => formatMinor(poTotals(o.lines, o.shippingMinor).totalMinor, o.currency);
  const ledgerCell = (o: PurchaseOrder) => {
    if (o.financeEntryId) return <Status tone="ok">{t.ledgerState.linked}</Status>;
    if (awaitsBooking(o)) return <Status tone="warn">{t.ledgerState.unbooked}</Status>;
    return <span className="cat-sub">–</span>;
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: t.table.number,
      cell: (o) => (
        <span className="cat-prod-text">
          <span className="cat-mono cat-name">{o.number}</span>
          <span className="type-small cat-sub">{t.kind[o.kind]}</span>
        </span>
      ),
    },
    { key: "supplier", header: t.table.supplier, cell: supplierName },
    { key: "drop", header: t.table.drop, cell: dropName },
    { key: "status", header: t.table.status, cell: (o) => <PoStatus status={o.status} t={t} /> },
    { key: "date", header: t.table.date, align: "right", cell: (o) => <span className="cat-mono">{dateText(o)}</span> },
    { key: "units", header: t.table.units, align: "right", cell: (o) => <span className="cat-mono">{piecesText(o)}</span> },
    { key: "total", header: t.table.total, align: "right", cell: (o) => <span className="cat-mono">{totalText(o)}</span> },
    { key: "ledger", header: t.table.ledger, cell: ledgerCell },
  ];
  const phoneRow = (o: PurchaseOrder) => (
    <div className="cat-card">
      <div className="cat-card-top">
        <span className="cat-mono cat-name">{o.number}</span>
        <PoStatus status={o.status} t={t} />
      </div>
      <div className="type-small">
        {supplierName(o)}
        <span className="cat-sub">
          {" "}
          · {t.kind[o.kind]}
          {o.dropId ? ` · ${dropName(o)}` : ""}
        </span>
      </div>
      <div className="cat-card-meta type-small">
        <span>{dateText(o)}</span>
        <span>{fmt(t.card.pieces, { n: piecesText(o) })}</span>
        <span className="cat-mono">{totalText(o)}</span>
      </div>
      {o.financeEntryId || awaitsBooking(o) ? <div>{ledgerCell(o)}</div> : null}
    </div>
  );

  return (
    <div className="cat-stack">
      <PageHead
        id="production"
        title={fmt(plural(onWay, t.titleOne, t.title), { n: onWay })}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowSuppliers(true)}>
              <Factory size={16} aria-hidden="true" />
              {t.suppliers.open}
            </Button>
            <Button disabled={!hasSupplier} title={hasSupplier ? undefined : t.needSupplier} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" />
              {t.newOrder}
            </Button>
          </>
        }
        rule={<RuleLine>{t.rule}</RuleLine>}
      />
      <TableCard
        head={
          <nav className="cat-presets" aria-label={t.showNav}>
            {PO_FILTERS.map((id) => (
              <button key={id} type="button" className="cat-preset" aria-pressed={id === show} onClick={() => setParam("show", id === "open" ? null : id)}>
                {t.show[id]}
              </button>
            ))}
          </nav>
        }
      >
        <Table columns={columns} rows={rows} rowKey={(o) => o.id} phoneRow={phoneRow} caption={t.caption} selectedKey={openId} onRowClick={(o) => setOpen(o.id)} empty={<Empty icon={Factory}>{orders.length ? t.noneShown : t.empty}</Empty>} />
      </TableCard>
      <p className="type-small cat-sub cat-intro">{t.intro}</p>
      <PoSheet openId={openId} onClose={() => setOpen(null)} />
      <OrderDialog open={creating} order={null} onClose={() => setCreating(false)} onCreated={(id) => setOpen(id)} />
      <SuppliersDialog open={showSuppliers} onClose={() => setShowSuppliers(false)} />
    </div>
  );
}

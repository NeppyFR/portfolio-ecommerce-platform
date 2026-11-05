"use client";

import { colourLabel } from "@/desk/commerce/orders/rules/order-rules";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, TriangleAlert } from "lucide-react";
import { fmt, useDocTitle, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { LABEL } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { orderHref } from "@/lib/routes";
import { piecesOut } from "@/desk/commerce/orders/rules/order-rules";
import { useStore } from "@/store/core";
import type { Order } from "@/store/types";
import { Button, DemoPill, Empty, LangToggle } from "@/ui";
import { Barcode } from "./Barcode";
import "./print.css";

const ORDER_MODULE_MM = 0.4;
const ORDER_BAR_MM = 12;
const SKU_MODULE_MM = 0.3;
const SKU_BAR_MM = 8;

export function SlipScreen() {
  const t = useT(ordersDict);
  useDocTitle(t.slip.title);
  const number = useSearchParams().get("o");
  const order = useStore((s) => (number ? s.orders.find((o) => o.orderNumber === number) ?? null : null));

  if (!order) {
    return (
      <main id="main" className="pr-page pr-missing">
        <Empty icon={Printer} action={<Link href="/desk/orders/" className="ui-btn ui-btn-outline"><span className="ui-btn-label">{t.slip.toOrders}</span></Link>}>
          {number ? fmt(t.slip.missing, { number }) : t.slip.noOrder}
        </Empty>
      </main>
    );
  }

  return (
    <main id="main" className="pr-page">
      <div className="pr-toolbar">
        <Link href={orderHref(order.orderNumber)} className="ui-btn ui-btn-ghost">
          <span className="ui-btn-label">{t.slip.back}</span>
        </Link>
        <p className="type-small pr-help">{t.slip.help}</p>
        <DemoPill />
        <LangToggle />
        <Button onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          {t.slip.print}
        </Button>
        {order.status === "cancelled" ? (
          <p className="pr-warning type-label" role="alert">
            <TriangleAlert size={15} aria-hidden="true" />
            {t.slip.cancelled}
          </p>
        ) : null}
      </div>
      <SlipSheet order={order} />
    </main>
  );
}

/** The sheet goes in the parcel, so it follows the customer's language, not the desk's. */
function SlipSheet({ order }: { order: Order }) {
  const s = ordersDict[order.locale].slip;
  const lines = order.items.map((item) => ({ item, pieces: piecesOut(item) })).filter((l) => l.pieces > 0);
  const count = lines.reduce((sum, l) => sum + l.pieces, 0);
  const address = order.shippingAddress;
  const hasAddress = !order.customerErased && Boolean(address.line1);
  return (
    <article className="pr-sheet paper" lang={order.locale}>
      <header className="pr-sheet-head">
        <div>
          <p className="pr-word">{LABEL.name}</p>
          <h1 className="pr-title">{s.title}</h1>
        </div>
        <div className="pr-sheet-code">
          <Barcode value={order.orderNumber} moduleMm={ORDER_MODULE_MM} heightMm={ORDER_BAR_MM} label={fmt(s.barcode, { value: order.orderNumber })} />
          <span className="type-mono">{order.orderNumber}</span>
        </div>
      </header>

      <div className="pr-sheet-meta">
        <dl className="pr-facts">
          <div>
            <dt>{s.order}</dt>
            <dd className="type-mono">{order.orderNumber}</dd>
          </div>
          <div>
            <dt>{s.placed}</dt>
            <dd>{formatDate(order.placedAt)}</dd>
          </div>
        </dl>
        <div className="pr-shipto">
          <p className="pr-label">{s.shipTo}</p>
          {hasAddress ? (
            <address>
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 ? (
                <>
                  <br />
                  {address.line2}
                </>
              ) : null}
              <br />
              {address.postalCode} {address.city}
              <br />
              {s.country}
            </address>
          ) : (
            <p>{s.noAddress}</p>
          )}
        </div>
      </div>

      <table className="pr-table">
        <thead>
          <tr>
            <th scope="col">{s.colCheck}</th>
            <th scope="col">{s.colItem}</th>
            <th scope="col">{s.colSku}</th>
            <th scope="col" data-num>{s.colQty}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="pr-nothing">{s.nothing}</td>
            </tr>
          ) : null}
          {lines.map(({ item, pieces }) => {
            const size = item.size === "ONE_SIZE" ? s.oneSize : fmt(s.size, { size: item.size });
            return (
              <tr key={item.id}>
                <td className="pr-check-cell"><span className="pr-check" aria-hidden="true" /></td>
                <td className="pr-item">
                  <span className="pr-item-name">{order.locale === "de" ? item.nameDe : item.name}</span>
                  <span className="pr-item-sub">{[colourLabel(item.color, order.locale), size].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="pr-sku">
                  <Barcode value={item.sku} moduleMm={SKU_MODULE_MM} heightMm={SKU_BAR_MM} label={fmt(s.barcode, { value: item.sku })} />
                  <span className="type-mono-s">{item.sku}</span>
                </td>
                <td className="pr-qty type-mono" data-num>{pieces}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="pr-sheet-foot">
        <p>{count === 1 ? s.itemsOne : fmt(s.itemsMany, { count })}</p>
        <p className="pr-thanks">{s.thanks}</p>
        <p className="pr-demo-note">{s.demoNote}</p>
      </footer>
    </article>
  );
}

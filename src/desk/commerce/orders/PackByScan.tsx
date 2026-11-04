"use client";

import { useMemo, useState } from "react";
import { Minus, PackageCheck, RotateCcw, ScanBarcode } from "lucide-react";
import { fmt, useLang, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { sizeLabel } from "@/lib/product-rules";
import { markPacked, onePieceLess, packStateOf, restartPack, scanIntoBox, usePackState } from "@/store/actions/orders";
import type { Order } from "@/store/types";
import { Button, IconButton, toast } from "@/ui";
import { nextPackCode, packIsComplete, packLines, packNeed, packPacked } from "./rules/pack";
import { ScanBar, type ScanMessage } from "./ScanBar";

export function PackByScan({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const state = usePackState(order.orderNumber);
  const lines = useMemo(() => packLines(order), [order]);
  const [message, setMessage] = useState<ScanMessage | null>(null);
  const [overItem, setOverItem] = useState<string | null>(null);
  const need = packNeed(lines);
  const packed = packPacked(lines, state);
  const complete = packIsComplete(lines, state);
  const name = (line: { name: string; nameDe: string }) => (lang === "de" ? line.nameDe : line.name);

  const onScan = (code: string) => {
    const outcome = scanIntoBox(order.orderNumber, code);
    if (!outcome) return;
    setOverItem(outcome.kind === "over" ? outcome.line.itemId : null);
    switch (outcome.kind) {
      case "counted":
        setMessage({ tone: "ok", text: fmt(t.scanPack.counted, { name: name(outcome.line), size: sizeLabel(outcome.line.size, lang), packed: outcome.packed, need: outcome.line.need }) });
        break;
      case "complete":
        setMessage({ tone: "ok", text: t.scanPack.complete });
        break;
      case "wrong":
        setMessage({ tone: "bad", text: fmt(t.scanPack.wrong, { sku: outcome.sku }) });
        break;
      case "over":
        setMessage({ tone: "bad", text: fmt(t.scanPack.over, { name: name(outcome.line), size: sizeLabel(outcome.line.size, lang), need: outcome.line.need }) });
        break;
      case "unknown":
        setMessage({ tone: "bad", text: fmt(t.scanPack.unknown, { code: outcome.code }) });
        break;
      case "this_order":
        setMessage({ tone: "warn", text: t.scanPack.thisOrder });
        break;
      case "other_order":
        setMessage({ tone: "bad", text: fmt(t.scanPack.otherOrder, { number: outcome.number }) });
        break;
    }
  };

  const confirm = () => {
    const result = markPacked(order.orderNumber);
    if (result.ok) toast(t.pack.done);
    else toast(fmt(t.genericError, { message: result.message }));
  };

  return (
    <section className="or-sec or-pack">
      <h3 className="or-sec-title type-h4">
        <ScanBarcode size={16} aria-hidden="true" />
        <span>{t.scanPack.title}</span>
        <span className="type-mono-s or-sec-aside">{fmt(t.scanPack.progress, { packed, need })}</span>
      </h3>
      <p className="type-small or-muted">{t.scanPack.help}</p>
      <div className="or-pack-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${need ? packed / need : 0})` }} />
      </div>
      <ScanBar label={t.scanPack.label} placeholder={t.scanPack.placeholder} onScan={onScan} message={message} nextLabel={t.scan.next} nextTitle={t.scan.nextTitle} nextCode={() => nextPackCode(lines, packStateOf(order.orderNumber))} />
      <ul className="or-pack-lines">
        {lines.map((line) => {
          const count = state[line.itemId] ?? 0;
          const size = sizeLabel(line.size, lang);
          return (
            <li key={line.itemId} className="or-pack-line" data-over={overItem === line.itemId || undefined} data-full={(line.need > 0 && count >= line.need) || undefined}>
              <span className="or-pack-name">
                <span className="type-label">
                  {name(line)} · {size}
                </span>
                <span className="type-mono-s or-muted or-anywhere">{line.sku}</span>
              </span>
              {line.need === 0 ? (
                <span className="type-small or-muted">{t.scanPack.refundedLine}</span>
              ) : (
                <>
                  <span className="type-mono-s">{fmt(t.scanPack.line, { packed: count, need: line.need })}</span>
                  <IconButton aria-label={fmt(t.scanPack.minus, { name: name(line), size })} disabled={count === 0} onClick={() => onePieceLess(order.orderNumber, line.itemId)}>
                    <Minus size={16} aria-hidden="true" />
                  </IconButton>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="or-pack-actions">
        <Button
          variant="ghost"
          disabled={packed === 0}
          onClick={() => {
            restartPack(order.orderNumber);
            setMessage(null);
            setOverItem(null);
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t.scanPack.reset}
        </Button>
        <Button disabled={!complete} onClick={confirm}>
          <PackageCheck size={16} aria-hidden="true" />
          {t.scanPack.confirm}
        </Button>
      </div>
    </section>
  );
}

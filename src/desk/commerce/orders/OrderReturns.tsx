"use client";

import { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { fmt, useLang, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { formatChf, formatDateTime } from "@/lib/format";
import { sizeAndColour } from "./rules/order-rules";
import { closeReturn, receiveReturn, refundReturn, startReturn } from "@/store/actions/orders";
import { useStore } from "@/store/core";
import type { ActionResult, Order, ReturnReason, ReturnRecord } from "@/store/types";
import { Button, Dialog, Input, MoneyInput, Select, Status, Textarea, toast } from "@/ui";
import { RETURN_REASONS, refundAmountProblem, remainingRappen, returnBlock, returnableByItem, suggestedRefund } from "./rules/returns";
import { Stepper } from "./Stepper";

type Dict = typeof ordersDict.en;

export const RETURN_TONE = { requested: "warn", received: "unknown", refunded: "ok", closed: "off" } as const;

export function OrderReturns({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const all = useStore((s) => s.returns);
  const own = useMemo(() => all.filter((r) => r.orderNumber === order.orderNumber), [all, order.orderNumber]);
  const block = returnBlock(order, own);
  const [starting, setStarting] = useState(false);
  return (
    <section className="or-sec">
      <div className="or-sec-row">
        <h3 className="or-sec-title type-h4">
          <Undo2 size={16} aria-hidden="true" />
          <span>{t.ret.title}</span>
        </h3>
        {block ? null : (
          <Button variant="outline" onClick={() => setStarting(true)}>
            {t.ret.start}
          </Button>
        )}
      </div>
      {own.length === 0 && !block ? <p className="type-small or-muted">{t.ret.none}</p> : null}
      {block ? <p className="type-small or-muted">{t.ret.block[block]}</p> : null}
      {own.length > 0 ? (
        <ul className="or-returns">
          {own.map((ret) => (
            <ReturnCard key={ret.id} ret={ret} order={order} />
          ))}
        </ul>
      ) : null}
      <StartDialog order={order} returns={own} open={starting} onClose={() => setStarting(false)} />
    </section>
  );
}

function useFinish(t: Dict, onDone: () => void) {
  return (result: ActionResult<unknown>, done: string) => {
    if (result.ok) {
      toast(done);
      onDone();
    } else toast(fmt(t.genericError, { message: result.message }));
  };
}

function ReturnCard({ ret, order }: { ret: ReturnRecord; order: Order }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const [open, setOpen] = useState<"receive" | "refund" | "close" | null>(null);
  const close = () => setOpen(null);
  return (
    <li className="or-return">
      <div className="or-return-head">
        <span className="type-mono">{ret.label}</span>
        <Status tone={RETURN_TONE[ret.status]}>{t.ret.status[ret.status]}</Status>
        <span className="type-small or-muted">{t.ret.reason[ret.reason]}</span>
      </div>
      <ul className="or-return-lines type-small">
        {ret.items.map((line) => {
          const item = order.items.find((i) => i.id === line.orderItemId);
          if (!item) return null;
          const extra = ret.status === "refunded" ? (line.restockQuantity > 0 ? fmt(t.ret.backInStock, { n: line.restockQuantity }) : null) : ret.status === "received" ? fmt(t.ret.resellable, { n: line.restockQuantity }) : null;
          return (
            <li key={line.orderItemId}>
              {fmt(t.ret.pieces, { n: line.quantity, name: lang === "de" ? item.nameDe : item.name, size: sizeAndColour(item.size, item.color, lang) })}
              {extra ? <span className="or-muted"> · {extra}</span> : null}
            </li>
          );
        })}
      </ul>
      {ret.note ? <p className="type-small">{ret.note}</p> : null}
      {ret.status === "closed" && ret.closeNote ? <p className="type-small or-muted">{fmt(t.ret.closeNote, { note: ret.closeNote })}</p> : null}
      <p className="type-small or-muted">
        {fmt(t.ret.by, { name: ret.openedBy, date: formatDateTime(ret.createdAt) })}
        {ret.refundRappen > 0 ? ` · ${fmt(t.ret.refundedAmount, { amount: formatChf(ret.refundRappen) })}` : null}
      </p>
      {ret.status === "requested" || ret.status === "received" ? (
        <div className="or-return-actions">
          {ret.status === "requested" ? <Button variant="outline" onClick={() => setOpen("receive")}>{t.ret.receive}</Button> : <Button variant="outline" onClick={() => setOpen("refund")}>{t.ret.refund}</Button>}
          <Button variant="ghost" onClick={() => setOpen("close")}>{t.ret.close}</Button>
        </div>
      ) : null}
      <ReceiveDialog ret={ret} order={order} open={open === "receive"} onClose={close} />
      <RefundDialog ret={ret} order={order} open={open === "refund"} onClose={close} />
      <CloseDialog ret={ret} open={open === "close"} onClose={close} />
    </li>
  );
}

function StartDialog({ order, returns, open, onClose }: { order: Order; returns: ReturnRecord[]; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const [pieces, setPieces] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("size");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setPieces({});
    setReason("size");
    setNote("");
    setError(null);
  }, [open]);
  const room = returnableByItem(order, returns);
  const confirm = () => {
    if (!Object.values(pieces).some((n) => n > 0)) {
      setError(t.ret.startNone);
      return;
    }
    const result = startReturn(order.orderNumber, { pieces, reason, note });
    if (result.ok) {
      toast(fmt(t.ret.startDone, { label: result.data.returnNo }));
      onClose();
    } else setError(result.message);
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.ret.startTitle, { number: order.orderNumber })} confirmLabel={t.ret.startConfirm} cancelLabel={t.backButton} onConfirm={confirm}>
      <p className="type-body">{t.ret.startBody}</p>
      <div className="or-fieldset">
        {order.items.map((item) => {
          const max = room[item.id] ?? 0;
          if (max === 0) return null;
          const name = lang === "de" ? item.nameDe : item.name;
          return (
            <div key={item.id} className="or-step-row">
              <span className="type-small">
                {name} ({sizeAndColour(item.size, item.color, lang)}) <span className="or-muted">{fmt(t.ret.of, { n: max })}</span>
              </span>
              <Stepper value={pieces[item.id] ?? 0} max={max} onChange={(v) => { setPieces((p) => ({ ...p, [item.id]: v })); setError(null); }} lessLabel={fmt(t.ret.less, { name })} moreLabel={fmt(t.ret.more, { name })} />
            </div>
          );
        })}
      </div>
      {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
      <Select label={t.ret.reasonLabel} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
        {RETURN_REASONS.map((r) => (
          <option key={r} value={r}>
            {t.ret.reason[r]}
          </option>
        ))}
      </Select>
      <Textarea label={t.ret.noteLabel} placeholder={t.ret.notePlaceholder} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
    </Dialog>
  );
}

function ReceiveDialog({ ret, order, open, onClose }: { ret: ReturnRecord; order: Order; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const [restock, setRestock] = useState<Record<string, number>>({});
  useEffect(() => {
    if (open) setRestock(Object.fromEntries(ret.items.map((line) => [line.orderItemId, line.quantity])));
  }, [open, ret.items]);
  const confirm = () => {
    const result = receiveReturn(ret.id, restock);
    if (result.ok) {
      toast(fmt(t.ret.receiveDone, { label: ret.label, n: result.data.resellable }));
      onClose();
    } else toast(fmt(t.genericError, { message: result.message }));
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.ret.receiveTitle, { label: ret.label })} confirmLabel={t.ret.receiveConfirm} cancelLabel={t.backButton} onConfirm={confirm}>
      <p className="type-body">{t.ret.receiveBody}</p>
      <div className="or-fieldset">
        <p className="type-label">{t.ret.receiveResellable}</p>
        {ret.items.map((line) => {
          const item = order.items.find((i) => i.id === line.orderItemId);
          if (!item) return null;
          const name = lang === "de" ? item.nameDe : item.name;
          return (
            <div key={line.orderItemId} className="or-step-row">
              <span className="type-small">
                {name} ({sizeAndColour(item.size, item.color, lang)}) <span className="or-muted">{fmt(t.ret.of, { n: line.quantity })}</span>
              </span>
              <Stepper value={restock[line.orderItemId] ?? 0} max={line.quantity} onChange={(v) => setRestock((r) => ({ ...r, [line.orderItemId]: v }))} lessLabel={fmt(t.ret.less, { name })} moreLabel={fmt(t.ret.more, { name })} />
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

function RefundDialog({ ret, order, open, onClose }: { ret: ReturnRecord; order: Order; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const finish = useFinish(t, onClose);
  const suggestion = suggestedRefund(order, ret);
  const refundable = remainingRappen(order);
  const [amount, setAmount] = useState<number | null>(suggestion);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setAmount(suggestion);
    setError(null);
  }, [open, suggestion]);
  const confirm = () => {
    const problem = refundAmountProblem(amount, refundable);
    if (problem) {
      setError(problem === "invalid" ? t.ret.refundInvalid : problem === "zero" ? t.ret.refundZero : fmt(t.ret.refundTooMuch, { amount: formatChf(refundable) }));
      return;
    }
    finish(refundReturn(ret.id, amount), fmt(t.ret.refundDone, { label: ret.label }));
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.ret.refundTitle, { label: ret.label })} confirmLabel={t.ret.refund} cancelLabel={t.backButton} onConfirm={confirm}>
      <p className="type-body">{t.ret.refundBody}</p>
      <MoneyInput label={t.ret.refundAmount} value={amount} onChange={(v) => { setAmount(v); setError(null); }} error={error} hint={fmt(t.ret.refundSuggested, { amount: formatChf(suggestion) })} />
      <p className="type-small or-muted">{fmt(t.ret.refundRefundable, { amount: formatChf(refundable) })}</p>
    </Dialog>
  );
}

function CloseDialog({ ret, open, onClose }: { ret: ReturnRecord; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const finish = useFinish(t, onClose);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} danger title={fmt(t.ret.closeTitle, { label: ret.label })} confirmLabel={t.ret.closeConfirm} cancelLabel={t.backButton} onConfirm={() => finish(closeReturn(ret.id, note), fmt(t.ret.closeDone, { label: ret.label }))}>
      <p className="type-body">{t.ret.closeBody}</p>
      <Input label={t.ret.closeWhy} placeholder={t.ret.closePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
    </Dialog>
  );
}

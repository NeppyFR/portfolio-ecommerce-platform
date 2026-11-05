"use client";

import { useEffect, useState } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { orders as ordersDict } from "@/i18n/dict/orders";
import { CARRIER } from "@/lib/brand";
import { formatChf } from "@/lib/format";
import { cancelOrder, editTracking, markDelivered, markPacked, MIN_REFUND, recordRefund, resolveAttention, shipOrder, unpack } from "@/store/actions/orders";
import type { ActionResult, Order } from "@/store/types";
import { Button, Checkbox, Dialog, Input, MoneyInput, RuleLine, Textarea, toast } from "@/ui";
import { orderActions, sizeAndColour, suggestedTracking, trackingHint, type OrderAction } from "./rules/order-rules";
import { remainingRappen } from "./rules/returns";
import { Stepper } from "./Stepper";

type Dict = typeof ordersDict.en;

function useRun(t: Dict, onDone: () => void) {
  return (result: ActionResult<unknown>, done: string) => {
    if (result.ok) {
      toast(done);
      onDone();
    } else toast(fmt(t.genericError, { message: result.message }));
  };
}

export function OrderActions({ order }: { order: Order }) {
  const t = useT(ordersDict);
  const [open, setOpen] = useState<OrderAction | null>(null);
  const actions = orderActions(order);
  const close = () => setOpen(null);
  const run = useRun(t, close);
  const labels: Record<OrderAction, string> = {
    pack: t.pack.open, unpack: t.unpack.open, ship: t.ship.open, deliver: t.deliver.open, tracking: t.tracking.open, refund: t.refund.open, cancel: t.cancel.open, resolve: t.resolve.open,
  };
  const number = order.orderNumber;
  if (actions.length === 0) return null;
  return (
    <div className="or-actions">
      {actions.map((action, i) => (
        <Button key={action} variant={action === "cancel" ? "danger" : i === 0 ? "solid" : "outline"} onClick={() => setOpen(action)}>
          {labels[action]}
        </Button>
      ))}

      <Dialog open={open === "pack"} onClose={close} title={fmt(t.pack.title, { number })} confirmLabel={t.pack.open} cancelLabel={t.backButton} onConfirm={() => run(markPacked(number), t.pack.done)}>
        <p className="type-body">{t.pack.body}</p>
      </Dialog>
      <Dialog open={open === "unpack"} onClose={close} title={fmt(t.unpack.title, { number })} confirmLabel={t.unpack.open} cancelLabel={t.backButton} onConfirm={() => run(unpack(number), t.unpack.done)}>
        <p className="type-body">{t.unpack.body}</p>
      </Dialog>
      <Dialog open={open === "deliver"} onClose={close} title={fmt(t.deliver.title, { number })} confirmLabel={t.deliver.open} cancelLabel={t.backButton} onConfirm={() => run(markDelivered(number), t.deliver.done)}>
        <p className="type-body">{t.deliver.body}</p>
      </Dialog>
      <ShipDialog order={order} open={open === "ship"} onClose={close} mode="ship" />
      <ShipDialog order={order} open={open === "tracking"} onClose={close} mode="tracking" />
      <RefundDialog order={order} open={open === "refund"} onClose={close} />
      <CancelDialog order={order} open={open === "cancel"} onClose={close} />
      <ResolveDialog order={order} open={open === "resolve"} onClose={close} />
    </div>
  );
}

function ShipDialog({ order, open, onClose, mode }: { order: Order; open: boolean; onClose: () => void; mode: "ship" | "tracking" }) {
  const t = useT(ordersDict);
  const run = useRun(t, onClose);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState<string>(CARRIER.name);
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setTracking(mode === "ship" ? suggestedTracking(order.orderNumber) : order.trackingNumber ?? "");
    setCarrier(order.trackingCarrier ?? CARRIER.name);
    setNotify(false);
    setError(null);
  }, [open, mode, order.orderNumber, order.trackingNumber, order.trackingCarrier]);
  const hint = trackingHint(tracking, carrier, CARRIER.name);
  const hintText = hint === null ? null : hint === "ok" ? t.tracking.ok : `${t.tracking[hint]} ${t.tracking.saveAnyway}`;
  const confirm = () => {
    if (!tracking.trim()) {
      setError(t.ship.required);
      return;
    }
    if (mode === "ship") run(shipOrder(order.orderNumber, tracking, carrier), t.ship.done);
    else run(editTracking(order.orderNumber, tracking, carrier, notify), t.tracking.done);
  };
  return (
    <Dialog open={open} onClose={onClose} title={mode === "ship" ? fmt(t.ship.title, { number: order.orderNumber }) : t.tracking.title} confirmLabel={mode === "ship" ? t.ship.confirm : t.tracking.confirm} cancelLabel={t.backButton} onConfirm={confirm}>
      <p className="type-body">{mode === "ship" ? t.ship.body : t.tracking.body}</p>
      <Input label={t.ship.trackingNumber} value={tracking} autoComplete="off" spellCheck={false} error={error} hint={hintText} onChange={(e) => { setTracking(e.target.value); setError(null); }} />
      <Input label={t.ship.carrier} value={carrier} autoComplete="off" onChange={(e) => setCarrier(e.target.value)} />
      {mode === "tracking" ? (
        order.customerErased ? <p className="type-small or-muted">{t.tracking.notifyErased}</p> : <Checkbox label={t.tracking.notify} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      ) : null}
    </Dialog>
  );
}

function RefundDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const lang = useLang();
  const run = useRun(t, onClose);
  const max = remainingRappen(order);
  const [amount, setAmount] = useState<number | null>(max);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState<Record<string, number>>({});
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!open) return;
    setAmount(max);
    setReason("");
    setRestock({});
    setInvalid(false);
  }, [open, max]);
  const confirm = () => {
    if (amount === null || amount < MIN_REFUND || amount > max) {
      setInvalid(true);
      return;
    }
    run(recordRefund(order.orderNumber, { amount, reason, restock }), t.refund.done);
  };
  const lines = order.items.map((i) => ({ item: i, room: Math.max(0, i.quantity - i.shortfall - i.restocked) })).filter((l) => l.room > 0);
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.refund.title, { number: order.orderNumber })} confirmLabel={t.refund.open} cancelLabel={t.backButton} onConfirm={confirm}>
      <p className="type-body">{fmt(t.refund.body, { max: formatChf(max) })}</p>
      <MoneyInput label={t.refund.amount} value={amount} onChange={(v) => { setAmount(v); setInvalid(false); }} error={invalid ? fmt(t.refund.invalid, { max: formatChf(max) }) : null} />
      <Input label={t.refund.reason} placeholder={t.refund.reasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
      {lines.length > 0 ? (
        <fieldset className="or-fieldset">
          <legend className="type-label">{t.refund.restock}</legend>
          {lines.map(({ item, room }) => {
            const name = lang === "de" ? item.nameDe : item.name;
            const label = fmt(t.refund.restockLabel, { name, size: sizeAndColour(item.size, item.color, lang) });
            return (
              <div key={item.id} className="or-step-row">
                <span className="type-small">{label}</span>
                <Stepper value={restock[item.id] ?? 0} max={room} onChange={(v) => setRestock((r) => ({ ...r, [item.id]: v }))} lessLabel={fmt(t.ret.less, { name })} moreLabel={fmt(t.ret.more, { name })} />
              </div>
            );
          })}
        </fieldset>
      ) : null}
    </Dialog>
  );
}

function CancelDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const run = useRun(t, onClose);
  const left = remainingRappen(order);
  const [reason, setReason] = useState("");
  const [fullRefund, setFullRefund] = useState(true);
  useEffect(() => {
    if (!open) return;
    setReason("");
    setFullRefund(order.refundedRappen === 0);
  }, [open, order.refundedRappen]);
  return (
    <Dialog open={open} onClose={onClose} danger title={fmt(t.cancel.title, { number: order.orderNumber })} confirmLabel={t.cancel.open} cancelLabel={t.backButton} onConfirm={() => run(cancelOrder(order.orderNumber, { reason, fullRefund: Boolean(order.paidAt) && fullRefund }), t.cancel.done)}>
      <p className="type-body">{t.cancel.body}</p>
      <Input label={t.cancel.reason} placeholder={t.cancel.reasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} />
      {order.paidAt && left > 0 ? <Checkbox label={fmt(t.cancel.fullRefund, { amount: formatChf(left) })} checked={fullRefund} onChange={(e) => setFullRefund(e.target.checked)} /> : null}
    </Dialog>
  );
}

function ResolveDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT(ordersDict);
  const run = useRun(t, onClose);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title={t.resolve.title} confirmLabel={t.resolve.open} cancelLabel={t.backButton} onConfirm={() => run(resolveAttention(order.orderNumber, note), t.resolve.done)}>
      <RuleLine>{t.resolve.body}</RuleLine>
      <Textarea label={t.resolve.note} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { inventory as dict } from "@/i18n/dict/inventory";
import { sizeAndColour } from "@/desk/commerce/orders/rules/order-rules";
import { adjustStock, setThreshold } from "@/store/actions/inventory";
import { Button, Checkbox, Dialog, Input, RuleLine, Select, Textarea, toast } from "@/ui";
import { ADJUST_REASONS, adjustDelta, parseAmount, reasonRule, type AdjustReason, type InventoryRow } from "./rules";

export function AdjustDialog({ row, lowStockDefault, onClose }: { row: InventoryRow | null; lowStockDefault: number; onClose: () => void }) {
  const t = useT(dict);
  const lang = useLang();
  const [reason, setReason] = useState<AdjustReason>("delivery");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ field: "amount" | "note"; text: string } | null>(null);
  const [thresholdText, setThresholdText] = useState("");
  const [useDefault, setUseDefault] = useState(true);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const variantId = row?.variantId ?? null;
  const threshold = row?.threshold ?? null;

  useEffect(() => {
    if (!variantId) return;
    setReason("delivery");
    setAmountText("");
    setNote("");
    setError(null);
    setUseDefault(threshold === null);
    setThresholdText(threshold === null ? "" : String(threshold));
    setThresholdError(null);
  }, [variantId, threshold]);

  const rule = reasonRule(reason);
  const amount = parseAmount(amountText);
  const delta = amount === null ? null : adjustDelta(reason, amount);
  const after = row && delta !== null ? row.onHand + delta : null;
  const amountLabel = rule.sign === "plus" ? t.adjust.added : rule.sign === "minus" ? t.adjust.removed : t.adjust.change;
  const label = row ? `${lang === "de" ? row.productNameDe : row.productName} · ${sizeAndColour(row.size, row.color, lang)}` : "";

  const save = () => {
    if (!row) return;
    const result = adjustStock({ variantId: row.variantId, reason, amount, note });
    if (result.ok) {
      toast(fmt(t.adjust.done, { sku: result.data.sku, before: result.data.before, after: result.data.after }));
      onClose();
      return;
    }
    if (result.code === "note") setError({ field: "note", text: t.adjust.errNote });
    else if (result.code === "below_zero") setError({ field: "amount", text: t.adjust.errBelow });
    else setError({ field: "amount", text: t.adjust.errAmount });
  };

  const saveThreshold = () => {
    if (!row) return;
    const next = useDefault ? null : Number(thresholdText.trim() === "" ? NaN : thresholdText);
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      setThresholdError(t.adjust.thresholdInvalid);
      return;
    }
    const result = setThreshold(row.variantId, next);
    if (result.ok) {
      toast(t.adjust.thresholdSaved);
      setThresholdError(null);
    } else setThresholdError(t.adjust.thresholdInvalid);
  };

  return (
    <Dialog open={Boolean(row)} onClose={onClose} title={fmt(t.adjust.openLabel, { label })} confirmLabel={t.adjust.save} cancelLabel={t.scan.cancel} onConfirm={save}>
      {row ? (
        <>
          <p className="type-small or-muted or-anywhere">{fmt(t.adjust.summary, { sku: row.sku, onHand: row.onHand, reserved: row.reserved })}</p>
          <RuleLine>{t.adjust.ruleOnce}</RuleLine>
          <Select label={t.adjust.reason} value={reason} onChange={(e) => { setReason(e.target.value as AdjustReason); setError(null); }}>
            {ADJUST_REASONS.map((r) => (
              <option key={r.reason} value={r.reason}>{t.reason[r.reason]}</option>
            ))}
          </Select>
          <Input label={amountLabel} inputMode={rule.sign === "either" ? "text" : "numeric"} autoComplete="off" value={amountText} error={error?.field === "amount" ? error.text : null} onChange={(e) => { setAmountText(e.target.value); setError(null); }} />
          <Textarea label={rule.noteRequired ? t.adjust.noteRequired : t.adjust.noteOptional} placeholder={reason === "delivery" ? t.adjust.notePlaceholderReceived : t.adjust.notePlaceholder} rows={2} value={note} error={error?.field === "note" ? error.text : null} onChange={(e) => { setNote(e.target.value); setError(null); }} />
          <p className="type-mono-s in-preview" aria-live="polite" data-under={(after !== null && after < row.reserved) || undefined}>
            {fmt(t.adjust.preview, { before: row.onHand, after: after ?? row.onHand })}
            {after !== null && after < row.reserved ? fmt(t.adjust.belowReserved, { reserved: row.reserved }) : ""}
          </p>
          <div className="in-threshold">
            <Input label={t.adjust.threshold} inputMode="numeric" autoComplete="off" disabled={useDefault} value={useDefault ? String(lowStockDefault) : thresholdText} error={thresholdError} onChange={(e) => { setThresholdText(e.target.value); setThresholdError(null); }} />
            <Checkbox label={fmt(t.adjust.useDefault, { n: lowStockDefault })} checked={useDefault} onChange={(e) => { setUseDefault(e.target.checked); setThresholdError(null); }} />
            <Button variant="outline" onClick={saveThreshold}>{t.adjust.saveThreshold}</Button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

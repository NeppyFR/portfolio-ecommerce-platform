"use client";

import { useState } from "react";
import { DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { seedRows } from "@/i18n/dict/seed-text";
import { formatChf, formatDate } from "@/lib/format";
import { VAT_REDUCED_BP, VAT_STANDARD_BP, VAT_ZERO_BP } from "@/lib/vat";
import { createEntry, editEntry } from "@/store/actions/finance";
import { useStore } from "@/store/core";
import type { LedgerCategory, LedgerEntry } from "@/store/types";
import { Button, DateInput, Input, Select, Sheet, Textarea, toast } from "@/ui";
import { readEntryDraft, suggestedVat, takesVat, type EntryDraft, type EntryProblem } from "../rules/ledger";

const moneyText = (minor: number) => (Math.abs(minor) / 100).toFixed(2);

const initial = (entry: LedgerEntry | null): EntryDraft => ({
  direction: entry && entry.amountRappen > 0 ? "in" : "out",
  amountText: entry ? moneyText(entry.amountRappen) : "",
  occurredOn: entry?.occurredOn ?? DEMO_TODAY,
  title: entry?.title ?? "",
  categoryId: entry?.categoryId ?? null,
  accountId: entry?.accountId ?? null,
  counterparty: entry?.counterparty ?? "",
  dropId: entry?.dropId ?? null,
  originalText: entry?.originalAmountMinor != null ? moneyText(entry.originalAmountMinor) : "",
  originalCurrency: entry?.originalCurrency ?? "",
  vatRateBp: entry?.vatRateBp ?? null,
  vatText: entry?.vatRappen != null ? moneyText(entry.vatRappen) : "",
  description: entry?.description ?? "",
});

function EntryForm({ entry, onDone, onCancel }: { entry: LedgerEntry | null; onDone: () => void; onCancel: () => void }) {
  const dict = useT(finance);
  const t = dict.ledger;
  const lang = useLang();
  const categories = useStore((s) => s.categories);
  const accounts = seedRows(useStore((s) => s.accounts), lang, "name");
  const drops = useStore((s) => s.drops);
  const vatOn = useStore((s) => s.settings.vatEnabled);
  const [draft, setDraft] = useState<EntryDraft>(() => initial(entry));
  const [problem, setProblem] = useState<EntryProblem | null>(null);
  const set = (next: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...next }));
  const category = categories.find((c) => c.id === draft.categoryId);
  const showVat = vatOn && takesVat(category);
  const name = (c: LedgerCategory) => (lang === "de" ? c.nameDe : c.nameEn);
  const usable = (kind: LedgerCategory["kind"]) => categories.filter((c) => c.kind === kind && (c.isActive || c.id === entry?.categoryId));
  const hint = category?.slug === "shop-sales" ? t.hintSales : category?.slug === "payment-fees" ? t.hintFees : category?.slug === "taxes-duties" ? t.hintTaxes : undefined;
  const offList = draft.vatRateBp !== null && ![VAT_STANDARD_BP, VAT_REDUCED_BP, VAT_ZERO_BP].includes(draft.vatRateBp);

  const submit = () => {
    const read = readEntryDraft(draft, showVat);
    if (!read.ok) {
      setProblem(read.problem);
      return;
    }
    setProblem(null);
    const values = !showVat && entry ? { ...read.values, vatRateBp: entry.vatRateBp, vatRappen: entry.vatRappen } : read.values;
    const result = entry ? editEntry(entry.id, values) : createEntry(values);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    toast(entry ? dict.shared.saved : t.added);
    onDone();
  };

  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="fin-note">{t.entryIntro}</p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="ui-field-label mb-1">{t.direction}</legend>
        <div className="fin-dirs">
          <label className="fin-dir">
            <input type="radio" className="ui-radio" name="direction" checked={draft.direction === "in"} onChange={() => set({ direction: "in" })} />
            {t.dirIn}
          </label>
          <label className="fin-dir">
            <input type="radio" className="ui-radio" name="direction" checked={draft.direction === "out"} onChange={() => set({ direction: "out" })} />
            {t.dirOut}
          </label>
        </div>
      </fieldset>
      <div className="fin-form-2">
        <Input
          label={t.amount}
          hint={t.amountHint}
          inputMode="decimal"
          value={draft.amountText}
          error={problem === "amount" ? t.errAmount : null}
          onChange={(e) => {
            const amountText = e.target.value;
            set({ amountText, ...(showVat && draft.vatRateBp !== null ? { vatText: suggestedVat(amountText, draft.vatRateBp) } : {}) });
          }}
        />
        <DateInput label={t.date} value={draft.occurredOn} error={problem === "date" ? t.errDate : null} onChange={(e) => set({ occurredOn: e.target.value })} />
      </div>
      <Input label={t.titleField} value={draft.title} maxLength={120} error={problem === "title" ? t.errTitle : null} onChange={(e) => set({ title: e.target.value })} />
      <Select label={t.category} value={draft.categoryId ?? ""} hint={hint} onChange={(e) => set({ categoryId: e.target.value || null })}>
        <option value="">{t.noCategory}</option>
        <optgroup label={t.groupIncome}>
          {usable("income").map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.groupExpense}>
          {usable("expense").map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.groupTransfer}>
          {usable("transfer").map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </optgroup>
      </Select>
      <div className="fin-form-2">
        <Select label={t.account} value={draft.accountId ?? ""} onChange={(e) => set({ accountId: e.target.value || null })}>
          <option value="">{t.noAccount}</option>
          {accounts.filter((a) => a.isActive || a.id === entry?.accountId).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select label={t.drop} value={draft.dropId ?? ""} onChange={(e) => set({ dropId: e.target.value || null })}>
          <option value="">{t.noDrop}</option>
          {drops.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <Input label={t.counterparty} hint={t.counterpartyHint} maxLength={80} value={draft.counterparty} onChange={(e) => set({ counterparty: e.target.value })} />
      <div className="fin-form-2">
        <Input label={t.original} hint={t.originalHint} inputMode="decimal" value={draft.originalText} error={problem === "original" ? t.errOriginal : null} onChange={(e) => set({ originalText: e.target.value })} />
        <Select label={t.currency} value={draft.originalCurrency} onChange={(e) => set({ originalCurrency: e.target.value })}>
          <option value="">{dict.shared.none}</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </Select>
      </div>
      {showVat ? (
        <div className="fin-form-2">
          <Select
            label={t.vatRate}
            value={draft.vatRateBp === null ? "" : String(draft.vatRateBp)}
            onChange={(e) => {
              const bp = e.target.value === "" ? null : Number(e.target.value);
              set({ vatRateBp: bp, vatText: suggestedVat(draft.amountText, bp) });
            }}
          >
            <option value="">{t.noVat}</option>
            <option value={VAT_STANDARD_BP}>{t.vatStandard}</option>
            <option value={VAT_REDUCED_BP}>{t.vatReduced}</option>
            <option value={VAT_ZERO_BP}>{t.vatZero}</option>
            {offList ? <option value={draft.vatRateBp as number}>{`${(draft.vatRateBp as number) / 100} %`}</option> : null}
          </Select>
          <Input label={t.vatAmount} hint={t.vatAmountHint} inputMode="decimal" disabled={draft.vatRateBp === null} value={draft.vatText} error={problem === "vat" ? t.errVat : null} onChange={(e) => set({ vatText: e.target.value })} />
        </div>
      ) : entry && entry.vatRateBp !== null && entry.vatRappen !== null ? (
        <p className="fin-note">{fmt(t.vatKept, { rate: entry.vatRateBp / 100, amount: formatChf(Math.abs(entry.vatRappen)) })}</p>
      ) : null}
      <Textarea label={t.description} hint={t.descriptionHint} rows={3} maxLength={2000} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      {entry ? <p className="fin-note fin-faint">{`${formatDate(entry.occurredOn)} · ${entry.source}`}</p> : null}
      <div className="fin-row">
        <Button type="submit">{dict.shared.save}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {dict.shared.cancel}
        </Button>
      </div>
    </form>
  );
}

/** `open` is `new` or an entry's id; any other value keeps this sheet shut. */
export function EntrySheet({ open, onClose }: { open: string | null; onClose: () => void }) {
  const { ledger: t } = useT(finance);
  const lang = useLang();
  const stored = useStore((s) => s.ledger).find((e) => e.id === open) ?? null;
  const entry = stored ? seedRows([stored], lang, "title", "description")[0] : null;
  const shown = open === "new" || !!entry;
  return (
    <Sheet open={shown} onClose={onClose} title={entry ? t.editEntry : t.newEntry}>
      {shown ? <EntryForm key={open ?? ""} entry={entry} onDone={onClose} onCancel={onClose} /> : null}
    </Sheet>
  );
}

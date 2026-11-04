"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DEMO_TODAY } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { seedRows } from "@/i18n/dict/seed-text";
import { formatChf, parseChf } from "@/lib/format";
import { LABEL } from "@/lib/brand";
import { categoryKindLocked, saveAccount, saveCategory } from "@/store/actions/finance";
import { useStore } from "@/store/core";
import type { Account, CategoryKind, LedgerCategory, ReportGroup } from "@/store/types";
import { Button, Checkbox, DateInput, IconButton, Input, Select, Sheet, toast } from "@/ui";
import { accountBalance } from "../rules/ledger";

const GROUPS: ReportGroup[] = ["production", "administration", "shipping", "equipment", "other"];

function CategoryForm({ category, onDone }: { category: LedgerCategory | null; onDone: () => void }) {
  const dict = useT(finance);
  const t = dict.ledger;
  const lines = dict.reports.lines;
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [nameDe, setNameDe] = useState(category?.nameDe ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? "expense");
  const [group, setGroup] = useState<ReportGroup | "">(category?.group ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [errors, setErrors] = useState<{ name?: string; group?: string }>({});
  const locked = category ? categoryKindLocked(category) : false;

  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const next: typeof errors = {};
        if (nameEn.trim() === "" || nameDe.trim() === "") next.name = t.errCatName;
        if (kind === "expense" && group === "") next.group = t.errCatGroup;
        setErrors(next);
        if (Object.keys(next).length) return;
        const result = saveCategory(category?.id ?? null, { nameEn, nameDe, kind, group: group || null, isActive });
        if (!result.ok) {
          toast(result.code === "kind_locked" ? t.kindLocked : result.message);
          return;
        }
        toast(category ? t.catSaved : t.catAdded);
        onDone();
      }}
    >
      <div className="fin-form-2">
        <Input label={t.catNameEn} maxLength={40} value={nameEn} error={errors.name} onChange={(e) => setNameEn(e.target.value)} />
        <Input label={t.catNameDe} maxLength={40} value={nameDe} onChange={(e) => setNameDe(e.target.value)} />
      </div>
      <Select label={t.kind} value={kind} disabled={locked} hint={locked ? t.kindLocked : undefined} onChange={(e) => setKind(e.target.value as CategoryKind)}>
        <option value="income">{t.kindIncome}</option>
        <option value="expense">{t.kindExpense}</option>
        <option value="transfer">{t.kindTransfer}</option>
      </Select>
      {kind === "expense" ? (
        <Select label={t.reportGroup} value={group} hint={t.reportGroupHint} error={errors.group} onChange={(e) => setGroup(e.target.value as ReportGroup | "")}>
          <option value="">{t.pickGroup}</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {lines[g]}
            </option>
          ))}
        </Select>
      ) : null}
      {category ? <Checkbox label={dict.shared.inUse} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> : null}
      <div className="fin-row">
        <Button type="submit">{dict.shared.save}</Button>
        <Button variant="ghost" onClick={onDone}>
          {dict.shared.cancel}
        </Button>
      </div>
    </form>
  );
}

export function CategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dict = useT(finance);
  const t = dict.ledger;
  const lang = useLang();
  const categories = useStore((s) => s.categories);
  const [editing, setEditing] = useState<string | null>(null);
  const editingRow = categories.find((c) => c.id === editing) ?? null;
  const kindWord = { income: t.kindIncome, expense: t.kindExpense, transfer: t.kindTransfer };
  return (
    <Sheet open={open} onClose={onClose} title={t.categories}>
      <div className="fin-stack">
        <p className="fin-note">{t.catIntro}</p>
        {editing ? (
          <CategoryForm key={editing} category={editingRow} onDone={() => setEditing(null)} />
        ) : (
          <>
            <ul className="fin-list">
              {categories.map((c) => (
                <li key={c.id}>
                  <div className="fin-list-t">
                    <b>{lang === "de" ? c.nameDe : c.nameEn}</b>
                    <span>{[kindWord[c.kind], c.group ? dict.reports.lines[c.group] : "", c.isActive ? "" : dict.shared.off].filter(Boolean).join(" · ")}</span>
                  </div>
                  <IconButton aria-label={`${dict.shared.edit}: ${lang === "de" ? c.nameDe : c.nameEn}`} onClick={() => setEditing(c.id)}>
                    <Pencil size={15} aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="outline" onClick={() => setEditing("new")}>
                <Plus size={15} aria-hidden="true" />
                {t.catAdd}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function AccountForm({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const dict = useT(finance);
  const t = dict.ledger;
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<Account["kind"]>(account?.kind ?? "bank");
  const [opening, setOpening] = useState(account ? (account.openingRappen / 100).toFixed(2) : "0.00");
  const [openingOn, setOpeningOn] = useState(account?.openingOn ?? DEMO_TODAY);
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [errors, setErrors] = useState<{ name?: string; opening?: string }>({});
  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const openingRappen = parseChf(opening);
        const next: typeof errors = {};
        if (name.trim() === "") next.name = t.errAccName;
        if (openingRappen === null) next.opening = t.errOpening;
        setErrors(next);
        if (Object.keys(next).length || openingRappen === null) return;
        const result = saveAccount(account?.id ?? null, { name, kind, openingRappen, openingOn, isActive });
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast(account ? t.accSaved : t.accAdded);
        onDone();
      }}
    >
      <Input label={t.accName} maxLength={40} value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
      <Select label={t.accType} value={kind} onChange={(e) => setKind(e.target.value as Account["kind"])}>
        <option value="bank">{t.typeBank}</option>
        <option value="stripe">{t.typeStripe}</option>
        <option value="cash">{t.typeCash}</option>
      </Select>
      <div className="fin-form-2">
        <Input label={t.opening} hint={t.openingHint} inputMode="decimal" value={opening} error={errors.opening} onChange={(e) => setOpening(e.target.value)} />
        <DateInput label={t.openingDate} value={openingOn} onChange={(e) => setOpeningOn(e.target.value)} />
      </div>
      <Checkbox label={dict.shared.inUse} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      <div className="fin-row">
        <Button type="submit">{dict.shared.save}</Button>
        <Button variant="ghost" onClick={onDone}>
          {dict.shared.cancel}
        </Button>
      </div>
    </form>
  );
}

export function AccountsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dict = useT(finance);
  const t = dict.ledger;
  const lang = useLang();
  const accounts = seedRows(useStore((s) => s.accounts), lang, "name");
  const entries = useStore((s) => s.ledger);
  const [editing, setEditing] = useState<string | null>(null);
  const editingRow = accounts.find((a) => a.id === editing) ?? null;
  const typeWord = { bank: t.typeBank, stripe: t.typeStripe, cash: t.typeCash };
  return (
    <Sheet open={open} onClose={onClose} title={t.accounts}>
      <div className="fin-stack">
        <p className="fin-note">{fmt(t.accIntro, { brand: LABEL.name })}</p>
        {editing ? (
          <AccountForm key={editing} account={editingRow} onDone={() => setEditing(null)} />
        ) : (
          <>
            <ul className="fin-list">
              {accounts.map((a) => (
                <li key={a.id}>
                  <div className="fin-list-t">
                    <b>{a.name}</b>
                    <span>{[typeWord[a.kind], a.isActive ? "" : dict.shared.off].filter(Boolean).join(" · ")}</span>
                  </div>
                  <span className="fin-row" style={{ flexWrap: "nowrap" }}>
                    <span className="type-mono">{formatChf(accountBalance(a, entries))}</span>
                    <IconButton aria-label={`${dict.shared.edit}: ${a.name}`} onClick={() => setEditing(a.id)}>
                      <Pencil size={15} aria-hidden="true" />
                    </IconButton>
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="outline" onClick={() => setEditing("new")}>
                <Plus size={15} aria-hidden="true" />
                {t.accAdd}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

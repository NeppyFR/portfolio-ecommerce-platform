"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Search, Trash2, TriangleAlert, Wallet, CircleCheck } from "lucide-react";
import { PageHead } from "@/desk/shell/PageHead";
import { DEMO_MONTH } from "@/store/clock";
import { fmt, useLang, useT } from "@/i18n";
import { finance } from "@/i18n/dict/finance";
import { seedRows, seedText } from "@/i18n/dict/seed-text";
import { formatChf, formatDate, formatMinor, formatMonth } from "@/lib/format";
import { unbookedIn } from "@/lib/running-costs";
import { deleteEntry } from "@/store/actions/finance";
import { identityOf } from "@/store/actions/profile";
import { useStore } from "@/store/core";
import type { LedgerEntry, PurchaseOrder } from "@/store/types";
import { Button, Dialog, Empty, IconButton, Input, Money, Pager, RuleLine, Select, Table, toast, usePageSize, type Column } from "@/ui";
import { accountBalance, bookBalance, filterEntries, isFiltered, moneyInOut, monthsWithEntries, newestFirst, notOnAccount, runningBalances, uncategorised, NO_FILTER, type LedgerFilter } from "../rules/ledger";
import { useCategoryName } from "../shared";
import { setParam } from "@/lib/routes";
import { EntrySheet } from "./EntrySheet";
import { AccountsSheet, CategoriesSheet } from "./SetupSheets";
import { MoneyMap } from "./MoneyMap";
import { Receipts } from "./Receipts";

const poAmount = (po: PurchaseOrder): number => po.shippingMinor + po.lines.reduce((sum, l) => sum + l.quantity * l.unitCostMinor, 0);

export function LedgerScreen() {
  const dict = useT(finance);
  const t = dict.ledger;
  const lang = useLang();
  const params = useSearchParams();
  const open = params.get("open");

  const storedEntries = useStore((s) => s.ledger);
  const storedAccounts = useStore((s) => s.accounts);
  const entries = useMemo(() => seedRows(storedEntries, lang, "title", "description"), [storedEntries, lang]);
  const accounts = useMemo(() => seedRows(storedAccounts, lang, "name"), [storedAccounts, lang]);
  const categories = useStore((s) => s.categories);
  const drops = useStore((s) => s.drops);
  const costs = useStore((s) => s.costs);
  const bookings = useStore((s) => s.costBookings);
  const orders = useStore((s) => s.purchaseOrders);
  const vatOn = useStore((s) => s.settings.vatEnabled);
  const categoryName = useCategoryName();

  const [filter, setFilter] = useState<LedgerFilter>(NO_FILTER);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);
  const pageSize = usePageSize();

  const patch = (next: Partial<LedgerFilter>) => {
    setFilter((f) => ({ ...f, ...next }));
    setPage(1);
  };

  const balances = useMemo(() => runningBalances(entries, accounts), [entries, accounts]);
  const balance = bookBalance(entries, accounts);
  const filtered = useMemo(() => newestFirst(filterEntries(entries, filter)), [entries, filter]);
  const active = isFiltered(filter);
  const flow = moneyInOut(active ? filtered : entries);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * pageSize, current * pageSize);
  const months = useMemo(() => monthsWithEntries(entries), [entries]);
  const loose = notOnAccount(entries);
  const uncat = uncategorised(entries);

  const unbooked = unbookedIn(costs, bookings, DEMO_MONTH);
  const unbookedPo = orders.filter((po) => po.status === "received" && po.financeEntryId === null);
  const poAmounts = [...new Set(unbookedPo.map((po) => po.currency))].map((currency) => formatMinor(unbookedPo.filter((po) => po.currency === currency).reduce((sum, po) => sum + poAmount(po), 0), currency)).join(", ");

  const chips = accounts.filter((a) => a.isActive || accountBalance(a, entries) !== 0);
  const dropName = (id: string | null) => drops.find((d) => d.id === id)?.name ?? "";
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const category = (id: string | null) => categories.find((c) => c.id === id);

  const tags = (e: LedgerEntry) => [e.counterparty, dropName(e.dropId), e.originalAmountMinor !== null && e.originalCurrency ? formatMinor(e.originalAmountMinor, e.originalCurrency) : ""].filter(Boolean).join(" · ");
  const vatText = (e: LedgerEntry) => (e.vatRateBp === null || e.vatRappen === null ? "–" : `${e.vatRateBp / 100} % · ${formatChf(Math.abs(e.vatRappen), { symbol: false })}`);
  const actions = (e: LedgerEntry) => (
    <span className="fin-acts">
      <IconButton aria-label={fmt(t.editAria, { title: e.title })} onClick={() => setParam("open", e.id)}>
        <Pencil size={15} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label={fmt(t.deleteAria, { title: e.title })} onClick={() => setDeleting(e)}>
        <Trash2 size={15} aria-hidden="true" />
      </IconButton>
    </span>
  );

  const columns: Column<LedgerEntry>[] = [
    { key: "date", header: t.colDate, cell: (e) => <span className="type-mono-s">{formatDate(e.occurredOn)}</span>, width: "92px" },
    {
      key: "title",
      header: t.colTitle,
      cell: (e) => (
        <span className="fin-entry-t" style={{ display: "block" }}>
          <b>{e.title}</b>
          {tags(e) ? <span className="fin-entry-tags">{tags(e)}</span> : null}
          {e.description ? <span className="fin-entry-desc">{e.description}</span> : null}
        </span>
      ),
    },
    { key: "cat", header: t.colCategory, cell: (e) => (category(e.categoryId) ? categoryName(category(e.categoryId)) : <span className="fin-italic">{t.uncategorised}</span>) },
    { key: "amount", header: t.colAmount, align: "right", cell: (e) => <Money value={e.amountRappen} signed /> },
    ...(vatOn ? [{ key: "vat", header: t.colVat, align: "right" as const, cell: (e: LedgerEntry) => <span className="type-mono-s">{vatText(e)}</span> }] : []),
    { key: "balance", header: t.colBalance, align: "right", cell: (e) => <BalanceCell value={balances.get(e.id) ?? 0} /> },
    { key: "acc", header: t.colAccount, cell: (e) => accountName(e.accountId) || "–" },
    {
      key: "by",
      header: <span className="sr-only">{t.colBy}</span>,
      width: "44px",
      cell: (e) => {
        const who = identityOf(e.createdBy);
        return (
          <span className="fin-who" title={who.name}>
            <span aria-hidden="true">{who.initials}</span>
            <span className="sr-only">{who.name}</span>
          </span>
        );
      },
    },
    { key: "rc", header: t.colReceipts, cell: (e) => <Receipts entry={e} /> },
    { key: "actions", header: <span className="sr-only">{t.colActions}</span>, align: "right", cell: actions },
  ];

  return (
    <div className="fin-cq">
      <PageHead
        id="ledger"
        title={fmt(t.title, { chf: formatChf(balance) })}
        rule={<RuleLine>{t.rule}</RuleLine>}
        actions={
          <Button onClick={() => setParam("open", "new")}>
            <Plus size={15} aria-hidden="true" />
            {t.newEntry}
          </Button>
        }
      />

      <div className="fin-shell">
        <aside className="fin-a fin-glow">
          <div>
            <span className="fin-total-k">{t.balance}</span>
            <span className="fin-big" data-low={balance < 0 || undefined}>
              {formatChf(balance)}
            </span>
            <span className="fin-total-s">{fmt(entries.length === 1 ? t.entryOne : t.entryMany, { n: entries.length })}</span>
            {balance < 0 ? <span className="fin-chip mt-1" data-tone="bad">{t.inDebt}</span> : null}
            <div className="mt-4">
              <div className="fin-total-mini">
                <span className="fin-total-k">{t.moneyIn}</span>
                <b>{formatChf(flow.moneyIn)}</b>
              </div>
              <div className="fin-total-mini">
                <span className="fin-total-k">{t.moneyOut}</span>
                <b>{formatChf(flow.moneyOut)}</b>
              </div>
              {active ? <span className="fin-total-s">{fmt(t.forShown, { n: filtered.length })}</span> : null}
            </div>
          </div>
        </aside>

        <section className="fin-b fin-stack" aria-label={t.accounts}>
          <div className="fin-between">
            <h2 className="fin-h3">{t.accounts}</h2>
            <span className="fin-row">
              <Button variant="ghost" onClick={() => setParam("open", "categories")}>
                {t.categories}
              </Button>
              <Button variant="ghost" onClick={() => setParam("open", "accounts")}>
                {t.accounts}
              </Button>
            </span>
          </div>
          {chips.length === 0 ? (
            <p className="fin-note">{t.noAccounts}</p>
          ) : (
            <div className="fin-acc-row">
              {chips.map((account) => {
                const value = accountBalance(account, entries);
                return (
                  <button key={account.id} type="button" className="fin-acc" aria-pressed={filter.account === account.id} data-low={value < 0 || undefined} onClick={() => patch({ account: filter.account === account.id ? "" : account.id })}>
                    {account.name}
                    <span>{formatChf(value)}</span>
                  </button>
                );
              })}
              {loose !== 0 ? (
                <span className="fin-acc" data-static="true">
                  {t.notOnAccount}
                  <span>{formatChf(loose)}</span>
                </span>
              ) : null}
            </div>
          )}

          <Input
            label={<span className="sr-only">{t.search}</span>}
            type="search"
            placeholder={t.search}
            value={filter.q}
            onChange={(e) => patch({ q: e.target.value })}
            aria-label={t.search}
          />
          <div className="fin-filters">
            <Select label={t.month} value={filter.month} onChange={(e) => patch({ month: e.target.value })}>
              <option value="">{t.allMonths}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m, lang)}
                </option>
              ))}
            </Select>
            <Select label={t.category} value={filter.category} onChange={(e) => patch({ category: e.target.value })}>
              <option value="">{t.allCategories}</option>
              <option value="none">{t.uncategorised}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c)}
                </option>
              ))}
            </Select>
            <Select label={t.account} value={filter.account} onChange={(e) => patch({ account: e.target.value })}>
              <option value="">{t.allAccounts}</option>
              <option value="none">{t.noAccount}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select label={t.drop} value={filter.drop} onChange={(e) => patch({ drop: e.target.value })}>
              <option value="">{t.allDrops}</option>
              <option value="none">{t.noDrop}</option>
              {drops.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          {active ? (
            <div className="fin-row">
              <Button variant="ghost" onClick={() => patch(NO_FILTER)}>
                {t.clearFilters}
              </Button>
              <span className="type-mono-s">{fmt(t.shownOf, { n: filtered.length, total: entries.length })}</span>
            </div>
          ) : null}
          {uncat > 0 && filter.category !== "none" ? (
            <p className="fin-note">
              {fmt(uncat === 1 ? t.uncatOne : t.uncatMany, { n: uncat })}{" "}
              <button type="button" className="fin-link" onClick={() => patch({ category: "none" })}>
                {t.showThem}
              </button>
            </p>
          ) : null}
        </section>

        <aside className="fin-c" aria-label={t.warnings}>
          <h2 className="fin-h">{t.warnings}</h2>
          {unbooked.length === 0 && unbookedPo.length === 0 ? (
            <p className="fin-warn">
              <CircleCheck size={15} style={{ color: "var(--ok)" }} aria-hidden="true" />
              <span>{t.allClear}</span>
            </p>
          ) : null}
          {unbooked.length ? (
            <div className="fin-warn">
              <TriangleAlert size={15} aria-hidden="true" />
              <div>
                <p>{unbooked.length === 1 ? fmt(t.unbookedOne, { label: seedText(unbooked[0].label, lang), month: DEMO_MONTH }) : fmt(t.unbookedMany, { n: unbooked.length, month: DEMO_MONTH, labels: unbooked.map((c) => seedText(c.label, lang)).join(", ") })}</p>
                <Link className="fin-link" href="/desk/finance/costs/">
                  {t.bookThem}
                </Link>
              </div>
            </div>
          ) : null}
          {unbookedPo.length ? (
            <div className="fin-warn">
              <TriangleAlert size={15} aria-hidden="true" />
              <div>
                <p>{fmt(unbookedPo.length === 1 ? t.productionOne : t.productionMany, { n: unbookedPo.length, amounts: poAmounts })}</p>
                <p className="fin-note">{t.productionHint}</p>
                <Link className="fin-link" href="/desk/production/?show=received">
                  {t.openProduction}
                </Link>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="fin-panel fin-ledger">
        <Table
          caption={t.tableCaption}
          columns={columns}
          rows={shown}
          rowKey={(e) => e.id}
          empty={
            entries.length === 0 ? (
              <Empty icon={Wallet}>
                <b>{t.emptyTitle}</b> {t.emptyBody}
              </Empty>
            ) : (
              <Empty icon={Search}>{t.noMatch}</Empty>
            )
          }
          phoneRow={(e) => (
            <div className="fin-pcard">
              <div className="fin-pcard-top">
                <div>
                  <b>{e.title}</b>
                  <span className="fin-pcard-sub">{`${formatDate(e.occurredOn)} · ${identityOf(e.createdBy).name}`}</span>
                </div>
                <Money value={e.amountRappen} signed />
              </div>
              <span className="fin-pcard-sub">{[category(e.categoryId) ? categoryName(category(e.categoryId)) : t.uncategorised, accountName(e.accountId), tags(e), vatOn ? vatText(e) : ""].filter(Boolean).join(" · ")}</span>
              {e.description ? <span className="fin-entry-desc">{e.description}</span> : null}
              <span className="fin-pcard-sub">{fmt(t.balanceAfter, { amount: formatChf(balances.get(e.id) ?? 0) })}</span>
              <div className="fin-pcard-foot">
                <Receipts entry={e} />
                {actions(e)}
              </div>
            </div>
          )}
        />
        {pages > 1 ? <Pager page={current} pages={pages} onPage={setPage} className="mt-3" /> : null}
      </div>

      <MoneyMap />

      <EntrySheet open={open} onClose={() => setParam("open", null)} />
      <CategoriesSheet open={open === "categories"} onClose={() => setParam("open", null)} />
      <AccountsSheet open={open === "accounts"} onClose={() => setParam("open", null)} />
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t.deleteTitle}
        danger
        confirmLabel={dict.shared.delete}
        cancelLabel={dict.shared.back}
        onConfirm={() => {
          if (!deleting) return;
          const result = deleteEntry(deleting.id);
          setDeleting(null);
          if (result.ok) toast(t.deleted);
        }}
      >
        {deleting ? <p>{fmt(t.deleteBody, { title: deleting.title, amount: formatChf(deleting.amountRappen) })}</p> : null}
      </Dialog>
    </div>
  );
}

function BalanceCell({ value }: { value: number }) {
  return <span className={value < 0 ? "fin-rose type-mono" : "type-mono"}>{formatChf(value)}</span>;
}

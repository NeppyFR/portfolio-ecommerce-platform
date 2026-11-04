"use client";

import { Ban, CalendarClock, Check, CircleSlash, Copy, Hourglass, Pencil, Plus, Tag, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { amountText, AmountField, CheckList, emptyToNull, FormError, NoRowClick, parseAmount, parseWhole, Pill, SearchField, TableCard, TabLabel, useOpenParam } from "@/desk/commerce/products/shared";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, plural, useLang, useT } from "@/i18n";
import { discounts as dict } from "@/i18n/dict/discounts";
import { discountState, MAX_PERCENT } from "@/lib/discount-rules";
import { formatChf, formatDate, formatDateTime } from "@/lib/format";
import { setParam, setParams } from "@/lib/routes";
import { copyCode, createDiscount, duplicateDiscount, saveDiscount, toggleDiscount, type DiscountInput } from "@/store/actions/discounts";
import { DEMO_TODAY } from "@/store/clock";
import { useStore } from "@/store/core";
import type { Discount, DiscountScope, DiscountState, DiscountType, Tone } from "@/store/types";
import { Button, DateInput, Dialog, Empty, IconButton, Input, RuleLine, Select, Sheet, Switch, Table, Tabs, Textarea, toast, type Column } from "@/ui";

const STATES: DiscountState[] = ["active", "scheduled", "expired", "used_up", "disabled"];
const STATE_LOOK: Record<DiscountState, { tone: Tone | "plan"; icon: LucideIcon }> = {
  active: { tone: "ok", icon: Check },
  scheduled: { tone: "plan", icon: CalendarClock },
  expired: { tone: "off", icon: Hourglass },
  used_up: { tone: "warn", icon: CircleSlash },
  disabled: { tone: "off", icon: Ban },
};

type T = (typeof dict)["en"];

const stateOf = (d: Discount): DiscountState => discountState(d, DEMO_TODAY);

function StateBadge({ state, t }: { state: DiscountState; t: T }) {
  const look = STATE_LOOK[state];
  return (
    <Pill tone={look.tone} icon={look.icon}>
      {t.state[state]}
    </Pill>
  );
}

function valueText(d: Pick<Discount, "type" | "value">, t: T): string {
  if (d.type === "percent") return `${d.value} %`;
  if (d.type === "fixed") return formatChf(d.value);
  return t.type.free_shipping;
}

function scopeText(d: Discount, t: T): string {
  const base =
    d.scope === "products"
      ? fmt(plural(d.productIds.length, t.productCountOne, t.productCount), { n: d.productIds.length })
      : d.scope === "collections"
        ? fmt(plural(d.collectionIds.length, t.collectionCountOne, t.collectionCount), { n: d.collectionIds.length })
        : t.scope.all;
  return d.minOrderRappen > 0 ? `${base} · ${fmt(t.from, { amount: formatChf(d.minOrderRappen) })}` : base;
}

function windowText(d: Discount, state: DiscountState, t: T): string {
  if (state === "scheduled" && d.startDay) return fmt(t.window.starts, { date: formatDate(d.startDay) });
  if (state === "expired") return d.endDay ? fmt(t.window.ended, { date: formatDate(d.endDay) }) : t.window.endedNoDate;
  if (state === "used_up") return fmt(t.window.usedUp, { n: d.usageLimit ?? d.timesUsed });
  if (state === "disabled") return t.window.off;
  return d.endDay ? fmt(t.window.until, { date: formatDate(d.endDay) }) : t.window.noEnd;
}

const usedText = (d: Pick<Discount, "timesUsed" | "usageLimit">): string => (d.usageLimit === null ? String(d.timesUsed) : `${d.timesUsed} / ${d.usageLimit}`);

function DiscountForm({ row, onDone }: { row: Discount | null; onDone: () => void }) {
  const t = useT(dict);
  const lang = useLang();
  const products = useStore((s) => s.products);
  const collections = useStore((s) => s.collections);
  const [code, setCode] = useState(row?.code ?? "");
  const [type, setType] = useState<DiscountType>(row?.type ?? "percent");
  const [percent, setPercent] = useState(row?.type === "percent" ? String(row.value) : "");
  const [amount, setAmount] = useState(row?.type === "fixed" ? amountText(row.value) : "");
  const [minOrder, setMinOrder] = useState(row && row.minOrderRappen > 0 ? amountText(row.minOrderRappen) : "");
  const [limit, setLimit] = useState(row?.usageLimit != null ? String(row.usageLimit) : "");
  const [startDay, setStartDay] = useState(row ? (row.startDay ?? "") : DEMO_TODAY);
  const [endDay, setEndDay] = useState(row?.endDay ?? "");
  const [scope, setScope] = useState<DiscountScope>(row?.scope ?? "all");
  const [productIds, setProductIds] = useState<string[]>(row?.productIds ?? []);
  const [collectionIds, setCollectionIds] = useState<string[]>(row?.collectionIds ?? []);
  const [note, setNote] = useState(row?.description ?? "");
  const [enabled, setEnabled] = useState(row?.isEnabled ?? true);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    const value = type === "percent" ? parseWhole(percent) : type === "fixed" ? parseAmount(amount) : 0;
    const input: DiscountInput = { code, type, value, scope, productIds, collectionIds, minOrderRappen: parseAmount(minOrder), usageLimit: parseWhole(limit), startDay: emptyToNull(startDay), endDay: emptyToNull(endDay), isEnabled: enabled, description: note };
    if (row) {
      const result = saveDiscount(row.id, input);
      if (!result.ok) {
        setProblem(result.code);
        return;
      }
      toast(t.saved);
    } else {
      const result = createDiscount(input);
      if (!result.ok) {
        setProblem(result.code);
        return;
      }
      toast(fmt(t.created, { code: result.data.code }));
    }
    onDone();
  };

  const err = (key: string, text: string) => (problem === key ? text : null);
  return (
    <form
      className="cat-stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="type-small cat-sub">{t.editor.description}</p>
      {row ? (
        <>
          <dl className="cat-facts">
            <div>
              <dt>{t.stats.state}</dt>
              <dd>
                <StateBadge state={stateOf(row)} t={t} />
              </dd>
            </div>
            <div>
              <dt>{t.stats.used}</dt>
              <dd className="cat-mono">{row.usageLimit === null ? row.timesUsed : fmt(t.stats.usedOf, { used: row.timesUsed, limit: row.usageLimit })}</dd>
            </div>
            <div>
              <dt>{t.stats.given}</dt>
              <dd className="cat-mono">{formatChf(row.redeemedRappen)}</dd>
            </div>
            <div>
              <dt>{t.stats.lastUsed}</dt>
              <dd className="cat-mono">{row.lastUsedAt ? formatDateTime(row.lastUsedAt) : t.never}</dd>
            </div>
          </dl>
          {row.timesUsed > 0 ? <p className="type-small cat-note">{t.form.alreadyUsed}</p> : null}
        </>
      ) : null}
      <div className="cat-fields">
        <Input label={t.form.code} hint={t.form.codeHint} className="cat-span" value={code} maxLength={30} error={err("code", t.error.code) ?? err("code_taken", t.error.codeTaken)} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Select label={t.form.type} value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
          {(["percent", "fixed", "free_shipping"] as const).map((v) => (
            <option key={v} value={v}>
              {t.type[v]}
            </option>
          ))}
        </Select>
        {type === "percent" ? <Input label={t.form.percent} hint={t.form.percentHint} inputMode="numeric" value={percent} error={err("percent", fmt(t.error.percent, { max: MAX_PERCENT }))} onChange={(e) => setPercent(e.target.value)} /> : null}
        {type === "fixed" ? <AmountField label={t.form.amount} hint={t.form.amountHint} text={amount} onText={setAmount} error={err("fixed", t.error.amount)} /> : null}
        {type === "free_shipping" ? <span aria-hidden="true" /> : null}
        <AmountField label={t.form.minOrder} hint={t.form.minOrderHint} placeholder={t.form.minOrderPlaceholder} text={minOrder} onText={setMinOrder} error={err("min_order", t.error.minOrder)} />
        <Input label={t.form.usageLimit} hint={t.form.usageLimitHint} placeholder={t.form.usageLimitPlaceholder} inputMode="numeric" value={limit} error={err("usage_limit", t.error.usageLimit)} onChange={(e) => setLimit(e.target.value)} />
        <DateInput label={t.form.firstDay} hint={t.form.firstDayHint} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
        <DateInput label={t.form.lastDay} hint={t.form.lastDayHint} value={endDay} error={err("dates", t.error.dates)} onChange={(e) => setEndDay(e.target.value)} />
        <Select label={t.form.appliesTo} className="cat-span" value={scope} onChange={(e) => setScope(e.target.value as DiscountScope)}>
          {(["all", "products", "collections"] as const).map((v) => (
            <option key={v} value={v}>
              {t.scope[v]}
            </option>
          ))}
        </Select>
      </div>
      {scope === "products" ? (
        <CheckList
          legend={fmt(t.form.products, { n: productIds.length })}
          empty={t.form.noProducts}
          selected={productIds}
          onChange={setProductIds}
          items={products.map((p) => ({ id: p.id, label: `${lang === "de" ? p.nameDe : p.nameEn}${p.status === "draft" ? ` (${t.form.statusDraft})` : p.status === "archived" ? ` (${t.form.statusArchived})` : ""}` }))}
        />
      ) : null}
      {scope === "collections" ? (
        <CheckList
          legend={fmt(t.form.collections, { n: collectionIds.length })}
          empty={t.form.noCollections}
          selected={collectionIds}
          onChange={setCollectionIds}
          items={collections.map((c) => ({ id: c.id, label: `${lang === "de" ? c.nameDe : c.nameEn}${c.isActive ? "" : ` (${t.form.hidden})`}` }))}
        />
      ) : null}
      <FormError>{err("scope", t.error.scope)}</FormError>
      <Textarea label={t.form.note} hint={t.form.noteHint} rows={2} maxLength={200} value={note} error={err("note", t.error.note)} onChange={(e) => setNote(e.target.value)} />
      <Switch label={enabled ? t.form.enabledOn : t.form.enabledOff} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      <div>
        <Button type="submit">{row ? t.form.save : t.form.create}</Button>
      </div>
    </form>
  );
}

export function DiscountsScreen() {
  const t = useT(dict);
  const params = useSearchParams();
  const all = useStore((s) => s.discounts);
  const [openId, setOpen] = useOpenParam();
  const [dupId, setDupId] = useState<string | null>(null);
  const q = params.get("q") ?? "";
  const stateParam = params.get("state") as DiscountState | null;
  const tab: DiscountState | "all" = stateParam && STATES.includes(stateParam) ? stateParam : "all";

  const matching = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((d) => d.code.toLowerCase().includes(needle) || d.description.toLowerCase().includes(needle)) : all;
  }, [all, q]);
  const counts = useMemo(() => {
    const out: Record<DiscountState | "all", number> = { all: matching.length, active: 0, scheduled: 0, expired: 0, used_up: 0, disabled: 0 };
    for (const d of matching) out[stateOf(d)] += 1;
    return out;
  }, [matching]);
  const totals = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    for (const d of all) {
      const state = stateOf(d);
      if (state === "active") active += 1;
      if (state === "scheduled") scheduled += 1;
    }
    return { active, scheduled };
  }, [all]);
  const rows = useMemo(() => (tab === "all" ? matching : matching.filter((d) => stateOf(d) === tab)), [matching, tab]);
  const given = rows.reduce((sum, d) => sum + d.redeemedRappen, 0);

  const editing = openId && openId !== "new" ? (all.find((d) => d.id === openId) ?? null) : null;
  const sheetOpen = openId === "new" || editing !== null;
  const dup = dupId ? (all.find((d) => d.id === dupId) ?? null) : null;

  useEffect(() => {
    if (dupId && !dup) setDupId(null);
  }, [dupId, dup]);

  const onToggle = (d: Discount) => {
    const result = toggleDiscount(d.id);
    if (result.ok) toast(fmt(result.data.isEnabled ? t.switchedOn : t.switchedOff, { code: d.code }));
  };
  const onDuplicate = () => {
    if (!dup) return;
    const result = duplicateDiscount(dup.id);
    setDupId(null);
    if (result.ok) toast(fmt(t.duplicate.done, { code: result.data.code }));
  };
  const actions = (d: Discount) => (
    <NoRowClick>
      <Switch aria-label={fmt(t.switchLabel, { code: d.code })} checked={d.isEnabled} onChange={() => onToggle(d)} />
      <IconButton aria-label={fmt(t.editor.editLabel, { code: d.code })} title={fmt(t.editor.editLabel, { code: d.code })} onClick={() => setOpen(d.id)}>
        <Pencil size={16} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label={fmt(t.duplicate.label, { code: d.code })} title={fmt(t.duplicate.label, { code: d.code })} onClick={() => setDupId(d.id)}>
        <Copy size={16} aria-hidden="true" />
      </IconButton>
    </NoRowClick>
  );
  const columns: Column<Discount>[] = [
    {
      key: "code",
      header: t.col.code,
      cell: (d) => (
        <span className="cat-prod-text">
          <span className="cat-mono cat-name">{d.code}</span>
          <span className="type-small cat-sub">{d.description || "–"}</span>
        </span>
      ),
    },
    {
      key: "discount",
      header: t.col.discount,
      cell: (d) => (
        <span className="cat-prod-text">
          <span className="cat-mono">{valueText(d, t)}</span>
          <span className="type-small cat-sub">{scopeText(d, t)}</span>
        </span>
      ),
    },
    {
      key: "state",
      header: t.col.state,
      cell: (d) => {
        const state = stateOf(d);
        return (
          <span className="cat-prod-text cat-state-cell">
            <StateBadge state={state} t={t} />
            <span className="type-small cat-sub">{windowText(d, state, t)}</span>
          </span>
        );
      },
    },
    { key: "used", header: t.col.used, align: "right", cell: (d) => <span className="cat-mono">{usedText(d)}</span> },
    { key: "given", header: t.col.given, align: "right", cell: (d) => <span className="cat-mono">{formatChf(d.redeemedRappen)}</span> },
    { key: "last", header: t.col.lastUsed, align: "right", cell: (d) => <span className="type-small">{d.lastUsedAt ? formatDateTime(d.lastUsedAt) : t.never}</span> },
    { key: "actions", header: <span className="sr-only">{t.col.actions}</span>, align: "right", cell: actions },
  ];
  const phoneRow = (d: Discount) => {
    const state = stateOf(d);
    return (
      <div className="cat-card">
        <div className="cat-card-top">
          <span className="cat-mono cat-name">{d.code}</span>
          <StateBadge state={state} t={t} />
        </div>
        <div className="type-small">
          <span className="cat-mono">{valueText(d, t)}</span>
          <span className="cat-sub"> · {scopeText(d, t)}</span>
        </div>
        <div className="type-small cat-sub">{windowText(d, state, t)}</div>
        <div className="cat-card-meta type-small">
          <span>{fmt(t.card.used, { used: usedText(d) })}</span>
          <span>{fmt(t.card.given, { amount: formatChf(d.redeemedRappen) })}</span>
          {d.lastUsedAt ? <span>{fmt(t.card.last, { date: formatDate(d.lastUsedAt) })}</span> : null}
        </div>
        {actions(d)}
      </div>
    );
  };

  const filtered = q.trim() !== "" || tab !== "all";
  return (
    <div className="cat-stack">
      <PageHead
        id="discounts"
        title={`${fmt(plural(totals.active, t.titleLiveOne, t.titleLive), { a: totals.active })}, ${fmt(plural(totals.scheduled, t.titleWaitingOne, t.titleWaiting), { s: totals.scheduled })}`}
        actions={
          <Button onClick={() => setOpen("new")}>
            <Plus size={16} aria-hidden="true" />
            {t.editor.new}
          </Button>
        }
        rule={<RuleLine>{t.rule}</RuleLine>}
      />
      <TableCard
        head={
          <>
            <Tabs
              aria-label={t.tabsLabel}
              active={tab}
              onChange={(id) => setParam("state", id === "all" ? null : id)}
              items={[{ id: "all", label: <TabLabel label={t.all} count={counts.all} /> }, ...STATES.map((id) => ({ id, label: <TabLabel label={t.state[id]} count={counts[id]} /> }))]}
            />
            <div className="cat-tools">
              <SearchField label={t.search} placeholder={t.searchPlaceholder} value={q} onChange={(next) => setParam("q", next)} />
              {q.trim() ? (
                <Button variant="ghost" onClick={() => setParams({ q: null, state: null })}>
                  {t.clear}
                </Button>
              ) : null}
            </div>
          </>
        }
        foot={rows.length ? fmt(t.totalGiven, { amount: formatChf(given) }) : null}
      >
        <Table columns={columns} rows={rows} rowKey={(d) => d.id} phoneRow={phoneRow} caption={t.caption} selectedKey={openId} onRowClick={(d) => setOpen(d.id)} empty={<Empty icon={Tag}>{filtered ? t.emptyFiltered : t.empty}</Empty>} />
      </TableCard>
      <Sheet open={sheetOpen} onClose={() => setOpen(null)} title={editing ? fmt(t.editor.titleEdit, { code: editing.code }) : t.editor.titleNew}>
        {sheetOpen ? <DiscountForm key={editing?.id ?? "new"} row={editing} onDone={() => setOpen(null)} /> : null}
      </Sheet>
      <Dialog open={dup !== null} onClose={() => setDupId(null)} title={dup ? fmt(t.duplicate.title, { code: dup.code }) : ""} cancelLabel={t.duplicate.back} confirmLabel={t.duplicate.confirm} onConfirm={onDuplicate}>
        {dup ? <p className="type-body">{fmt(t.duplicate.body, { code: copyCode(dup.code, all.map((d) => d.code)) })}</p> : null}
      </Dialog>
    </div>
  );
}

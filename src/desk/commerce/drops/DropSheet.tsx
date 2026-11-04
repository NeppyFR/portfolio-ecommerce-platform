"use client";

import { Pencil, Plus, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dropHub, percent, seesDropMoney, seesDropNumbers, seesWaitlistAddresses, sellThrough, type DropHub, type DropProduct } from "@/desk/commerce/products/rules";
import { CheckList, emptyToNull, FormError, GarmentThumb, MoreLink } from "@/desk/commerce/products/shared";
import { fmt, plural, useLang, useT } from "@/i18n";
import { drops as dict } from "@/i18n/dict/drops";
import { seedText } from "@/i18n/dict/seed-text";
import { formatChf } from "@/lib/format";
import { sizeLabel } from "@/lib/product-rules";
import { addProductsToDrop, addToWaitlist, createDrop, dropFormValues, markWaitlistTold, removeFromWaitlist, removeProductFromDrop, saveDrop, startDropChecklist, type DropInput } from "@/store/actions/drops";
import { getState, useStore } from "@/store/core";
import type { Drop, DropStatus, Product } from "@/store/types";
import { Button, DateInput, Dialog, IconButton, Input, RuleLine, Select, Sheet, Stat, Textarea, toast } from "@/ui";
import { countdownLine, DropStatusPill, launchLine, type DropsT } from "./parts";

const STATUSES: DropStatus[] = ["planned", "live", "archived"];

/** New and edit share one dialog: `drop` null means new. */
export function DropFormDialog({ open, drop, onClose, onCreated }: { open: boolean; drop: Drop | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const t = useT(dict);
  const [value, setValue] = useState<DropInput>(() => dropFormValues(drop));
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setValue(dropFormValues(drop));
    setProblem(null);
  }, [open, drop]);
  const submit = () => {
    const input = { ...value, launchOn: value.launchOn || null, launchTime: value.launchTime || null };
    if (drop) {
      const result = saveDrop(drop.id, input);
      if (!result.ok) {
        setProblem(result.code);
        return;
      }
      toast(t.saved);
      onClose();
      return;
    }
    const result = createDrop(input);
    if (!result.ok) {
      setProblem(result.code);
      return;
    }
    toast(t.created);
    onClose();
    onCreated?.(result.data.id);
  };
  return (
    <Dialog open={open} onClose={onClose} title={drop ? t.form.editTitle : t.form.newTitle} confirmLabel={t.form.save} cancelLabel={t.form.cancel} onConfirm={submit}>
      <p className="type-small cat-sub">{t.form.body}</p>
      <Input label={t.form.name} maxLength={60} value={value.name} error={problem === "name" ? t.form.errName : null} onChange={(e) => setValue({ ...value, name: e.target.value })} />
      <div className="cat-fields">
        <Input label={t.form.season} hint={t.form.seasonHint} maxLength={20} value={value.season} onChange={(e) => setValue({ ...value, season: e.target.value })} />
        <Select label={t.form.status} value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value as DropStatus })}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </Select>
        <DateInput label={t.form.launchOn} value={value.launchOn ?? ""} onChange={(e) => setValue({ ...value, launchOn: emptyToNull(e.target.value) })} />
        <Input
          label={t.form.launchTime}
          hint={t.form.launchTimeHint}
          placeholder="18:00"
          inputMode="numeric"
          maxLength={5}
          value={value.launchTime ?? ""}
          error={problem === "time" ? t.form.errTime : problem === "time_format" ? t.form.errTimeFormat : null}
          onChange={(e) => setValue({ ...value, launchTime: e.target.value })}
        />
      </div>
      <Textarea label={t.form.description} hint={t.form.descriptionHint} rows={3} maxLength={500} value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} />
    </Dialog>
  );
}

function AddProductsDialog({ open, drop, onClose }: { open: boolean; drop: Drop; onClose: () => void }) {
  const t = useT(dict);
  const lang = useLang();
  const products = useStore((s) => s.products);
  const drops = useStore((s) => s.drops);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);
  const free = useMemo(() => {
    const taken = new Set(drops.flatMap((d) => d.productIds));
    return products.filter((p) => !taken.has(p.id));
  }, [products, drops]);
  const submit = () => {
    const result = addProductsToDrop(drop.id, picked);
    if (result.ok) toast(fmt(plural(result.data.added, t.hub.addedOne, t.hub.added), { n: result.data.added }));
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.hub.addTitle, { name: drop.name })} confirmLabel={fmt(t.hub.addConfirm, { n: picked.length })} confirmDisabled={picked.length === 0} onConfirm={submit}>
      <p className="type-small cat-sub">{t.hub.addBody}</p>
      <CheckList legend={t.hub.products} empty={t.hub.addNone} selected={picked} onChange={setPicked} items={free.map((p) => ({ id: p.id, label: `${lang === "de" ? p.nameDe : p.nameEn}${p.status === "active" ? "" : ` (${t.productStatus[p.status]})`}` }))} />
    </Dialog>
  );
}

function ProductBlock({ row, drop, numbers, removable }: { row: DropProduct; drop: Drop; numbers: boolean; removable: boolean }) {
  const t = useT(dict);
  const lang = useLang();
  const product: Product = row.product;
  const name = lang === "de" ? product.nameDe : product.nameEn;
  return (
    <div className="cat-hub-product">
      <div className="cat-card-top">
        <div className="cat-prod">
          <GarmentThumb type={product.garment} tone={product.tone} printed={product.printedName || undefined} />
          <span className="cat-prod-text">
            <Link className="cat-name cat-link" href={`/desk/products/?open=${encodeURIComponent(product.id)}`}>
              {name}
            </Link>
            <span className="type-small cat-sub">
              {formatChf(product.priceRappen)}
              {numbers ? ` · ${t.hub.revenue} ${formatChf(row.revenueRappen)}` : ""}
            </span>
          </span>
        </div>
        {removable ? (
          <IconButton
            aria-label={fmt(t.hub.remove, { name })}
            title={fmt(t.hub.remove, { name })}
            onClick={() => {
              if (removeProductFromDrop(drop.id, product.id).ok) toast(t.hub.removed);
            }}
          >
            <X size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      {numbers ? (
        <table className="cat-mini">
          <thead>
            <tr>
              <th scope="col">{t.hub.size}</th>
              <th scope="col" data-align="right">
                {t.hub.available}
              </th>
              <th scope="col" data-align="right">
                {t.hub.sold}
              </th>
              <th scope="col" data-align="right">
                {t.hub.sellThrough}
              </th>
            </tr>
          </thead>
          <tbody>
            {row.sizes.map(({ variant, available, sold }) => (
              <tr key={variant.id}>
                <td>
                  {sizeLabel(variant.size, lang)}
                  {variant.color ? <span className="cat-sub"> · {variant.color}</span> : null}
                </td>
                <td data-align="right">{available <= 0 ? <span className="cat-amber">{t.hub.soldOut}</span> : available}</td>
                <td data-align="right">{sold}</td>
                <td data-align="right">{percent(sellThrough(sold, available))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function ChecklistCard({ drop, hub, t }: { drop: Drop; hub: DropHub; t: DropsT }) {
  const lang = useLang();
  const hasDropDay = hub.lists.some((l) => l.dropDay);
  const firstList = hub.lists.find((l) => l.dropDay) ?? hub.lists[0];
  const checklistHref = firstList ? `/desk/checklist/?list=${encodeURIComponent(firstList.id)}` : "/desk/checklist/";
  return (
    <section className="cat-panel cat-section">
      <h3 className="type-h4">{t.hub.checklist}</h3>
      {hub.lists.length === 0 ? (
        <p className="type-small cat-sub">{t.hub.checklistEmpty}</p>
      ) : (
        <ul className="cat-list">
          {hub.lists.map((l) => (
            <li key={l.id}>
              <span className="cat-prod-text cat-grow">
                <span className="type-small">{seedText(l.name, lang)}</span>
                <span className="cat-progress" aria-hidden="true">
                  <span style={{ width: `${l.total ? Math.round((l.done / l.total) * 100) : 0}%` }} />
                </span>
              </span>
              <span className="cat-mono">
                {l.done}/{l.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hub.loose.total > 0 ? <p className="type-small cat-sub">{fmt(t.hub.checklistLoose, { done: hub.loose.done, total: hub.loose.total })}</p> : null}
      <div className="cat-actions">
        {!hasDropDay ? (
          <Button
            variant="outline"
            onClick={() => {
              const result = startDropChecklist(drop.id, lang);
              toast(result.ok ? t.hub.checklistCreated : t.hub.checklistExists);
            }}
          >
            {t.hub.checklistCreate}
          </Button>
        ) : null}
        <MoreLink href={checklistHref}>{t.hub.checklistOpen}</MoreLink>
      </div>
      <RuleLine>{t.hub.checklistRule}</RuleLine>
    </section>
  );
}

function WaitlistSection({ drop, hub }: { drop: Drop; hub: DropHub }) {
  const t = useT(dict);
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const products = useStore((s) => s.products);
  const [adding, setAdding] = useState(false);
  const [marking, setMarking] = useState(false);
  const [target, setTarget] = useState("");
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [notRead, setNotRead] = useState<string[]>([]);
  const addresses = seesWaitlistAddresses(profile);
  const nameOf = (id: string | null) => {
    if (!id) return t.wait.whole;
    const p = products.find((x) => x.id === id);
    return p ? (lang === "de" ? p.nameDe : p.nameEn) : t.wait.whole;
  };
  const waitingIds = drop.waitlist.filter((w) => !w.notifiedAt).map((w) => w.id);
  const openAdd = () => {
    setTarget("");
    setText("");
    setProblem(null);
    setNotRead([]);
    setAdding(true);
  };
  const submitAdd = () => {
    const result = addToWaitlist(drop.id, target || null, text);
    if (!result.ok) {
      setProblem(t.wait.nothing);
      return;
    }
    toast(fmt(t.wait.added, { added: result.data.added, skipped: result.data.skipped }));
    if (result.data.invalid.length) {
      setNotRead(result.data.invalid);
      setText(result.data.invalid.join("\n"));
      setProblem(null);
      return;
    }
    setAdding(false);
  };
  return (
    <section className="cat-section">
      <div className="cat-section-head">
        <h3 className="type-h3">{t.wait.title}</h3>
        <div className="cat-actions">
          <Button variant="outline" onClick={openAdd}>
            <Plus size={16} aria-hidden="true" />
            {t.wait.add}
          </Button>
          {waitingIds.length ? (
            <Button variant="ghost" onClick={() => setMarking(true)}>
              <Send size={16} aria-hidden="true" />
              {t.wait.markAll}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="type-small cat-sub">{t.wait.body}</p>
      {hub.counts.length === 0 ? (
        <p className="type-small cat-sub">{t.wait.empty}</p>
      ) : (
        <ul className="cat-list">
          {hub.counts.map((c) => (
            <li key={`${c.productId ?? ""}|${c.size ?? ""}`}>
              <span className="type-small cat-grow">
                {nameOf(c.productId)}
                <span className="cat-sub"> · {c.size ? sizeLabel(c.size, lang) : t.wait.any}</span>
              </span>
              <span className="type-small cat-wait-counts">
                <b>{fmt(t.wait.waiting, { n: c.waiting })}</b>
                <span className="cat-sub">{fmt(t.wait.notified, { n: c.notified })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {drop.waitlist.length ? (
        addresses ? (
          <details className="cat-details">
            <summary>
              {t.wait.addresses} ({drop.waitlist.length})
            </summary>
            <ul className="cat-list">
              {drop.waitlist.map((w) => (
                <li key={w.id}>
                  <span className="cat-prod-text cat-grow">
                    <span className="type-small cat-mono cat-wrap">{w.email}</span>
                    <span className="type-small cat-sub">
                      {[w.name, nameOf(w.productId), w.size ? sizeLabel(w.size, lang) : t.wait.any, w.notifiedAt ? t.wait.told : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <IconButton
                    aria-label={fmt(t.wait.remove, { email: w.email })}
                    title={fmt(t.wait.remove, { email: w.email })}
                    onClick={() => {
                      if (removeFromWaitlist(drop.id, w.id).ok) toast(t.wait.removed);
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="type-small cat-note">{t.wait.private}</p>
        )
      ) : null}
      <Dialog open={adding} onClose={() => setAdding(false)} title={t.wait.addTitle} confirmLabel={t.wait.addConfirm} onConfirm={submitAdd}>
        <p className="type-small cat-sub">{t.wait.addBody}</p>
        <Select label={t.wait.product} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{t.wait.whole}</option>
          {hub.products.map((p) => (
            <option key={p.product.id} value={p.product.id}>
              {lang === "de" ? p.product.nameDe : p.product.nameEn}
            </option>
          ))}
        </Select>
        <Textarea label={t.wait.lines} rows={5} value={text} placeholder="anna.muster@example.com, M, Anna Muster" error={problem} onChange={(e) => setText(e.target.value)} />
        {notRead.length ? <FormError>{fmt(t.wait.invalid, { lines: notRead.join(", ") })}</FormError> : null}
      </Dialog>
      <Dialog
        open={marking}
        onClose={() => setMarking(false)}
        title={t.wait.markAllTitle}
        confirmLabel={t.wait.markAllConfirm}
        onConfirm={() => {
          const result = markWaitlistTold(drop.id, waitingIds);
          setMarking(false);
          if (result.ok) toast(fmt(t.wait.marked, { n: result.data.marked }));
        }}
      >
        <p className="type-body">{fmt(plural(waitingIds.length, t.wait.markAllBodyOne, t.wait.markAllBody), { n: waitingIds.length })}</p>
        <p className="type-small cat-sub">{t.wait.demoNote}</p>
      </Dialog>
    </section>
  );
}

function DropBody({ drop, ms }: { drop: Drop; ms: number }) {
  const t = useT(dict);
  const profile = useStore((s) => s.profile);
  const switches = useStore((s) => s.featureSwitches);
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const taskLists = useStore((s) => s.taskLists);
  const tasks = useStore((s) => s.tasks);
  const ledger = useStore((s) => s.ledger);
  const files = useStore((s) => s.files);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const hub = useMemo(() => dropHub(getState(), drop), [drop, orders, products, taskLists, tasks, ledger, files]); // eslint-disable-line react-hooks/exhaustive-deps
  const numbers = seesDropNumbers(profile, switches);
  const money = seesDropMoney(profile, switches);
  const fullPowers = seesWaitlistAddresses(profile);
  const line = countdownLine(drop, ms, t);
  return (
    <div className="cat-stack">
      <header className="cat-hub-head f-order">
        <div className="cat-hub-head-top">
          <span className="cat-actions">
            <DropStatusPill status={drop.status} t={t} />
            {drop.season ? <span className="type-mono-s">{drop.season}</span> : null}
          </span>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden="true" />
            {t.hub.edit}
          </Button>
        </div>
        <p className="type-body-l">{launchLine(drop, ms, t)}</p>
        {line ? <p className="type-mono">{line}</p> : null}
        {drop.description ? <p className="type-body">{drop.description}</p> : null}
      </header>
      {numbers ? (
        <section aria-label={t.hub.summary} className="cat-hub-stats">
          <Stat label={t.hub.totalSold} value={hub.totals.sold} />
          <Stat label={t.hub.totalRevenue} value={formatChf(hub.totals.revenueRappen)} />
          <Stat label={t.hub.totalSellThrough} value={percent(sellThrough(hub.totals.sold, hub.totals.available))} />
          <Stat label={t.hub.totalWaiting} value={hub.totals.waiting} />
        </section>
      ) : (
        <p className="type-small cat-note">{t.hub.numbersHidden}</p>
      )}
      <div className="cat-hub-cards">
        <section className="cat-panel cat-section">
          <div className="cat-section-head">
            <h3 className="type-h4">{t.hub.products}</h3>
            {fullPowers ? (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus size={16} aria-hidden="true" />
                {t.hub.addProducts}
              </Button>
            ) : null}
          </div>
          {!fullPowers ? <p className="type-small cat-sub">{t.hub.productsHintPartner}</p> : null}
          {hub.products.length === 0 ? <p className="type-small cat-sub">{t.hub.productsEmpty}</p> : hub.products.map((row) => <ProductBlock key={row.product.id} row={row} drop={drop} numbers={numbers} removable={fullPowers} />)}
        </section>
        <div className="cat-hub-side">
          <ChecklistCard drop={drop} hub={hub} t={t} />
          <section className="cat-panel cat-section">
            <h3 className="type-h4">{t.hub.files}</h3>
            <p className="type-small">{fmt(plural(hub.files, t.hub.filesOne, t.hub.filesMany), { n: hub.files })}</p>
            <div>
              <MoreLink href={`/desk/files/?where=${encodeURIComponent(drop.id)}`}>{t.hub.filesOpen}</MoreLink>
            </div>
          </section>
          <section className="cat-panel cat-section">
            <h3 className="type-h4">{t.hub.money}</h3>
            {!money ? (
              <p className="type-small cat-sub">{t.hub.moneyHidden}</p>
            ) : hub.ledger.count === 0 ? (
              <p className="type-small cat-sub">{t.hub.moneyEmpty}</p>
            ) : (
              <>
                <p className="cat-money-row type-small">
                  <span>{t.hub.moneyIn}</span>
                  <span className="cat-mono">{formatChf(hub.ledger.inRappen)}</span>
                </p>
                <p className="cat-money-row type-small">
                  <span>{t.hub.moneyOut}</span>
                  <span className="cat-mono">{formatChf(hub.ledger.outRappen)}</span>
                </p>
                <p className="type-small cat-sub">{t.hub.moneyBody}</p>
              </>
            )}
            {money ? (
              <div>
                <MoreLink href="/desk/finance/">{t.hub.moneyOpen}</MoreLink>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <WaitlistSection drop={drop} hub={hub} />
      <DropFormDialog open={editing} drop={drop} onClose={() => setEditing(false)} />
      <AddProductsDialog open={adding} drop={drop} onClose={() => setAdding(false)} />
    </div>
  );
}

/** The wide drop sheet: `?open=<id>`. An unknown id keeps it closed. */
export function DropSheet({ openId, ms, onClose }: { openId: string | null; ms: number; onClose: () => void }) {
  const drop = useStore((s) => (openId ? (s.drops.find((d) => d.id === openId) ?? null) : null));
  return (
    <Sheet open={drop !== null} onClose={onClose} title={drop?.name ?? ""} wide>
      {drop ? <DropBody key={drop.id} drop={drop} ms={ms} /> : null}
    </Sheet>
  );
}

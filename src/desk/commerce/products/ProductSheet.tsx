"use client";

import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmt, useLang, useT } from "@/i18n";
import { products as dict } from "@/i18n/dict/products";
import { formatChf, formatDate } from "@/lib/format";
import { compareVariants, SIZES, sizeLabel, effectivePrice } from "@/lib/product-rules";
import { hasFullPowers } from "@/lib/features";
import { productHref } from "@/lib/routes";
import { addVariant, archiveProduct, createProduct, deleteProduct, deleteVariant, duplicateProduct, saveProduct, saveVariant, toggleVariant, unarchiveProduct, type ProductInput, type VariantInput } from "@/store/actions/products";
import { useStore } from "@/store/core";
import type { GarmentTone, GarmentType, Product, ProductCategory, ProductStatus, SizeCode, Variant } from "@/store/types";
import { Button, Dialog, Garment, IconButton, Input, MoneyInput, RuleLine, Select, Sheet, Switch, Table, Textarea, toast, type Column } from "@/ui";
import { GARMENT_TONES, GARMENT_TYPES, PRODUCT_CATEGORIES, hasOrders, reservedUnits, suggestSku, variantDeleteBlock } from "./rules";
import { CheckList, FormError, parseWhole, tileFor } from "./shared";

/** The sheet footer saves the form from outside it, so one button stays in reach however far the sheet scrolls. */
const FORM_ID = "cat-product-form";

const emptyInput = (): ProductInput => ({ nameEn: "", nameDe: "", descriptionEn: "", descriptionDe: "", category: "hoodie", priceRappen: null, costRappen: null, garment: "hoodie", tone: "ice", printedName: false, collectionIds: [], tagIds: [] });

const inputOf = (p: Product): ProductInput => ({ nameEn: p.nameEn, nameDe: p.nameDe, descriptionEn: p.descriptionEn, descriptionDe: p.descriptionDe, category: p.category, priceRappen: p.priceRappen, costRappen: p.costRappen, garment: p.garment, tone: p.tone, printedName: p.printedName, collectionIds: p.collectionIds, tagIds: p.tagIds, status: p.status });

function LookPicker({ value, onChange }: { value: ProductInput; onChange: (next: ProductInput) => void }) {
  const t = useT(dict);
  return (
    <section className="cat-section" aria-label={t.look.title}>
      <div className={`cat-stage ${value.tone === "ice" || value.tone === "lilac" ? "f-region" : "t-ice"}`}>
        <Garment type={value.garment} tone={value.tone} printed={value.printedName || undefined} />
      </div>
      <p className="type-small cat-sub">{t.look.hint}</p>
      <div>
        <p className="type-label mb-2">{t.look.garment}</p>
        <div className="cat-picks" role="group" aria-label={t.look.garment}>
          {GARMENT_TYPES.map((type: GarmentType) => (
            <button key={type} type="button" className="cat-pick" aria-pressed={value.garment === type} onClick={() => onChange({ ...value, garment: type })}>
              <span className="cat-pick-glyph">
                <Garment type={type} tone="sky" view="mini" />
              </span>
              {t.look.garments[type]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="type-label mb-2">{t.look.tone}</p>
        <div className="cat-picks" role="group" aria-label={t.look.tone}>
          {GARMENT_TONES.map((tone: GarmentTone) => (
            <button key={tone} type="button" className="cat-pick" aria-pressed={value.tone === tone} onClick={() => onChange({ ...value, tone })}>
              <span className={`cat-pick-glyph cat-thumb ${tileFor(tone)}`} data-size="s">
                <Garment type={value.garment} tone={tone} view="mini" />
              </span>
              {t.look.tones[tone]}
            </button>
          ))}
        </div>
      </div>
      <Switch label={t.look.printed} checked={value.printedName} onChange={(e) => onChange({ ...value, printedName: e.target.checked })} />
    </section>
  );
}

function VariantDialog({ open, product, variant, onClose }: { open: boolean; product: Product; variant: Variant | null; onClose: () => void }) {
  const t = useT(dict);
  const lang = useLang();
  const [size, setSize] = useState<SizeCode>("M");
  const [color, setColor] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!variant) return;
    setSize(variant.size);
    setColor(variant.color);
    setSku(variant.sku);
    setPrice(variant.priceOverrideRappen);
    setThreshold(variant.threshold === null ? "" : String(variant.threshold));
    setError(null);
  }, [variant]);
  if (!variant) return <Dialog open={false} onClose={onClose} title="" />;
  const submit = () => {
    const whole = parseWhole(threshold);
    const result = saveVariant(product.id, variant.id, { size, color, sku, priceOverrideRappen: price, threshold: whole });
    if (!result.ok) {
      setError(t.variants.errors[result.code as keyof typeof t.variants.errors] ?? t.variants.errors.other);
      return;
    }
    toast(t.variants.saved);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={fmt(t.variants.edit, { sku: variant.sku })} confirmLabel={t.sheet.saveChanges} onConfirm={submit}>
      <p className="type-small cat-sub">{t.variants.editHint}</p>
      <Select label={t.variants.size} value={size} onChange={(e) => setSize(e.target.value as SizeCode)}>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {sizeLabel(s, lang)}
          </option>
        ))}
      </Select>
      <Input label={t.variants.colourOptional} value={color} maxLength={40} onChange={(e) => setColor(e.target.value)} />
      <Input label={t.variants.sku} value={sku} maxLength={40} onChange={(e) => setSku(e.target.value.toUpperCase())} className="cat-mono" />
      <MoneyInput
        label={t.variants.ownPriceOptional}
        value={price}
        placeholder={t.variants.productPrice}
        onChange={setPrice}
      />
      <Input label={t.variants.threshold} value={threshold} inputMode="numeric" placeholder={t.variants.shopDefault} onChange={(e) => setThreshold(e.target.value)} />
      <FormError>{error}</FormError>
    </Dialog>
  );
}

function AddVariantForm({ product }: { product: Product }) {
  const t = useT(dict);
  const lang = useLang();
  const [size, setSize] = useState<SizeCode>(() => SIZES.find((s) => !product.variants.some((v) => v.size === s)) ?? "M");
  const [color, setColor] = useState(product.variants[0]?.color ?? "");
  const [sku, setSku] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [threshold, setThreshold] = useState("");
  const [opening, setOpening] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const suggested = suggestSku(product, size);
  const submit = () => {
    const input: VariantInput = { size, color, sku: sku ?? suggested, priceOverrideRappen: price, threshold: parseWhole(threshold), openingStock: parseWhole(opening) ?? 0 };
    const result = addVariant(product.id, input);
    if (!result.ok) {
      setError(t.variants.errors[result.code as keyof typeof t.variants.errors] ?? t.variants.errors.other);
      return;
    }
    toast(t.variants.added);
    setError(null);
    setSku(null);
    setPrice(null);
    setThreshold("");
    setOpening("0");
    setSize(SIZES.find((s) => s !== size && !product.variants.some((v) => v.size === s)) ?? size);
  };
  return (
    <form
      className="cat-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h4 className="type-h4 cat-add-title">{t.variants.addTitle}</h4>
      <Select label={t.variants.size} value={size} onChange={(e) => setSize(e.target.value as SizeCode)}>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {sizeLabel(s, lang)}
          </option>
        ))}
      </Select>
      <Input label={t.variants.colour} value={color} maxLength={40} onChange={(e) => setColor(e.target.value)} />
      <Input label={t.variants.sku} className="cat-add-sku" value={sku ?? suggested} maxLength={40} onChange={(e) => setSku(e.target.value.toUpperCase())} />
      <MoneyInput label={t.variants.ownPrice} value={price} placeholder={t.variants.productPrice} onChange={setPrice} />
      <Input label={t.variants.threshold} value={threshold} inputMode="numeric" placeholder={t.variants.shopDefault} onChange={(e) => setThreshold(e.target.value)} />
      <Input label={t.variants.openingStock} value={opening} inputMode="numeric" onChange={(e) => setOpening(e.target.value)} />
      <div className="cat-add-go">
        <Button type="submit" variant="outline">
          <Plus size={16} aria-hidden="true" />
          {t.variants.add}
        </Button>
      </div>
      {error ? (
        <div className="cat-add-title">
          <FormError>{error}</FormError>
        </div>
      ) : null}
    </form>
  );
}

function VariantsSection({ product }: { product: Product }) {
  const t = useT(dict);
  const lang = useLang();
  const [editing, setEditing] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);
  const rows = useMemo(() => product.variants.slice().sort(compareVariants), [product.variants]);
  const onHandHref = (v: Variant) => `/desk/inventory/?q=${encodeURIComponent(v.sku)}`;
  const toggle = (v: Variant) => {
    const result = toggleVariant(product.id, v.id);
    if (result.ok) toast(fmt(result.data.isActive ? t.variants.onSaleToast : t.variants.offToast, { sku: result.data.sku }));
  };
  const blockText = (v: Variant) => {
    const block = variantDeleteBlock(v);
    return block === "ordered" ? t.variants.blockedOrdered : block === "reserved" ? t.variants.blockedReserved : null;
  };
  const actions = (v: Variant) => {
    const blocked = blockText(v);
    return (
      <span className="cat-actions-cell">
        <Link className="ui-iconbtn" href={`/print/labels/?v=${encodeURIComponent(v.id)}&copies=1&layout=a4`} aria-label={fmt(t.variants.printOne, { sku: v.sku })} title={fmt(t.variants.printOne, { sku: v.sku })}>
          <Printer size={16} aria-hidden="true" />
        </Link>
        <IconButton aria-label={fmt(t.variants.edit, { sku: v.sku })} onClick={() => setEditing(v)}>
          <Pencil size={16} aria-hidden="true" />
        </IconButton>
        <IconButton aria-label={blocked ? fmt(t.variants.deleteBlocked, { sku: v.sku, reason: blocked }) : fmt(t.variants.delete, { sku: v.sku })} disabled={Boolean(blocked)} onClick={() => setDeleting(v)}>
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      </span>
    );
  };
  const columns: Column<Variant>[] = [
    { key: "size", header: t.variants.colSize, cell: (v) => sizeLabel(v.size, lang) },
    { key: "colour", header: t.variants.colColour, cell: (v) => v.color || "–" },
    { key: "sku", header: t.variants.colSku, cell: (v) => <span className="cat-mono">{v.sku}</span> },
    { key: "price", header: t.variants.colPrice, align: "right", cell: (v) => (v.priceOverrideRappen === null ? <span className="cat-sub">{t.variants.default}</span> : <span className="cat-mono">{formatChf(v.priceOverrideRappen)}</span>) },
    { key: "threshold", header: t.variants.colThreshold, align: "right", cell: (v) => (v.threshold === null ? <span className="cat-sub">{t.variants.default}</span> : v.threshold) },
    {
      key: "hand",
      header: t.variants.colOnHand,
      align: "right",
      cell: (v) => (
        <Link className="cat-link" href={onHandHref(v)} title={t.variants.adjust}>
          {v.stock}
          {v.reserved ? fmt(t.variants.reserved, { count: v.reserved }) : ""}
        </Link>
      ),
    },
    { key: "sale", header: t.variants.colOnSale, cell: (v) => <Switch aria-label={fmt(t.variants.onSaleLabel, { sku: v.sku })} checked={v.isActive} onChange={() => toggle(v)} /> },
    { key: "actions", header: <span className="sr-only">{t.variants.colActions}</span>, align: "right", cell: actions },
  ];
  const phoneRow = (v: Variant) => (
    <div className="cat-card">
      <div className="cat-card-top">
        <span className="cat-name">
          {sizeLabel(v.size, lang)}
          {v.color ? ` · ${v.color}` : ""}
        </span>
        <Switch aria-label={fmt(t.variants.onSaleLabel, { sku: v.sku })} checked={v.isActive} onChange={() => toggle(v)} />
      </div>
      <span className="cat-mono cat-sub">{v.sku}</span>
      <div className="cat-card-meta type-small">
        <Link className="cat-link" href={onHandHref(v)}>
          {t.variants.colOnHand} {v.stock}
          {v.reserved ? fmt(t.variants.reserved, { count: v.reserved }) : ""}
        </Link>
        <span className="cat-mono">{formatChf(effectivePrice(product, v))}</span>
      </div>
      {actions(v)}
    </div>
  );
  return (
    <section className="cat-section">
      <div className="cat-section-head">
        <h3 className="type-h3">{t.variants.title}</h3>
        {rows.length ? (
          <Link className="ui-btn ui-btn-outline" href={`/print/labels/?v=${rows.map((v) => encodeURIComponent(v.id)).join(",")}&copies=1&layout=a4`} title={t.variants.printHint}>
            <span className="ui-btn-label">
              <Printer size={16} aria-hidden="true" />
              {t.variants.print}
            </span>
          </Link>
        ) : null}
      </div>
      <p className="type-small cat-sub">{t.variants.hint}</p>
      <Table columns={columns} rows={rows} rowKey={(v) => v.id} phoneRow={phoneRow} caption={t.variants.caption} empty={<p className="type-small cat-sub">{t.variants.empty}</p>} />
      <AddVariantForm key={product.variants.length} product={product} />
      <VariantDialog open={editing !== null} product={product} variant={editing} onClose={() => setEditing(null)} />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? fmt(t.variants.deleteTitle, { sku: deleting.sku }) : ""}
        danger
        confirmLabel={t.danger.delete}
        onConfirm={() => {
          if (!deleting) return;
          const result = deleteVariant(product.id, deleting.id);
          if (result.ok) toast(t.variants.deleted);
          setDeleting(null);
        }}
      >
        <p className="type-body">{deleting ? fmt(t.variants.deleteBody, { stock: deleting.stock }) : ""}</p>
      </Dialog>
    </section>
  );
}

function DangerSection({ product, onGone, onOpen }: { product: Product; onGone: () => void; onOpen: (id: string) => void }) {
  const t = useT(dict);
  const orders = useStore((s) => s.orders);
  const lang = useLang();
  const [dialog, setDialog] = useState<"duplicate" | "delete" | null>(null);
  const ordered = hasOrders(product, orders);
  const reserved = reservedUnits(product);
  const name = lang === "de" ? product.nameDe : product.nameEn;
  return (
    <section className="cat-section">
      <h3 className="type-h3">{t.danger.title}</h3>
      {ordered ? <RuleLine>{t.rule}</RuleLine> : null}
      {reserved ? <p className="type-small cat-note" data-tone="warn">{fmt(reserved === 1 ? t.danger.reservedOne : t.danger.reservedOther, { count: reserved })}</p> : null}
      <div className="cat-danger">
        <Button variant="outline" onClick={() => setDialog("duplicate")}>
          {t.danger.duplicate}
        </Button>
        {product.status === "archived" ? (
          <Button
            variant="outline"
            onClick={() => {
              if (unarchiveProduct(product.id).ok) toast(t.danger.unarchived);
            }}
          >
            {t.danger.unarchive}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              if (archiveProduct(product.id).ok) toast(t.danger.archived);
            }}
          >
            {t.danger.archive}
          </Button>
        )}
        <Button variant="danger" onClick={() => setDialog("delete")}>
          {t.danger.delete}
        </Button>
      </div>
      <Dialog
        open={dialog === "duplicate"}
        onClose={() => setDialog(null)}
        title={fmt(t.danger.duplicateTitle, { name })}
        confirmLabel={t.danger.duplicate}
        onConfirm={() => {
          const result = duplicateProduct(product.id);
          setDialog(null);
          if (result.ok) {
            toast(t.danger.duplicated);
            onOpen(result.data.id);
          }
        }}
      >
        <p className="type-body">{t.danger.duplicateBody}</p>
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={fmt(t.danger.deleteTitle, { name })}
        danger={!ordered}
        confirmLabel={ordered ? t.danger.archiveInstead : t.danger.deleteForGood}
        confirmDisabled={!ordered && reserved > 0}
        onConfirm={() => {
          setDialog(null);
          if (ordered) {
            if (archiveProduct(product.id).ok) toast(t.danger.archived);
            return;
          }
          if (deleteProduct(product.id).ok) {
            toast(t.danger.deleted);
            onGone();
          }
        }}
      >
        <p className="type-body">{ordered ? t.danger.deleteBlocked : t.danger.deleteBody}</p>
      </Dialog>
    </section>
  );
}

function DetailsFields({ value, onChange, withStatus, errors }: { value: ProductInput; onChange: (next: ProductInput) => void; withStatus: boolean; errors: { price?: string | null; cost?: string | null } }) {
  const t = useT(dict);
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const collections = useStore((s) => s.collections);
  const tags = useStore((s) => s.tags);
  return (
    <section className="cat-section">
      <h3 className="type-h3">{t.form.details}</h3>
      {withStatus ? (
        <Select label={t.form.status} hint={t.form.statusHint} value={value.status ?? "draft"} onChange={(e) => onChange({ ...value, status: e.target.value as ProductStatus })}>
          {(["active", "draft", "archived"] as ProductStatus[]).map((status) => (
            <option key={status} value={status}>
              {t.status[status]}
            </option>
          ))}
        </Select>
      ) : null}
      <Select label={t.form.category} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as ProductCategory })}>
        {PRODUCT_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {t.category[category]}
          </option>
        ))}
      </Select>
      <MoneyInput label={t.form.price} hint={t.form.priceHint} error={errors.price} value={value.priceRappen} onChange={(priceRappen) => onChange({ ...value, priceRappen })} />
      {hasFullPowers(profile) ? <MoneyInput label={t.form.cost} hint={t.form.costHint} error={errors.cost} value={value.costRappen} onChange={(costRappen) => onChange({ ...value, costRappen })} /> : <p className="type-small cat-note">{t.form.costLocked}</p>}
      <CheckList
        legend={t.form.collections}
        empty={t.form.noCollections}
        selected={value.collectionIds}
        onChange={(collectionIds) => onChange({ ...value, collectionIds })}
        items={collections.map((c) => ({ id: c.id, label: `${lang === "de" ? c.nameDe : c.nameEn}${c.isActive ? "" : ` ${t.form.hidden}`}` }))}
      />
      <CheckList legend={t.form.tags} selected={value.tagIds} onChange={(tagIds) => onChange({ ...value, tagIds })} items={tags.map((tag) => ({ id: tag.id, label: tag.label }))} inline />
    </section>
  );
}

function TextsFields({ value, onChange, nameError }: { value: ProductInput; onChange: (next: ProductInput) => void; nameError: string | null }) {
  const t = useT(dict);
  return (
    <section className="cat-section">
      <h3 className="type-h3">{t.form.texts}</h3>
      <div className="cat-fields">
        <Input label={t.form.nameEn} value={value.nameEn} maxLength={120} error={nameError} onChange={(e) => onChange({ ...value, nameEn: e.target.value })} />
        <Input label={t.form.nameDe} value={value.nameDe} maxLength={120} onChange={(e) => onChange({ ...value, nameDe: e.target.value })} />
        <Textarea label={t.form.descriptionEn} value={value.descriptionEn} maxLength={5000} onChange={(e) => onChange({ ...value, descriptionEn: e.target.value })} />
        <Textarea label={t.form.descriptionDe} value={value.descriptionDe} maxLength={5000} onChange={(e) => onChange({ ...value, descriptionDe: e.target.value })} />
      </div>
    </section>
  );
}

function useProductForm(initial: () => ProductInput) {
  const t = useT(dict);
  const [value, setValue] = useState<ProductInput>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  return {
    value,
    setValue,
    setProblem,
    nameError: problem === "name" ? t.form.nameInvalid : null,
    errors: { price: problem === "price" ? t.form.priceInvalid : null, cost: problem === "cost" ? t.form.costInvalid : null },
  };
}

function NewProductBody({ onDone }: { onDone: (id: string | null) => void }) {
  const t = useT(dict);
  const form = useProductForm(emptyInput);
  const submit = () => {
    const result = createProduct(form.value);
    if (!result.ok) {
      form.setProblem(result.code);
      return;
    }
    toast(t.form.created);
    onDone(result.data.id);
  };
  return (
    <form
      id={FORM_ID}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="cat-sheet-grid">
        <div className="cat-sheet-col">
          <p className="type-body">{t.sheet.newIntro}</p>
          <TextsFields value={form.value} onChange={form.setValue} nameError={form.nameError} />
          <DetailsFields value={form.value} onChange={form.setValue} withStatus={false} errors={form.errors} />
        </div>
        <div className="cat-sheet-col">
          <LookPicker value={form.value} onChange={form.setValue} />
        </div>
      </div>
    </form>
  );
}

function EditProductBody({ product, onGone, onOpen }: { product: Product; onGone: () => void; onOpen: (id: string) => void }) {
  const t = useT(dict);
  const form = useProductForm(() => inputOf(product));
  const { setValue } = form;
  const status = product.status;
  useEffect(() => {
    setValue((current) => ({ ...current, status }));
  }, [status, setValue]);
  const submit = () => {
    const result = saveProduct(product.id, form.value);
    if (!result.ok) {
      form.setProblem(result.code);
      return;
    }
    form.setProblem(null);
    toast(t.form.saved);
  };
  return (
    <div className="cat-stack">
      <p className="type-small cat-sub">
        {fmt(t.sheet.meta, { category: t.category[product.category], date: formatDate(product.updatedAt) })}
        {product.publishedAt ? fmt(t.sheet.published, { date: formatDate(product.publishedAt) }) : ""}
        {" · "}
        {product.status === "active" ? (
          <Link className="cat-link" href={productHref(product.slug)}>
            {t.sheet.viewInShop}
          </Link>
        ) : (
          t.sheet.notInShop
        )}
      </p>
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="cat-sheet-grid">
          <div className="cat-sheet-col">
            <TextsFields value={form.value} onChange={form.setValue} nameError={form.nameError} />
            <p className="type-small cat-sub">{fmt(t.form.slug, { slug: product.slug })}</p>
            <LookPicker value={form.value} onChange={form.setValue} />
          </div>
          <div className="cat-sheet-col">
            <DetailsFields value={form.value} onChange={form.setValue} withStatus errors={form.errors} />
          </div>
        </div>
      </form>
      <VariantsSection product={product} />
      <DangerSection product={product} onGone={onGone} onOpen={onOpen} />
    </div>
  );
}

/** The wide product sheet: `?open=new` or `?open=<id>`. An unknown id keeps the sheet closed. */
export function ProductSheet({ openId, onClose, onOpen }: { openId: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const t = useT(dict);
  const lang = useLang();
  const product = useStore((s) => (openId && openId !== "new" ? s.products.find((p) => p.id === openId) ?? null : null));
  const isNew = openId === "new";
  const open = isNew || product !== null;
  const title = isNew ? t.sheet.newTitle : product ? (lang === "de" ? product.nameDe : product.nameEn) : "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <Button type="submit" form={FORM_ID}>
          {isNew ? t.sheet.create : t.sheet.saveChanges}
        </Button>
      }
    >
      {isNew ? <NewProductBody key="new" onDone={(id) => (id ? onOpen(id) : onClose())} /> : null}
      {product ? <EditProductBody key={product.id} product={product} onGone={onClose} onOpen={onOpen} /> : null}
    </Sheet>
  );
}

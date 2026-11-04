"use client";

import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { products as dict } from "@/i18n/dict/products";
import { collectionHref } from "@/lib/routes";
import { createCollection, createTag, saveCollection, setCollectionShown, type CollectionInput } from "@/store/actions/products";
import { useStore } from "@/store/core";
import type { Collection } from "@/store/types";
import { Button, Empty, Input, Sheet, Switch, Textarea, toast } from "@/ui";
import { collectionProductCount } from "./rules";
import { FormError, MoreLink, TableCard, useOpenParam } from "./shared";

const blank: CollectionInput = { nameEn: "", nameDe: "", descriptionEn: "", descriptionDe: "" };

function CollectionForm({ row, onDone }: { row: Collection | null; onDone: () => void }) {
  const t = useT(dict);
  const [value, setValue] = useState<CollectionInput>(row ? { nameEn: row.nameEn, nameDe: row.nameDe, descriptionEn: row.descriptionEn, descriptionDe: row.descriptionDe } : blank);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const result = row ? saveCollection(row.id, value) : createCollection(value);
    if (!result.ok) {
      setError(t.collections.nameInvalid);
      return;
    }
    toast(row ? t.collections.saved : t.collections.created);
    onDone();
  };
  return (
    <form
      className="cat-stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input label={t.collections.nameEn} value={value.nameEn} maxLength={80} onChange={(e) => setValue({ ...value, nameEn: e.target.value })} />
      <Input label={t.collections.nameDe} value={value.nameDe} maxLength={80} onChange={(e) => setValue({ ...value, nameDe: e.target.value })} />
      <Textarea label={t.collections.descriptionEn} value={value.descriptionEn} maxLength={500} onChange={(e) => setValue({ ...value, descriptionEn: e.target.value })} />
      <Textarea label={t.collections.descriptionDe} value={value.descriptionDe} maxLength={500} onChange={(e) => setValue({ ...value, descriptionDe: e.target.value })} />
      {row ? <p className="type-small cat-sub">{fmt(t.collections.slugStays, { slug: row.slug })}</p> : null}
      <FormError>{error}</FormError>
      <div>
        <Button type="submit">{row ? t.sheet.saveChanges : t.collections.create}</Button>
      </div>
    </form>
  );
}

function TagsPanel() {
  const t = useT(dict);
  const tags = useStore((s) => s.tags);
  const products = useStore((s) => s.products);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const result = createTag(label);
    if (!result.ok) {
      setError(result.code === "taken" ? t.collections.tagTaken : t.collections.tagInvalid);
      return;
    }
    toast(fmt(t.collections.tagAdded, { label: result.data.label }));
    setLabel("");
    setError(null);
  };
  return (
    <section className="cat-panel cat-section">
      <h2 className="type-h3">{t.collections.tags}</h2>
      <p className="type-small cat-sub">{t.collections.tagsHint}</p>
      {tags.length === 0 ? (
        <p className="type-small cat-sub">{t.collections.noTags}</p>
      ) : (
        <ul className="cat-chips">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Link className="cat-chip" href={`/desk/products/?tag=${encodeURIComponent(tag.id)}`}>
                {tag.label}
                <b>{products.filter((p) => p.tagIds.includes(tag.id)).length}</b>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form
        className="cat-filter"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label={t.collections.newTag} value={label} maxLength={30} error={error} onChange={(e) => setLabel(e.target.value)} />
        <Button type="submit" variant="outline">
          {t.collections.addTag}
        </Button>
      </form>
    </section>
  );
}

export function CollectionsScreen() {
  const t = useT(dict);
  const lang = useLang();
  const collections = useStore((s) => s.collections);
  const products = useStore((s) => s.products);
  const [openId, setOpen] = useOpenParam();
  const editing = collections.find((c) => c.id === openId) ?? null;
  const sheetOpen = openId === "new" || editing !== null;
  const hidden = collections.filter((c) => !c.isActive).length;
  return (
    <div className="cat-stack">
      <PageHead
        id="collections"
        title={fmt(t.collections.title, { n: collections.length, h: hidden })}
        actions={
          <Button onClick={() => setOpen("new")}>
            <Plus size={16} aria-hidden="true" />
            {t.collections.new}
          </Button>
        }
      />
      <div className="cat-two">
        {collections.length === 0 ? (
          <Empty icon={Layers}>{t.collections.empty}</Empty>
        ) : (
          <TableCard>
          <ul className="cat-collections">
            {collections.map((c) => {
              const name = lang === "de" ? c.nameDe : c.nameEn;
              const count = collectionProductCount(c, products);
              return (
                <li key={c.id} className="cat-collection">
                  <div className="cat-prod-text">
                    <span className="cat-name">{name}</span>
                    <span className="type-mono-s cat-sub">{c.slug}</span>
                  </div>
                  <Link className="type-small cat-collection-count cat-link" href={`/desk/products/?collection=${encodeURIComponent(c.id)}`}>
                    {fmt(count === 1 ? t.collections.countOne : t.collections.countOther, { count })}
                  </Link>
                  <Switch
                    aria-label={fmt(t.collections.shownLabel, { name })}
                    label={c.isActive ? t.collections.inShop : t.collections.hidden}
                    checked={c.isActive}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (setCollectionShown(c.id, next).ok) toast(next ? t.collections.shown : t.collections.hiddenToast);
                    }}
                  />
                  <span className="cat-actions">
                    {c.isActive ? <MoreLink href={collectionHref(c.slug)}>{t.collections.seeInShop}</MoreLink> : null}
                    <Button variant="outline" aria-label={fmt(t.collections.editLabel, { name })} onClick={() => setOpen(c.id)}>
                      {t.collections.edit}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          </TableCard>
        )}
        <TagsPanel />
      </div>
      <p className="type-small cat-sub cat-intro">{t.collections.intro}</p>
      <Sheet open={sheetOpen} onClose={() => setOpen(null)} title={editing ? fmt(t.collections.editTitle, { name: lang === "de" ? editing.nameDe : editing.nameEn }) : t.collections.new}>
        {sheetOpen ? <CollectionForm key={editing?.id ?? "new"} row={editing} onDone={() => setOpen(null)} /> : null}
      </Sheet>
    </div>
  );
}

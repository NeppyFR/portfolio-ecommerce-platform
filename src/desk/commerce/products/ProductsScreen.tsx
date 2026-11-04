"use client";

import { Package, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHead } from "@/desk/shell/PageHead";
import { fmt, useLang, useT } from "@/i18n";
import { products as dict } from "@/i18n/dict/products";
import { formatChf } from "@/lib/format";
import { priceRange } from "@/lib/product-rules";
import { setParam, setParams } from "@/lib/routes";
import { useStore } from "@/store/core";
import type { Product, ProductStatus, Tone } from "@/store/types";
import { Button, Empty, Select, Table, Tabs, type Column } from "@/ui";
import { ProductSheet } from "./ProductSheet";
import { filterProducts, PRODUCT_SORTS, productCounts, sortProducts, totalStock, type ProductSort } from "./rules";
import { GarmentThumb, SearchField, TableCard, TabLabel, useOpenParam } from "./shared";
import { Status } from "@/ui";

const STATUS_TONE: Record<ProductStatus, Tone> = { active: "ok", draft: "warn", archived: "off" };
type StatusTab = ProductStatus | "all";
const TABS: StatusTab[] = ["all", "active", "draft", "archived"];

export function ProductsScreen() {
  const t = useT(dict);
  const lang = useLang();
  const params = useSearchParams();
  const all = useStore((s) => s.products);
  const collections = useStore((s) => s.collections);
  const tags = useStore((s) => s.tags);
  const [openId, setOpen] = useOpenParam();

  const q = params.get("q") ?? "";
  const collection = params.get("collection") ?? "";
  const tag = params.get("tag") ?? "";
  const sortParam = params.get("sort") as ProductSort | null;
  const sort: ProductSort = sortParam && PRODUCT_SORTS.includes(sortParam) ? sortParam : "name";
  const statusParam = params.get("status") as StatusTab | null;
  const status: StatusTab = statusParam && TABS.includes(statusParam) ? statusParam : "all";
  const filtered = q.trim() !== "" || collection !== "" || tag !== "";

  const matching = useMemo(() => filterProducts(all, { q, collection, tag }), [all, q, collection, tag]);
  const counts = useMemo(() => productCounts(matching), [matching]);
  const totals = useMemo(() => productCounts(all), [all]);
  const rows = useMemo(() => sortProducts(status === "all" ? matching : matching.filter((p) => p.status === status), sort, lang), [matching, status, sort, lang]);

  const nameOf = (p: Product) => (lang === "de" ? p.nameDe : p.nameEn);
  const collectionNames = (p: Product) => p.collectionIds.map((id) => collections.find((c) => c.id === id)).filter(Boolean).map((c) => (lang === "de" ? c?.nameDe : c?.nameEn)).join(", ");
  const priceText = (p: Product) => {
    const range = priceRange(p);
    return range.varies ? fmt(t.list.from, { price: formatChf(range.lowestRappen) }) : formatChf(range.lowestRappen);
  };
  const stockCell = (p: Product) => {
    if (p.variants.length === 0) return <span className="cat-sub">{t.list.noSizes}</span>;
    const stock = totalStock(p);
    return <span className={stock === 0 ? "cat-rose" : undefined}>{fmt(t.list.onHand, { count: stock })}</span>;
  };
  const columns: Column<Product>[] = [
    {
      key: "product",
      header: t.list.colProduct,
      cell: (p) => (
        <div className="cat-prod">
          <GarmentThumb type={p.garment} tone={p.tone} />
          <span className="cat-prod-text">
            <span className="cat-name">{nameOf(p)}</span>
            <span className="type-mono-s cat-sub">{p.slug}</span>
          </span>
        </div>
      ),
    },
    { key: "status", header: t.list.colStatus, cell: (p) => <Status tone={STATUS_TONE[p.status]}>{t.status[p.status]}</Status> },
    { key: "collections", header: t.list.colCollections, cell: (p) => collectionNames(p) || "–" },
    { key: "price", header: t.list.colPrice, align: "right", cell: (p) => <span className="cat-mono">{priceText(p)}</span> },
    { key: "stock", header: t.list.colStock, align: "right", cell: stockCell },
    { key: "sizes", header: t.list.colSizes, align: "right", cell: (p) => p.variants.length },
  ];
  const phoneRow = (p: Product) => (
    <div className="cat-prod">
      <GarmentThumb type={p.garment} tone={p.tone} />
      <div className="cat-card" style={{ flex: 1 }}>
        <div className="cat-card-top">
          <span className="cat-name">{nameOf(p)}</span>
          <Status tone={STATUS_TONE[p.status]}>{t.status[p.status]}</Status>
        </div>
        <div className="cat-card-meta type-small">
          <span>{stockCell(p)}</span>
          <span className="cat-mono">{priceText(p)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="cat-stack">
      <PageHead
        id="products"
        title={fmt(t.title, { a: totals.active, d: totals.draft })}
        actions={
          <Button onClick={() => setOpen("new")}>
            <Plus size={16} aria-hidden="true" />
            {t.list.new}
          </Button>
        }
      />
      <TableCard
        head={
          <>
            <Tabs aria-label={t.statusNav} active={status} onChange={(id) => setParam("status", id === "all" ? null : id)} items={TABS.map((id) => ({ id, label: <TabLabel label={t.status[id]} count={counts[id]} /> }))} />
            <div className="cat-tools">
              <SearchField label={t.list.search} placeholder={t.list.searchPlaceholder} value={q} onChange={(next) => setParam("q", next)} />
              <Select label={t.list.collection} value={collection} onChange={(e) => setParam("collection", e.target.value)}>
                <option value="">{t.list.allCollections}</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === "de" ? c.nameDe : c.nameEn}
                  </option>
                ))}
              </Select>
              <Select label={t.list.tag} value={tag} onChange={(e) => setParam("tag", e.target.value)}>
                <option value="">{t.list.allTags}</option>
                {tags.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
              <Select label={t.list.sort} className="cat-wide-phone" value={sort} onChange={(e) => setParam("sort", e.target.value === "name" ? null : e.target.value)}>
                {PRODUCT_SORTS.map((value) => (
                  <option key={value} value={value}>
                    {t.list.sort}: {t.sort[value]}
                  </option>
                ))}
              </Select>
              {filtered ? (
                <Button variant="ghost" onClick={() => setParams({ q: null, collection: null, tag: null })}>
                  {t.list.clear}
                </Button>
              ) : null}
            </div>
            {filtered ? <p className="type-small cat-sub">{fmt(t.list.countsFiltered, { active: counts.active, draft: counts.draft, archived: counts.archived })}</p> : null}
          </>
        }
      >
        <Table
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          phoneRow={phoneRow}
          caption={t.list.caption}
          selectedKey={openId}
          onRowClick={(p) => setOpen(p.id)}
          empty={
            <Empty
              icon={Package}
              action={
                <Button variant="outline" onClick={() => setOpen("new")}>
                  {t.list.create}
                </Button>
              }
            >
              {filtered || status !== "all" ? t.list.emptyFiltered : t.list.empty}
            </Empty>
          }
        />
      </TableCard>
      <ProductSheet openId={openId} onClose={() => setOpen(null)} onOpen={setOpen} />
    </div>
  );
}

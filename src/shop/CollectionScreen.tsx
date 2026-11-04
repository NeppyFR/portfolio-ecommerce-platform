"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useDocTitle, useLang, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { RUNTIME_PARAM } from "@/lib/routes";
import { useStore } from "@/store/core";
import { Empty } from "@/ui";
import { NotFoundBody } from "./NotFoundScreen";
import { Wall, WallHead, useActiveProducts } from "./parts";

/** `handle` is the route param. When it is `x`, the real handle arrives as `?handle=`. */
export function CollectionScreen({ handle }: { handle: string }) {
  const params = useSearchParams();
  const lang = useLang();
  const t = useT(shop);
  const real = handle === RUNTIME_PARAM ? params.get("handle") ?? "" : handle;
  const collection = useStore((s) => s.collections.find((c) => c.slug === real && c.isActive));
  const active = useActiveProducts();
  const products = useMemo(() => (collection ? active.filter((p) => p.collectionIds.includes(collection.id)) : []), [active, collection]);
  useDocTitle(collection ? (lang === "de" ? collection.nameDe : collection.nameEn) : undefined);
  if (!collection) return <NotFoundBody />;
  return (
    <>
      <WallHead title={lang === "de" ? collection.nameDe : collection.nameEn} count={products.length} />
      {products.length ? <Wall products={products} /> : <Empty>{t.wall.empty}</Empty>}
    </>
  );
}

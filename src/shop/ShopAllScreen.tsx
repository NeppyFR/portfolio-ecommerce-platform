"use client";

import { useDocTitle, useT } from "@/i18n";
import { shop } from "@/i18n/dict/shop";
import { Empty } from "@/ui";
import { Wall, WallHead, useActiveProducts } from "./parts";

export function ShopAllScreen() {
  const t = useT(shop);
  const products = useActiveProducts();
  useDocTitle(t.wall.allTitle);
  return (
    <>
      <WallHead title={t.wall.allTitle} count={products.length} />
      {products.length ? <Wall products={products} /> : <Empty>{t.wall.empty}</Empty>}
    </>
  );
}

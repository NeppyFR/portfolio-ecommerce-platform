import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsScreen } from "@/desk/commerce/products/ProductsScreen";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return (
    <Suspense>
      <ProductsScreen />
    </Suspense>
  );
}

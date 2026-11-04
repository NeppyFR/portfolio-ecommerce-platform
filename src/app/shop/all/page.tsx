import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopAllScreen } from "@/shop/ShopAllScreen";

export const metadata: Metadata = { title: "All products" };

export default function Page() {
  return (
    <Suspense>
      <ShopAllScreen />
    </Suspense>
  );
}

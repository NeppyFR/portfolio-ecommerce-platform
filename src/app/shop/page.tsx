import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopHomeScreen } from "@/shop/ShopHomeScreen";

export const metadata: Metadata = { title: "Shop" };

export default function Page() {
  return (
    <Suspense>
      <ShopHomeScreen />
    </Suspense>
  );
}

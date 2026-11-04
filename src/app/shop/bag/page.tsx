import type { Metadata } from "next";
import { Suspense } from "react";
import { BagScreen } from "@/shop/BagScreen";

export const metadata: Metadata = { title: "Bag" };

export default function Page() {
  return (
    <Suspense>
      <BagScreen />
    </Suspense>
  );
}

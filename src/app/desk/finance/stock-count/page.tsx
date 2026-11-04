import type { Metadata } from "next";
import { Suspense } from "react";
import { StockCountScreen } from "@/desk/finance/stock-count/StockCountScreen";

export const metadata: Metadata = { title: "Stock count" };

export default function Page() {
  return (
    <Suspense>
      <StockCountScreen />
    </Suspense>
  );
}

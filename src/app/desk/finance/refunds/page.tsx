import type { Metadata } from "next";
import { Suspense } from "react";
import { RefundsScreen } from "@/desk/finance/refunds/RefundsScreen";

export const metadata: Metadata = { title: "Refunds" };

export default function Page() {
  return (
    <Suspense>
      <RefundsScreen />
    </Suspense>
  );
}

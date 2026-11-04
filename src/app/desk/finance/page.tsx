import type { Metadata } from "next";
import { Suspense } from "react";
import { LedgerScreen } from "@/desk/finance/ledger/LedgerScreen";

export const metadata: Metadata = { title: "Ledger" };

export default function Page() {
  return (
    <Suspense>
      <LedgerScreen />
    </Suspense>
  );
}

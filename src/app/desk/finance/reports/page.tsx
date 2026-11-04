import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsScreen } from "@/desk/finance/reports/ReportsScreen";

export const metadata: Metadata = { title: "Quarterly report" };

export default function Page() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}

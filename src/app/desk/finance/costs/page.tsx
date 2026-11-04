import type { Metadata } from "next";
import { Suspense } from "react";
import { CostsScreen } from "@/desk/finance/costs/CostsScreen";

export const metadata: Metadata = { title: "Running costs" };

export default function Page() {
  return (
    <Suspense>
      <CostsScreen />
    </Suspense>
  );
}

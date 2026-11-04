import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductionScreen } from "@/desk/work/production/ProductionScreen";

export const metadata: Metadata = { title: "Production" };

export default function Page() {
  return (
    <Suspense>
      <ProductionScreen />
    </Suspense>
  );
}

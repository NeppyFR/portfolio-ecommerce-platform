import type { Metadata } from "next";
import { Suspense } from "react";
import { LabelsScreen } from "@/print/LabelsScreen";

export const metadata: Metadata = { title: "Print labels" };

export default function Page() {
  return (
    <Suspense>
      <LabelsScreen />
    </Suspense>
  );
}

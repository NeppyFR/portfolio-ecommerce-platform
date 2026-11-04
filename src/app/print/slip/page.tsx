import type { Metadata } from "next";
import { Suspense } from "react";
import { SlipScreen } from "@/print/SlipScreen";

export const metadata: Metadata = { title: "Packing slip" };

export default function Page() {
  return (
    <Suspense>
      <SlipScreen />
    </Suspense>
  );
}

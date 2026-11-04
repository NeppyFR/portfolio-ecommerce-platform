import type { Metadata } from "next";
import { Suspense } from "react";
import { DropsScreen } from "@/desk/commerce/drops/DropsScreen";

export const metadata: Metadata = { title: "Drops" };

export default function Page() {
  return (
    <Suspense>
      <DropsScreen />
    </Suspense>
  );
}

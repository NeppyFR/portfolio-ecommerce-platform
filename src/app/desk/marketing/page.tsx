import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingScreen } from "@/desk/growth/marketing/MarketingScreen";

export const metadata: Metadata = { title: "Marketing" };

export default function Page() {
  return (
    <Suspense>
      <MarketingScreen />
    </Suspense>
  );
}

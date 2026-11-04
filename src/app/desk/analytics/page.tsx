import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsScreen } from "@/desk/growth/analytics/AnalyticsScreen";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return (
    <Suspense>
      <AnalyticsScreen />
    </Suspense>
  );
}

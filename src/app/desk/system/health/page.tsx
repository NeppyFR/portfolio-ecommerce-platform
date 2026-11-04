import type { Metadata } from "next";
import { Suspense } from "react";
import { HealthScreen } from "@/desk/system/health/HealthScreen";

export const metadata: Metadata = { title: "Health" };

export default function Page() {
  return (
    <Suspense>
      <HealthScreen />
    </Suspense>
  );
}

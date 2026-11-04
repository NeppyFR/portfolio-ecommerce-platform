import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardScreen } from "@/desk/dashboard/DashboardScreen";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Suspense>
      <DashboardScreen />
    </Suspense>
  );
}

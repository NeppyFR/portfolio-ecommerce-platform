import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityScreen } from "@/desk/system/activity/ActivityScreen";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return (
    <Suspense>
      <ActivityScreen />
    </Suspense>
  );
}

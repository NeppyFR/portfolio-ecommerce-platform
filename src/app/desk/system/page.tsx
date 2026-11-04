import type { Metadata } from "next";
import { Suspense } from "react";
import { SystemScreen } from "@/desk/system/overview/SystemScreen";

export const metadata: Metadata = { title: "System overview" };

export default function Page() {
  return (
    <Suspense>
      <SystemScreen />
    </Suspense>
  );
}

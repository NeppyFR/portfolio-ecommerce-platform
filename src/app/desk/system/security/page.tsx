import type { Metadata } from "next";
import { Suspense } from "react";
import { SecurityScreen } from "@/desk/system/security/SecurityScreen";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return (
    <Suspense>
      <SecurityScreen />
    </Suspense>
  );
}

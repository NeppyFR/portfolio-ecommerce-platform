import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfigScreen } from "@/desk/system/config/ConfigScreen";

export const metadata: Metadata = { title: "Config" };

export default function Page() {
  return (
    <Suspense>
      <ConfigScreen />
    </Suspense>
  );
}

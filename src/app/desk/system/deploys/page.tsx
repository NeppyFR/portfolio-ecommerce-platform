import type { Metadata } from "next";
import { Suspense } from "react";
import { DeploysScreen } from "@/desk/system/deploys/DeploysScreen";

export const metadata: Metadata = { title: "Deploys" };

export default function Page() {
  return (
    <Suspense>
      <DeploysScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CiScreen } from "@/desk/system/ci/CiScreen";

export const metadata: Metadata = { title: "Code and CI" };

export default function Page() {
  return (
    <Suspense>
      <CiScreen />
    </Suspense>
  );
}

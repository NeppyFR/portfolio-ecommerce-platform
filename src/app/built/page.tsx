import type { Metadata } from "next";
import { Suspense } from "react";
import { BuiltScreen } from "@/built/BuiltScreen";

export const metadata: Metadata = { title: "How it is really built" };

export default function Page() {
  return (
    <Suspense>
      <BuiltScreen />
    </Suspense>
  );
}

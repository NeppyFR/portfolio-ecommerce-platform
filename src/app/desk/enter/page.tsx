import type { Metadata } from "next";
import { Suspense } from "react";
import { EnterScreen } from "@/desk/enter/EnterScreen";

export const metadata: Metadata = { title: "Who are you?" };

export default function Page() {
  return (
    <Suspense>
      <EnterScreen />
    </Suspense>
  );
}

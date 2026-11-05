import type { Metadata } from "next";
import { Suspense } from "react";
import { BuiltScreen } from "@/built/BuiltScreen";
import { DeskShell } from "@/desk/shell/DeskShell";

export const metadata: Metadata = { title: "How it was built" };

export default function Page() {
  return (
    <DeskShell>
      <Suspense>
        <BuiltScreen />
      </Suspense>
    </DeskShell>
  );
}

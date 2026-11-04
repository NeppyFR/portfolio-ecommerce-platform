import type { Metadata } from "next";
import { Suspense } from "react";
import { ChecklistScreen } from "@/desk/work/checklist/ChecklistScreen";

export const metadata: Metadata = { title: "Checklist" };

export default function Page() {
  return (
    <Suspense>
      <ChecklistScreen />
    </Suspense>
  );
}

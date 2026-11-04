import type { Metadata } from "next";
import { Suspense } from "react";
import { DatabaseScreen } from "@/desk/system/database/DatabaseScreen";

export const metadata: Metadata = { title: "Database" };

export default function Page() {
  return (
    <Suspense>
      <DatabaseScreen />
    </Suspense>
  );
}

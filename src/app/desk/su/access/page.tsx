import type { Metadata } from "next";
import { Suspense } from "react";
import { SuAccessScreen } from "@/desk/su/access/SuAccessScreen";

export const metadata: Metadata = { title: "Feature access" };

export default function Page() {
  return (
    <Suspense>
      <SuAccessScreen />
    </Suspense>
  );
}

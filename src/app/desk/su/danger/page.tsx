import type { Metadata } from "next";
import { Suspense } from "react";
import { SuDangerScreen } from "@/desk/su/danger/SuDangerScreen";

export const metadata: Metadata = { title: "Danger zone" };

export default function Page() {
  return (
    <Suspense>
      <SuDangerScreen />
    </Suspense>
  );
}

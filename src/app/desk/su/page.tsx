import type { Metadata } from "next";
import { Suspense } from "react";
import { SuScreen } from "@/desk/su/SuScreen";

export const metadata: Metadata = { title: "superUser" };

export default function Page() {
  return (
    <Suspense>
      <SuScreen />
    </Suspense>
  );
}

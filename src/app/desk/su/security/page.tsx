import type { Metadata } from "next";
import { Suspense } from "react";
import { SuSecurityScreen } from "@/desk/su/security/SuSecurityScreen";

export const metadata: Metadata = { title: "superUser security" };

export default function Page() {
  return (
    <Suspense>
      <SuSecurityScreen />
    </Suspense>
  );
}

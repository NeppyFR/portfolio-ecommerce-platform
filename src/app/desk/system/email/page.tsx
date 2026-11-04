import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailScreen } from "@/desk/system/email/EmailScreen";

export const metadata: Metadata = { title: "Email" };

export default function Page() {
  return (
    <Suspense>
      <EmailScreen />
    </Suspense>
  );
}

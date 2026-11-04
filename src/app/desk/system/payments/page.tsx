import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsScreen } from "@/desk/system/payments/PaymentsScreen";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return (
    <Suspense>
      <PaymentsScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutResultScreen } from "@/shop/CheckoutResultScreen";

export const metadata: Metadata = { title: "Checkout result" };

export default function Page() {
  return (
    <Suspense>
      <CheckoutResultScreen />
    </Suspense>
  );
}

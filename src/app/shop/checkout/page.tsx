import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutScreen } from "@/shop/CheckoutScreen";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return (
    <Suspense>
      <CheckoutScreen />
    </Suspense>
  );
}

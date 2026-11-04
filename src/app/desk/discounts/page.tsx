import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscountsScreen } from "@/desk/commerce/discounts/DiscountsScreen";

export const metadata: Metadata = { title: "Discounts" };

export default function Page() {
  return (
    <Suspense>
      <DiscountsScreen />
    </Suspense>
  );
}

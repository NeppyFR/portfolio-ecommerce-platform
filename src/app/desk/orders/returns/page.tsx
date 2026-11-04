import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnsScreen } from "@/desk/commerce/orders/ReturnsScreen";

export const metadata: Metadata = { title: "Returns" };

export default function Page() {
  return (
    <Suspense>
      <ReturnsScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersScreen } from "@/desk/commerce/orders/OrdersScreen";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return (
    <Suspense>
      <OrdersScreen />
    </Suspense>
  );
}

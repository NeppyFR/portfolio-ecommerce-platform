import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryScreen } from "@/desk/commerce/inventory/InventoryScreen";

export const metadata: Metadata = { title: "Inventory" };

export default function Page() {
  return (
    <Suspense>
      <InventoryScreen />
    </Suspense>
  );
}

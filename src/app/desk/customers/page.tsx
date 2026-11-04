import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersScreen } from "@/desk/commerce/customers/CustomersScreen";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}

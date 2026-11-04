import type { Metadata } from "next";
import { Suspense } from "react";
import { CollectionsScreen } from "@/desk/commerce/products/CollectionsScreen";

export const metadata: Metadata = { title: "Collections" };

export default function Page() {
  return (
    <Suspense>
      <CollectionsScreen />
    </Suspense>
  );
}

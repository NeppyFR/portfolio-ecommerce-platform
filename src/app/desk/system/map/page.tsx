import type { Metadata } from "next";
import { Suspense } from "react";
import { MapScreen } from "@/desk/system/map/MapScreen";

export const metadata: Metadata = { title: "Hosting map" };

export default function Page() {
  return (
    <Suspense>
      <MapScreen />
    </Suspense>
  );
}

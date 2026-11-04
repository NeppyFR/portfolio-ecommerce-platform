import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/desk/settings/SettingsScreen";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}

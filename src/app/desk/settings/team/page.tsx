import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamScreen } from "@/desk/settings/team/TeamScreen";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return (
    <Suspense>
      <TeamScreen />
    </Suspense>
  );
}

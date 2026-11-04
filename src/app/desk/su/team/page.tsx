import type { Metadata } from "next";
import { Suspense } from "react";
import { SuTeamScreen } from "@/desk/su/team/SuTeamScreen";

export const metadata: Metadata = { title: "Team and sign-in" };

export default function Page() {
  return (
    <Suspense>
      <SuTeamScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { DeskShell } from "@/desk/shell/DeskShell";
import { LandingScreen } from "@/landing/LandingScreen";

/** The overview lives inside the desk: the same sidebar and header cluster as every desk screen, the page beside them. */
export default function Page() {
  return (
    <DeskShell>
      <Suspense>
        <LandingScreen />
      </Suspense>
    </DeskShell>
  );
}

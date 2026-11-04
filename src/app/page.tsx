import { Suspense } from "react";
import { LandingScreen } from "@/landing/LandingScreen";

export default function Page() {
  return (
    <Suspense>
      <LandingScreen />
    </Suspense>
  );
}

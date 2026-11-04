import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxScreen } from "@/desk/growth/inbox/InboxScreen";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return (
    <Suspense>
      <InboxScreen />
    </Suspense>
  );
}

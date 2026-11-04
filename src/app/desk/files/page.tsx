import type { Metadata } from "next";
import { Suspense } from "react";
import { FilesScreen } from "@/desk/work/files/FilesScreen";

export const metadata: Metadata = { title: "Files" };

export default function Page() {
  return (
    <Suspense>
      <FilesScreen />
    </Suspense>
  );
}

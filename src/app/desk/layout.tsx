import type { ReactNode } from "react";
import { DeskShell } from "@/desk/shell/DeskShell";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return <DeskShell>{children}</DeskShell>;
}

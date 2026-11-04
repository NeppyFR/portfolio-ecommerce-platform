import type { ReactNode } from "react";
import { Scale } from "lucide-react";

/** A small sentence beside the action it governs: "A payout books once. A second try is refused." */
export function RuleLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`ui-rule type-small ${className ?? ""}`}>
      <Scale size={14} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

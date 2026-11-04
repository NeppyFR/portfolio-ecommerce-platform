"use client";

import { FlaskConical } from "lucide-react";
import { useT } from "@/i18n";
import { common } from "@/i18n/dict/common";

export type DemoPillProps = { compact?: boolean; className?: string };

export function DemoPill({ compact, className }: DemoPillProps) {
  const t = useT(common);
  return (
    <span className={`ui-demopill type-mono-s ${className ?? ""}`} title={t.demoTooltip}>
      <FlaskConical size={13} aria-hidden="true" />
      {compact ? t.demoShort : t.demoPill}
    </span>
  );
}

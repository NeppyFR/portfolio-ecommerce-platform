"use client";

import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type EmptyProps = { icon?: LucideIcon; children: ReactNode; action?: ReactNode; className?: string };

export function Empty({ icon: Icon = Inbox, children, action, className }: EmptyProps) {
  return (
    <div className={`ui-empty ${className ?? ""}`}>
      <span className="ui-empty-tile" aria-hidden="true">
        <Icon size={20} />
      </span>
      <p className="type-body">{children}</p>
      {action}
    </div>
  );
}

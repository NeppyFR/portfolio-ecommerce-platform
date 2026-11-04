"use client";

import { ShieldUser } from "lucide-react";
import { useIdentity } from "@/store/actions/profile";
import type { Profile } from "@/store/types";

export function Avatar({ profile, size = "md" }: { profile: Profile; size?: "md" | "lg" }) {
  const { initials } = useIdentity(profile);
  return (
    <span className="dk-avatar" data-size={size} aria-hidden="true">
      {initials ?? <ShieldUser size={size === "lg" ? 20 : 16} strokeWidth={1.75} />}
    </span>
  );
}

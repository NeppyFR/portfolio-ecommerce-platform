"use client";

import { useEffect, useState } from "react";
import { subscribe } from "@/store/core";

/** Counts store mutations after mount. Touches restarts its chip-dot pulse when this changes. */
export function useStorePulse(): number {
  const [pulse, setPulse] = useState(0);
  useEffect(() => subscribe(() => setPulse((n) => n + 1)), []);
  return pulse;
}

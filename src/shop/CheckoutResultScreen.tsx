"use client";

import { useSearchParams } from "next/navigation";
import type { CheckoutResultState } from "@/store/types";
import { ResultPanel } from "./ResultPanel";

const STATES: CheckoutResultState[] = ["completed", "pending", "cancelled", "expired", "failed", "unknown"];

/** A bare URL or a value it does not know reads as `unknown`. */
export function CheckoutResultScreen() {
  const params = useSearchParams();
  const raw = params.get("state");
  const state = STATES.find((s) => s === raw) ?? "unknown";
  return <ResultPanel state={state} orderNumber={params.get("order")} />;
}

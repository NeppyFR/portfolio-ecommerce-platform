import { CARRIER } from "./brand";

/** Weights 8 6 4 2 3 5 9 7 on the 8 digits; c = 11 − (sum mod 11); 10 becomes 0, 11 becomes 5. */
export function trackingCheckDigit(digits: string): number {
  const sum = [...digits].reduce((total, d, i) => total + Number(d) * CARRIER.checkWeights[i], 0);
  const c = 11 - (sum % 11);
  if (c === 10) return 0;
  return c === 11 ? 5 : c;
}

/** `makeTracking(12345678)` gives `BP123456785ZZ`. */
export function makeTracking(serial: number): string {
  const digits = String(serial).padStart(8, "0").slice(-8);
  return `${CARRIER.trackingPrefix}${digits}${trackingCheckDigit(digits)}${CARRIER.trackingSuffix}`;
}

export type TrackingCheck = "ok" | "format" | "check_digit";

export function checkTracking(value: string): TrackingCheck {
  const match = /^BP(\d{8})(\d)ZZ$/.exec(value.trim().toUpperCase());
  if (!match) return "format";
  return trackingCheckDigit(match[1]) === Number(match[2]) ? "ok" : "check_digit";
}

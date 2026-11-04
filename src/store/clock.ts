/** Render reads this constant, so the build and the browser agree. */
export const DEMO_NOW = "2027-01-08T14:02:00+01:00";
export const DEMO_NOW_MS = Date.parse(DEMO_NOW);
export const DEMO_TIME_ZONE = "Europe/Zurich";
export const DEMO_TODAY = "2027-01-08";
export const DEMO_MONTH = "2027-01";

const mountedAt = typeof performance === "undefined" ? 0 : performance.now();

/** For new records only: DEMO_NOW plus the time elapsed since mount. */
export function now(): string {
  const elapsed = typeof performance === "undefined" ? 0 : performance.now() - mountedAt;
  return new Date(DEMO_NOW_MS + Math.floor(elapsed)).toISOString();
}

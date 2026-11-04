export const VAT_STANDARD_BP = 810;
export const VAT_REDUCED_BP = 260;
export const VAT_ZERO_BP = 0;

/** The tax inside a gross amount, half up, with the amount's sign. CHF 100.00 at 8.1 percent holds 7.49. */
export function vatIncluded(amount: number, bp: number): number {
  const d = 10000 + bp;
  const q = Math.floor((2 * Math.abs(amount) * bp + d) / (2 * d));
  return amount < 0 ? -q : q;
}

/** `810` gives `8.1`, `0` gives `0`. */
export const vatRatePercent = (bp: number): string => String(bp / 100);

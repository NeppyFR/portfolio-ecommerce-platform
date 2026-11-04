import type { Cost, CostBooking, Rappen } from "@/store/types";
import { addMonths, monthOf } from "./dates";

/** Active and in range. Monthly costs are always due; yearly ones only in their start month. A planned cost is never due. */
export function isDue(cost: Pick<Cost, "state" | "billing" | "startsOn" | "endsOn">, month: string): boolean {
  if (cost.state !== "active") return false;
  if (cost.startsOn && month < monthOf(cost.startsOn)) return false;
  if (cost.endsOn && month > monthOf(cost.endsOn)) return false;
  if (cost.billing === "monthly") return true;
  return cost.startsOn !== null && cost.startsOn.slice(5, 7) === month.slice(5, 7);
}

/** Costs with an expected amount, due this month, with no booking for the month. */
export function unbookedIn(costs: Cost[], bookings: CostBooking[], month: string): Cost[] {
  return costs.filter((c) => c.expectedMinor > 0 && isDue(c, month) && !bookings.some((b) => b.costId === c.id && b.month === month));
}

/**
 * Booked truth, never planner figures. Takes the distinct booked months before the current one,
 * newest three. A yearly booking is spread over the 12 months from its own month.
 * Null when no month qualifies.
 */
export function runningPerMonth(costs: Pick<Cost, "id" | "billing">[], bookings: CostBooking[], currentMonth: string): Rappen | null {
  const months = [...new Set(bookings.map((b) => b.month).filter((m) => m < currentMonth))].sort().reverse().slice(0, 3);
  if (months.length === 0) return null;
  const billing = new Map(costs.map((c) => [c.id, c.billing]));
  let total = 0;
  for (const booking of bookings) {
    if (billing.get(booking.costId) === "yearly") {
      const last = addMonths(booking.month, 11);
      const covered = months.filter((m) => m >= booking.month && m <= last).length;
      total += (booking.amountRappen * covered) / 12;
    } else if (months.includes(booking.month)) {
      total += booking.amountRappen;
    }
  }
  return Math.round(total / months.length);
}

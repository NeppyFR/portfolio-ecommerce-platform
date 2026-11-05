import { registerReset } from "@/store/core";
import { simulateIncomingOrder } from "@/store/flows";

let played = false;
registerReset(() => {
  played = false;
});

export const incomingOrderPlayed = (): boolean => played;

/** The one simulated order a visit gets, wherever it shows first: the landing's miniature or the Dashboard. Null once it has played. */
export function playIncomingOrder(): ReturnType<typeof simulateIncomingOrder> | null {
  if (played) return null;
  played = true;
  return simulateIncomingOrder();
}

export const MAX_PER_LINE = 500;
export const MAX_LINES = 100;

export type ReceiveLine = { sku: string; variantId: string; quantity: number };
export type ReceiveState = { lines: ReceiveLine[]; scans: string[] };
export type ReceiveAdd = { state: ReceiveState; result: "added" | "line_full" | "too_many_lines"; quantity: number; total: number };

export const EMPTY_RECEIVE: ReceiveState = { lines: [], scans: [] };

export const receiveTotal = (state: ReceiveState): number => state.lines.reduce((sum, l) => sum + l.quantity, 0);

/** Each scan adds 1 to its size, newest size first. */
export function receiveAdd(state: ReceiveState, sku: string, variantId: string): ReceiveAdd {
  const line = state.lines.find((l) => l.sku === sku);
  if (line && line.quantity >= MAX_PER_LINE) return { state, result: "line_full", quantity: line.quantity, total: receiveTotal(state) };
  if (!line && state.lines.length >= MAX_LINES) return { state, result: "too_many_lines", quantity: 0, total: receiveTotal(state) };
  const lines = line ? state.lines.map((l) => (l.sku === sku ? { ...l, quantity: l.quantity + 1 } : l)) : [{ sku, variantId, quantity: 1 }, ...state.lines];
  const next = { lines, scans: [...state.scans, sku] };
  return { state: next, result: "added", quantity: (line?.quantity ?? 0) + 1, total: receiveTotal(next) };
}

/** Plus or minus on a row. A row that reaches zero goes away. */
export function receiveStep(state: ReceiveState, sku: string, delta: 1 | -1): ReceiveState {
  const line = state.lines.find((l) => l.sku === sku);
  if (!line) return state;
  const quantity = Math.min(MAX_PER_LINE, line.quantity + delta);
  const lines = quantity <= 0 ? state.lines.filter((l) => l.sku !== sku) : state.lines.map((l) => (l.sku === sku ? { ...l, quantity } : l));
  let scans = state.scans;
  if (delta > 0) scans = [...scans, sku];
  else {
    const at = scans.lastIndexOf(sku);
    if (at >= 0) scans = [...scans.slice(0, at), ...scans.slice(at + 1)];
  }
  return { lines, scans };
}

export function receiveRemove(state: ReceiveState, sku: string): ReceiveState {
  return { lines: state.lines.filter((l) => l.sku !== sku), scans: state.scans.filter((s) => s !== sku) };
}

export function receiveUndo(state: ReceiveState): ReceiveState {
  const last = state.scans.at(-1);
  return last ? receiveStep(state, last, -1) : state;
}

export function isForbidden(name: string): boolean;
export function nameOf(key: string): string;
export function checkDeps(pkg: Record<string, unknown>, lock: { packages?: Record<string, unknown> }): string[];

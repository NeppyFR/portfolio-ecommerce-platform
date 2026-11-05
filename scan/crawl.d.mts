export type RegistryRow = { id: string; route: string; en: string; de: string };
/** One extra crawl entry. `click` opens something first, such as the Danger dialog. */
export type CrawlState = { path: string; click?: string; wait?: number };

export function readRegistry(root?: string): RegistryRow[];
export function outRoutes(outDir?: string): string[];
export function readStates(root?: string): CrawlState[];
export function bodyColourProblem(pathname: string, colour: string): string | null;

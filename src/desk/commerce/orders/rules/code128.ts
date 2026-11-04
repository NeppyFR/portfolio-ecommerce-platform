/**
 * Code 128, subset B, from the public standard. Each pattern lists bar and space widths in modules.
 * Every symbol is 11 modules wide; the stop pattern is 13.
 */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;
/** Blank modules on each side, as the standard asks. */
export const QUIET_MODULES = 10;

export const code128Patterns = (): readonly string[] => PATTERNS;

/** Symbol values for the text in subset B, or null when a character is outside printable ASCII. */
export function code128Values(text: string): number[] | null {
  const values: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) return null;
    values.push(code - 32);
  }
  return values;
}

export const code128CheckValue = (values: number[]): number => values.reduce((sum, value, i) => sum + value * (i + 1), START_B) % 103;

export type Bar = { x: number; w: number };
export type Code128 = { bars: Bar[]; modules: number };

/** Bars in modules, quiet zones included in `modules`. Null when the text cannot be encoded or is empty. */
export function encodeCode128(text: string): Code128 | null {
  const values = code128Values(text);
  if (!values || values.length === 0) return null;
  const symbols = [START_B, ...values, code128CheckValue(values), STOP];
  const bars: Bar[] = [];
  let x = QUIET_MODULES;
  for (const symbol of symbols) {
    const widths = PATTERNS[symbol];
    for (let i = 0; i < widths.length; i += 1) {
      const w = Number(widths[i]);
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
  }
  return { bars, modules: x + QUIET_MODULES };
}

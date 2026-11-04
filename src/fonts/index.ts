import localFont from "next/font/local";

export const fontDisp = localFont({
  src: "./bricolage.woff2",
  variable: "--ff-disp",
  weight: "200 800",
  style: "normal",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 100%" }],
});

export const fontUi = localFont({
  src: "./geist.woff2",
  variable: "--ff-ui",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export const fontMono = localFont({
  src: "./geist-mono.woff2",
  variable: "--ff-mono",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export const fontSerif = localFont({
  src: [
    { path: "./newsreader-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./newsreader-italic.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--ff-serif",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});

export const fontVars = [fontDisp.variable, fontUi.variable, fontMono.variable, fontSerif.variable].join(" ");

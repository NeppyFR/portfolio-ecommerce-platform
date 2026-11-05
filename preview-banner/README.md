# Commerce Platform preview banner

The moving banner for the project's preview on the portfolio. It shows the online shop and its staff system side by side, and one order walking from the first to the second on a 12 s loop.

- `CommercePreview.tsx`: the component. It imports `react` and nothing else. The app does not import it.
- `demo.html`: the same drawings and a plain JS copy of the frame function. It opens from disk with no dependencies, at the width the banner is used at, with a width picker, a scrub slider, a reduced-motion toggle and a language toggle. `window.previewApi` is its test hook.

## Where it goes on the portfolio

The portfolio has a cinematic section for its big project: `CinematicSection({ preview })`. The page goes dark, a title card plays, then `preview` takes over inside a dark rounded frame. This banner is that preview. It does not go in the projects grid: the grid's `ProjectsSection` shows one feature card with `items.find((p) => p.preview)` and hides every other preview item, so a second preview item would vanish with no error.

1. Copy `CommercePreview.tsx` to `src/components/`.
2. Add `src/components/CommerceSlot.tsx`, a client component, because `page.tsx` cannot read the language:

   ```tsx
   "use client";

   import { useContent, useLanguage } from "@/i18n";
   import { CommercePreview } from "./CommercePreview";

   export function CommerceSlot() {
     const { lang } = useLanguage();
     const t = useContent().cinematic;
     return (
       <div className="p-3 sm:p-4">
         <CommercePreview lang={lang} />
         {/* title, stack tags and the demo link, from t */}
       </div>
     );
   }
   ```

3. In `page.tsx`: `{CINEMATIC_ENABLED && <CinematicSection preview={<CommerceSlot />} />}`.
4. The frame is a `div`, so the banner's button is valid there. Text inherits the page's light ink, so the label and button read on the dark frame.
5. The wide art shows from 900 px of its own width. The frame gives it about 1246 px at a 1440 px window, so wide art is what most desktops get. Phones get the compact art.

Blurb EN: `A complete online shop with its staff system, finances and hosting map, rebuilt as a static demo with invented data.`

Blurb DE: `Ein kompletter Onlineshop mit Team-System, Finanzen und Hosting-Karte, als statische Demo mit erfundenen Daten nachgebaut.`

## How it behaves

- **Two drawings, one rule.** The wide art (`viewBox 0 0 1200 420`) shows from 900 px of the root's own width. Under that the compact art (`viewBox 0 0 480 300`, at most 520 px wide, centred) takes over. A container query makes the swap, so server HTML is right before any script runs. A ResizeObserver only picks which frame table the clock writes.
- **Engine.** One rAF on a ref, `transform` and `opacity` only, on `<g>` elements, with no React state per frame. The clock's delta is clamped to 64 ms. It starts once half the banner is on screen, because the portfolio reveals cards late, and it pauses when none of it is on screen or the tab is hidden.
- **Reduced motion.** A still at `t = 9.45` with no rAF. The button shows the fault still at `t = 5`.
- **Props.** `lang: "en" | "de"`, `labels?`, `className`. The ref gives `{ seek(t), play(), pause(), t }`, and the root's `data-t` follows each seek.
- **Numbers.** The KPI values before the order are what `/desk/` shows on a fresh load: CHF 2'237, 19 and 15. The order adds CHF 89, one order and one customer. If the seed changes, change them here too.
- **Colours.** The field is black with an aurora of `#2f6bff`, `#6fd3ff`, `#b9f3ff` and `#8c7bff` moving through it, with a soft blue glow outside the frame, so the banner glows on the portfolio's black section instead of vanishing into it. Windows are near-black cards (`#0b0c10`, inner cards `#14161c`) with a bright sky-to-violet edge, and words are white. The button runs from blue to violet. Its violet end is deepened to `#6a55f5` so white words keep AA. The hoodie, packets, wire, chart line and numbers are the bright end of the palette. Status chips are the light green, amber, violet and sky on dark tints.
- **Mail.** The word for the mail step is `rendered | gerendert`, because the real system renders mail and does not send it.

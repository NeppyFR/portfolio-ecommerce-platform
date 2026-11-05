# Commerce Platform

A static showcase of a complete staff system, the desk, and the online shop it runs. The store is the fictional Aerlo, which sells useful things for home, desk and travel. The desk has orders, inventory, products, drops, finances, inbox, files, a calendar, a checklist, access control and system screens. In front of it sit a storefront and a checkout with four outcomes. Everything runs in your browser. It also has a hosting map, and `/built/` explains how the real system behind this demo is put together.

It is available in English and German, at desktop and phone width.

## Run it

Node 24 and npm.

```bash
npm ci
npm run dev        # serves on port 4417
```

To look at the real output, build it and serve `out/` with any static file server:

```bash
npm run build
```

Start at `/` for the map, `/desk/` for the staff desk and `/shop/` for the shop. `/desk/enter/` lets you step in as one of four invented people or as `superUser`. Each profile sees different screens, and with no profile chosen, a deep link opens as the owner.

## What is fake

All of it, on purpose:

- **No backend.** There is no database, no API route, no server code and no network call to anything but its own static files. The content security policy allows nothing else.
- **No real money.** There is no payment provider and no card field. You pick how a checkout ends: paid, declined, walked away or timed out. Nothing is charged.
- **No real mail.** Emails are rendered and previewed in the page. They are never sent, and `rendered` is the last status they can reach.
- **No real files.** The Files screen keeps names and sizes only and never reads the bytes of what you pick.
- **No real sign-in.** There is a profile choice and no password field.
- **Invented data.** The store, products, people, customers, orders, carrier, ledger, logs, deploys and tracking numbers are made up. The seed is fixed and the clock starts at 8 January 2027 14:02, so every visit starts the same.
- **Nothing is kept.** Changes live in memory and reset when you reload. Only the language and the chosen profile are stored in your browser.

The map on the landing page shows the hosting setup of the real system this demo was rebuilt from. Not all of it runs yet, and the demo runs none of it.

## Tests and gates

```bash
npm test                 # unit tests
npm run typecheck
npm run build
npm run gates            # everything below, in order
```

`npm run gates` needs a finished build. It runs:

| Gate | What it does |
|---|---|
| `scan` | Reads the source, the output and the file names for forbidden patterns: outbound calls, foreign URLs, password or card fields, images, pictographs, and the spelling rule. A binary file passes only if its hash is one of the pinned fonts |
| `deps` | Fails on any forbidden package and on any version that is not exact |
| `outcheck` | Confirms a pure static export, with no route handlers, no server output and no source maps |
| `crawl` | Opens every route and state in Chrome at 1440 and 390 px, in both languages. It fails on a console error, a request to another origin, sideways scrolling, a failed response, a missing screen title, a sheet that stays shut or a body that is not black (the print pages are exempt). It also checks for sideways scrolling at 720, 900 and 1100 px, presses Back and Forward on a product sheet and on the order pane at both widths, then runs one order from the bag through to the desk |
| `test` | Runs the unit tests |

`scan` and `crawl` also accept `--denylist <file>`, a JSON list of extra words the project must never contain. Without it they run the generic checks and print one warning. The crawl uses the installed Chrome.

## Build for GitHub Pages

A project site lives under a sub-path, so the build needs that path as its base:

```bash
NEXT_PUBLIC_BASE_PATH=/portfolio-ecommerce-platform npm run build
```

In PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = "/portfolio-ecommerce-platform"; npm run build
```

The crawl honours the same variable, so run it with the variable set to check that build. Unset the variable before you build for the root again.

`.github/workflows/pages.yml` does this on a push to `main`, or when started by hand. To use it, set Pages to "GitHub Actions" in the repository settings. If the repository has another name, change the path in the workflow too.

The workflow also runs `outcheck` and fails if anything under `reference/` is tracked. It does not run `scan` with a private word list, because that list never enters the project. A public repository shows its source from the first push on, so run this locally before any first push, with the list kept outside the project:

```bash
node scan/scan.mjs --denylist <path outside the project>
```

## Layout

```
src/app/      route files only
src/landing/  src/built/  src/shop/  src/desk/  src/print/   the surfaces
src/art/      the drawn products
src/store/    in-memory store, seed, shared flows, actions
src/lib/      pure rules and helpers
src/i18n/     dictionaries, one per area
src/ui/       primitives and hand-drawn charts
src/map/      the hosting map
scan/         gates
tests/        unit tests
preview-banner/   a standalone animated preview card, not part of the app
```

The fonts are under the SIL Open Font License, see `src/fonts/LICENSES.txt`.

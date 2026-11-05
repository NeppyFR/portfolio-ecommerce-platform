# Coverage

What the original system had, and where it lives in this demo. The routes are the demo's. The crawl loads every route and state at 1440 and 390 px in English and German. A desk route fails if it does not render its registry title or if it shows the locked state.

**Evidence, in order of strength:**

- **Crawl:** a route loads and renders, and every `?open=` state really opens its sheet.
- **Clicked:** the control was clicked in the exported build at 1440 and 390 px, and the URL and the screen both followed.
- **Tests:** rules and actions covered by `tests/`.
- **Read:** the labels and fields noted from the real system were compared with the screen's strings. Nobody used the screen for that row.

## Screen by screen

| Real screen | In this demo | Presentation | Evidence |
|---|---|---|---|
| Home page (the 3D one) | `/desk/` | Replaced by the Dashboard. See "Changed on purpose" | Crawl, clicked, tests |
| Login | `/desk/enter/` | Profile choice, no password. The copy names the real scrypt hash and the lock after 5 tries | Crawl, tests |
| Who are you, owner step | `/desk/enter/` | Merged. Four people plus `superUser` | Crawl, tests |
| Orders | `/desk/orders/` | Lifecycle stops, scan bar, search, dates | Crawl, clicked, tests |
| Order detail | `/desk/orders/?o=AL-1042` | Notched pane on desktop, bottom sheet on a phone | Crawl, clicked, tests |
| Packing slip | `/print/slip/?o=` | A4, print CSS, Code 128 | Crawl, tests |
| Returns | `/desk/orders/returns/` | Open and Done tabs. Return dialogs live on the order | Crawl, tests |
| Labels | `/print/labels/` | 3×8 A4 and 62 mm roll | Crawl, tests |
| Products, new, edit | `/desk/products/`, `?open=new`, `?open=<id>` | Table plus wide sheet | Crawl, clicked, tests |
| Collections | `/desk/products/collections/` | List plus sheet | Crawl, tests |
| Inventory | `/desk/inventory/?tab=&filter=&q=` | Scan bar, Stock and History, adjust dialog | Crawl, clicked, tests |
| Customers, detail | `/desk/customers/`, `?open=<id>` | Table plus sheet with JSON download and erase | Crawl, clicked, tests |
| Discounts | `/desk/discounts/` | State tabs, editor sheet | Crawl, clicked, tests |
| Drops, one drop | `/desk/drops/`, `?open=<id>` | Cards plus wide sheet | Crawl, tests |
| Production, one order | `/desk/production/`, `?open=<id>` | Table, suppliers dialog, wide sheet, receive dialog | Crawl, clicked, tests |
| Marketing | `/desk/marketing/` | Three-column board | Crawl, tests |
| Analytics | `/desk/analytics/` | KPI row, panels, CSV | Crawl, clicked, tests |
| Inbox | `/desk/inbox/?open=` | Table plus sheet with triage | Crawl, clicked, tests |
| Files | `/desk/files/` | Where row, grid or list, sheet | Crawl, clicked, tests |
| Calendar | `/desk/calendar/` | Month, Week, Agenda | Crawl, clicked, tests |
| Checklist | `/desk/checklist/` | By list, Mine, Week | Crawl, clicked, tests |
| Finances | `/desk/finance/` | Ledger, accounts, filters, money map | Crawl, clicked, tests |
| Running costs | `/desk/finance/costs/` | Three-part planner with the real plan evaluation | Crawl, tests |
| Quarterly report | `/desk/finance/reports/` | Report table, CSV, VAT summary when on | Crawl, clicked, tests |
| Refunds | `/desk/finance/refunds/` | Two cards, CSV | Crawl, tests |
| Stock count | `/desk/finance/stock-count/` | Draft and confirmed, CSV | Crawl, tests |
| IT overview | `/desk/system/` | Attention, area cards, watchdog, small map | Crawl, tests |
| Hosting map | `/desk/system/map/` | Full map plus two tables | Crawl, tests |
| Health | `/desk/system/health/` | Run button, 27 checks, history | Crawl, tests |
| Database | `/desk/system/database/` | Facts, migrations, tables, storage | Crawl, tests |
| Payments | `/desk/system/payments/` | Mode, gap, holds, releases, events | Crawl, tests |
| Email, outbox, one email, inbox settings | `/desk/system/email/`, `?tab=outbox`, `&open=<id>`, `?tab=inbox` | Sub tabs, sheet, sandboxed preview, retry | Crawl, clicked, tests |
| Security, access | `/desk/system/security/`, `?tab=access` | Sub tabs, lock, attempts | Crawl, clicked, tests |
| Config | `/desk/system/config/` | Variable names only, rotation reminders | Crawl, tests |
| Deploys | `/desk/system/deploys/` | Invented rows, inert | Crawl |
| Code and CI | `/desk/system/ci/` | Invented rows, inert | Crawl |
| Activity | `/desk/system/activity/` | Filterable log | Crawl, tests |
| Settings, team | `/desk/settings/`, `/desk/settings/team/` | Four cards. List, edit dialog, lock rules | Crawl, tests |
| superUser overview | `/desk/su/` | Six cards | Crawl, tests |
| Feature access | `/desk/su/access/` | Matrix and sidebar preview | Crawl, tests |
| Team and sign-in | `/desk/su/team/` | Team and rotation dates, no fields | Crawl, tests |
| superUser security | `/desk/su/security/` | Sessions, sign-out rows | Crawl, tests |
| Danger zone | `/desk/su/danger/` | Harmless previews plus a real `Reset this demo` | Crawl (dialog opened), tests |
| Storefront: home, collection, product, bag, checkout, result, search, not found | `/shop/**`, `not-found.tsx` | Same behaviour, new look | Crawl, one order end to end, tests |
| Bell, live pill, test-mode pill, language, profile switch | Page header | Header band on desktop, top bar on a phone | Crawl, tests |
| Error boundary, skip links, shop footer | `error.tsx`, `global-error.tsx`, each surface | | Read. The boundaries are not triggered by any gate |
| Global search (not in the original) | Ctrl K jump box | Labelled as a demo aid on `/built/#demo` | Clicked |
| Road to the books (not in the original) | Order detail panel | Labelled as a demo addition on the panel and on `/built/#demo`. The real system books one entry per payout | Crawl, read |
| Try a month (not in the original) | `/desk/finance/costs/` | Labelled as a demo aid on the screen and on `/built/#demo` | Crawl, read |

Cross-links noted from the real system, checked in this demo's source: bell and status links, an order line to its product, a return to its order, a customer's order row to the order, a campaign code to `discounts?q=`, a tag to `products?tag=`, a variant's on-hand number to `inventory?q=`, and drops to Files, Finances and Checklist.

## Changed on purpose

- **Home.** A reference picture from the owner led to a new start page: the Dashboard replaces the sentence-title Today page. It has four KPI cards, Revenue beside a donut, Recent Orders, Stock Alerts and Tasks. Gone with it: the packing list, the health dots, the seven-day sparkline, hourly revenue bars and the next-campaign rows. The bell and the sidebar badge keep the counts, and the Orders stops still link the same filters.
- **Navigation.** A permanent sidebar, like the original's. Its 64 px icon rail and collapse button were not carried: at 1200 px and up the sidebar stays open, and below that it opens as a drawer.
- **Sign-in.** All login, session and rate-limit messages are gone, because there is no sign-in.
- **Providers.** Failure paths that need a live provider do not exist. "Not connected", "could not be read", "key is live" and similar sentences are left out. The seed shows all five tones through fixtures, and one System toggle demonstrates `unknown`.
- **Carrier.** Tracking validates the invented carrier's format. The real long dotted format is merged into it.
- **Catalogue.** The real store's range is not carried. The fictional store sells useful things for home, desk and travel, and every product is drawn. Products with sizes use S, M, L and XL, and their second colour run gets a Colour selector above Size on the product page.

## Cut on purpose

| Area | Simpler treatment |
|---|---|
| Inventory and Orders | Scan sounds, camera and global key capture are cut. Fields take typed input plus `Scan next` |
| Checklist | Reorder by buttons. Week view is read-only |
| Files | No fullscreen viewer. Logos are a filter. Drawers do not resize. Picking a file records its name, size and type only |
| Products | Product art and tone pickers replace image upload. Collections are a plain list |
| Marketing | Board cards have no drag |
| Costs | The storage card shows the database estimate plus one provider block, with no bucket parsing. Connector states are one fixture. The Prices dialog has no history |
| System | History is a plain list |
| superUser | The matrix has no bulk bar |
| Finance | `Pin Finance under any screen` is cut |
| Motion | Camera moves and View Transitions are cut |

## Known gaps

- **Ledger by drop.** The Drop sheet's and the purchase order's `Open in Finances` open the whole ledger, because the ledger has no `?drop=` filter.
- **One-language store text.** File titles, drop descriptions, campaign names and notes, mail subjects and activity details are store data, so a German page shows them as seeded. Seeded tasks, events, ledger rows and cost names are translated at display time.
- **Very narrow phones.** At 360 px the System overview map's text renders at 11 px, under the 12 px floor. It holds at 390 px and up.
- **German map on a phone.** Service boxes on the System overview hide the tile behind the icon so that `Inbox-Aufgabe` fits. English keeps the tile.
- **Wide map.** The wide map starts at 1280 because its 12 px text floor cannot hold below that, so tablets and small laptops get the phone map.
- **Native date fields.** They follow the browser's locale, not the page language.
- **First paint.** A direct load of a superUser route shows the locked state for a moment, because static HTML cannot know the session's profile.
- **Motion.** Packets and the banner were only checked by seek and frame comparison in headless Chrome. Smoothness in a real foreground tab is unproven.

# Requirements and implementation status

Last updated: 21 September 2026. This document describes the implemented app, verified behavior, and remaining limitations. API formats and observations are in `API-RESEARCH.md` and `api-audit.json`.

## Requirement checklist

| Requirement                                  | Implementation                                                                                                                                     | Status                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| React mobile web app                         | React 19, TypeScript, Vite; responsive mobile/desktop layouts                                                                                      | Implemented                                                                |
| iOS Home Screen behavior                     | Standalone manifest, 192/512 PNG icons, Apple touch icon, safe-area spacing, production service worker                                             | Implemented; physical-device installation still requires manual validation |
| Maintain user data                           | Local bookmark/language persistence, storage error reporting, JSON backup export and validated merging import, optional persistent-storage request | Implemented; local only                                                    |
| Research APIs before implementation          | Official operator docs, endpoint tables, live catalogue letter audit and CORS checks                                                               | Completed                                                                  |
| KMB + Long Win                               | Bulk route/stop/relationship import; direction and service variants; live ETA                                                                      | Implemented and live catalogue verified                                    |
| Citybus                                      | Both directions per route; deduplicated individual stop fetching; live ETA                                                                         | Implemented and full live catalogue verified                               |
| New Lantao Bus                               | Route-ID variants, ordered stops, bilingual ETA adapter and explicit HK timestamp parsing                                                          | Implemented and live catalogue verified                                    |
| English + Traditional Chinese                | All main UI strings, bilingual operator names, stop/route names, ETA remarks and persisted preference                                              | Implemented; browser-tested                                                |
| Download large route details on first launch | Worker starts automatically, commits each provider independently, shows download progress                                                          | Implemented                                                                |
| Efficient local route structure              | Variant IDs, provider-prefixed stop records, route stop arrays and reverse stop-to-route index in IndexedDB                                        | Implemented                                                                |
| Manual data refresh and timestamps           | Settings has per-provider last-success timestamps and refresh button                                                                               | Implemented                                                                |
| Weekly nonblocking refresh                   | Checks on launch/resume/reconnection and hourly while active; seven-day threshold; prior snapshots remain usable                                   | Implemented within iOS execution constraints                               |
| Interrupted downloads                        | Persisted per-request checkpoints and retry/backoff; provider snapshot commits atomically                                                          | Implemented                                                                |
| Apple-style interface                        | System type, large titles, grouped lists, tab bar, touch controls, system dark mode, focus styles, reduced motion                                  | Implemented; visual inspection completed                                   |
| Bookmark stops                               | Route, direction, service, stop and exact sequence retained                                                                                        | Implemented                                                                |
| User-defined groups across routes            | Same named group joins arbitrary routes/stops; all ETAs shown together on Saved                                                                    | Implemented                                                                |
| Nearby stops by GPS                          | User-triggered location, permission/error state, accuracy, 1km radius, distance ordering, route drill-down                                         | Implemented; simulated GPS tested                                          |
| Route-number search                          | Offline substring search with exact matches first, company filters, paginated results                                                              | Implemented                                                                |
| Custom numpad with actual route letters      | 0–9, clear/backspace and 18 verified letters; dynamically re-derived from downloaded catalogues; native mobile keyboard suppressed                 | Implemented                                                                |
| WebStorm setup / iPhone 17 Pro Max           | Shared npm run configuration, 440×956 @3x WebKit profile, README mobile/HTTPS instructions                                                         | Implemented                                                                |
| Requirement and state documentation          | This file plus API research and README                                                                                                             | Completed                                                                  |
| Jointly operated routes                      | Automatic TD membership; merged journeys, itineraries and ETAs; existing bookmarks preserved                                                       | Implemented with conservative matching; see joint-route limits below       |
| Popular packages                             | React, Vite, TypeScript, idb, Lucide, vite-plugin-pwa/Workbox, Vitest, Playwright                                                                  | Implemented                                                                |

## User flows

- **Saved:** real empty state on first use, add-stop shortcut, group filters, live arrival cards, edit group and remove stop. No sample routes or invented arrival times are presented as live data.
- **Routes:** custom keypad, operator filter, offline catalogue, direction/variant-specific route details, ordered stops. Tap a stop for ETA and bookmark it; choose an existing group or name a new one.
- **Nearby:** tap to grant location access, then see up to 40 nearest stops within 1km. Expand a stop to see its routes, then open a route at that stop.
- **Settings:** language, saved theme colour (green, blue, yellow, red or purple), operator download progress/counts/timestamps, manual refresh, backup export/import and Home Screen instructions.

## Correctness and resilience

- ETA filtering distinguishes direction, service and repeated visits to a stop. Missing timestamps show operator remarks or an unavailable state.
- NLB ETA timestamps are interpreted in UTC+08:00 even if the phone is elsewhere. `departed` is not misinterpreted as having passed the requested stop.
- ETA requests deduplicate concurrent calls; short memory caching prevents rapid repeated taps from flooding an endpoint. Polling pauses while the document is hidden; resumes on visibility/connection changes. Failed updates retain only explicitly labelled last-known results.
- Normalized provider snapshots replace old ones only after successful completion. Bookmarks are stored separately and never cleared by catalogue refresh.
- KMB currently references one unavailable stop in two route variants. It is explicitly labelled as missing, not silently removed or assigned a fabricated GPS result. See API research for exact IDs.
- On a later catalogue change, a bookmark whose exact route/stop sequence no longer exists is marked unavailable and directs the user to save it again.
- Corrupt/incompatible backups are rejected. Imports merge by bookmark ID, with imported values winning on conflicts. No existing data is intentionally erased on invalid import.

## Verification

- TypeScript production build and ESLint checks are run on the final code.
- 41 unit tests cover direction/service/sequence filtering, null ETAs, Hong Kong time parsing, route indexes, missing
  references, dynamic keypad letters, distance calculations, validated backups and removed routes, plus joint
  membership, pairing, ETA aggregation and refresh/cache failure handling.
- **26 browser tests passed.** Playwright runs against mobile WebKit (440×956, DPR 3) and desktop Chromium. It covers
  route search → stop ETA → grouped bookmark → reload → Traditional Chinese; simulated GPS; invalid/valid imports;
  offline errors; layout overflow; all-provider first-launch normalization with a missing KMB stop; failed forced
  refresh preserving old snapshots; joint-route search/arrivals, old Citybus bookmarks, partner-only stops and 2X
  isolation.
- The live audit fetched real route lists, stop lists/details, and ETA responses for all three APIs and confirmed CORS support. Evidence is saved in `api-audit.json`.
- Production offline reload, persisted bookmarks, offline route search and standalone manifest checks passed in both Chromium and WebKit with a dedicated local origin server stopped. Chromium also used browser offline mode. WebKit’s automated offline toggle returned an internal engine error, so its cache test used the stopped origin and aborted upstream requests instead; this limitation remains distinct from real iPhone validation.

## Known limits / remaining manual verification

1. **iOS suspension:** no guaranteed weekly job while the app is closed. An overdue download runs when the app next becomes active. This is a platform limit, not a claim of background scheduling support.
2. **Initial Citybus download is slow:** its documented API needs hundreds of route-direction requests plus thousands of unique stop requests. The worker limits concurrency and resumes checkpoints. Citybus route search and on-demand route details are now usable before the full download finishes; nearby Citybus discovery still requires its completed offline snapshot. KMB/NLB are usable independently. A future optional server-generated snapshot could shorten first launch, but no unverified third-party bulk feed is used.
3. **Local persistence only:** no accounts or cloud synchronization. Browser eviction, clearing website data or reinstalling can remove local data. Export/import is the recovery path. Safari and the installed Home Screen app may have separate storage.
4. **Physical iPhone validation:** Home Screen installation, Dynamic Island/safe areas, real GPS permission prompts, VoiceOver and large Dynamic Type settings require an actual iPhone test. WebKit emulation is not a substitute for those checks.
5. **Live estimates depend on operators:** operator outages, no service and missing metadata are handled; estimates are not guaranteed bus arrivals. ETA requires a network connection.
6. **GPS scope:** list-based discovery, straight-line distances, up to 40 results in 1km. No map tiles, walking directions, journey planning, fare calculations or push notifications are implemented; those were not requested.
7. **Hosting:** the production build is ready to serve at `/` over HTTPS; no public deployment or production domain has been configured.
8. **Testing scope:** simulated GPS and API fixtures provide reproducible interaction tests. Real phone geolocation and every individual route/service variant have not been exhaustively validated. No claim of an accessibility certification is made.

9. **Joint-route coverage:** official membership is necessary; event services absent from TD stay separate. Special
   variants, repeated/ambiguous stops and insufficient journey overlap are deliberately not guessed. Routes with
   different endpoint names may wait for full stop data before merging.

## Architecture / maintenance

- `src/App.tsx`: 10-line entry point composing the app provider and shell.
- `src/app/`: shared context/provider and page composition. `hooks/useAppController.ts` combines feature hooks and navigation state.
- `src/pages/`: Saved, Routes, Nearby, Settings and Route Details screens.
- `src/components/`: reusable arrivals, bookmarks, route keypad/rows/badges, download status, layout and illustration components.
- `src/hooks/`: arrival polling, route search, route details, GPS, connectivity, backups, user preferences and catalogue lifecycle.
- `src/services/api.ts`: request retry and arrival adapters. `src/services/catalog/`: separate KMB, Citybus and NLB importers, shared helpers, snapshot orchestration and on-demand route loading.
- `src/services/joint/`: TD membership download/cache, journey and stop matching, and combined ETA requests.
  `useJointItinerary` preserves partner-only stops.
- `src/workers/catalog.worker.ts`: small worker message handler; delegates data import to services.
- `src/storage/`: IndexedDB schema/migrations and local user-data reading. Existing database name and bookmark key are retained.
- `src/types/`, `src/utils/`, `src/i18n/`, `src/styles/`: domain types, tested pure helpers, translation strings and styles.
- `scripts/`: reproducible live API and production offline checks.
- `tests/app.spec.ts`, `src/utils/transit.test.ts`: browser and unit regression tests.

## Citybus visibility fix and refactor

The original UI hid every Citybus route until the entire provider snapshot finished. The affected user session was inspected while Citybus was still downloading (551 of 813 route-list requests), although KMB/NLB were already usable. This was a visibility/availability design problem, rather than missing routes in the Citybus API.

Citybus now publishes a persistent lightweight route index as soon as `/route/CTB` returns. Users can search this index immediately. Opening a route fetches just its ordered stops and details using the same adapter/checkpoint cache as the full importer. That route is cached separately for reuse, including offline. The full offline dataset continues downloading and still commits atomically; existing complete snapshots remain available during refreshes. Search now shows operator-specific pending/error status rather than suggesting an unfinished catalogue has no matching routes.

IndexedDB version 2 adds `routeCatalogs` and `routeDetails` stores without deleting version-one snapshots, checkpoints or user data. A regression test verifies this upgrade and bookmark preservation. Another regression deliberately prevents Citybus's full download from completing and verifies route search, stop loading, ETA, bookmarking and persistence after reload in both browser engines.

Live validation on a fresh development origin: Citybus 2X appeared while bulk import progress was only 61/813, its 16 stops loaded on demand, and live arrival estimates displayed successfully. The original user preview was also checked and showed Citybus routes after its initial full import finished. No user bookmarks were reset.

## Final live verification results

A complete browser import on 20 September 2026 completed in approximately 640 seconds (including development reloads that exercised checkpoint resumption), with zero recorded application runtime exceptions:

| Provider       |        Stored route direction/service variants |                                           Stored stop records |
| -------------- | ---------------------------------------------: | ------------------------------------------------------------: |
| KMB / Long Win |                                          1,599 | 6,741 (6,740 supplied + 1 explicitly unavailable placeholder) |
| Citybus        | 687 nonempty directions from 406 route numbers |                                                         2,584 |
| New Lantao Bus |                                             64 |                                                           290 |

The real KMB 1A route and its first stop's ETA rendered successfully after this import. Full-page mobile screenshots were visually inspected. Raw verification summaries are in `docs/verification-results.json`; generated screenshots remain in the ignored `artifacts/` and `test-results/` folders.

Final checks: strict TypeScript production build, ESLint, Prettier, 23 unit tests, 20 browser tests, and production offline-cache smoke tests in Chromium/WebKit passed. Physical iPhone installation and GPS checks remain manual as described above.

## Theme and contributor conventions update — 21 September 2026

Implemented five persisted theme colours with light/dark palettes, translated accessible radio controls, selected checkmarks, and browser theme-colour metadata updates. Older user data/backups default to green; invalid supplied themes are rejected. Bookmark and language persistence are preserved. Fixed brand icons and manifest remain green.

Four-space indentation observed in the source is now shared by Prettier, ESLint and EditorConfig. Formatting was normalized across project text. Future agents follow root `AGENTS.md`; `DEVELOPMENT.md` documents module ownership, WebStorm formatting, storage migrations, theme extension and verification.

Verification for this update: production build, ESLint (including a deliberate invalid-format probe), Prettier check and 23 unit tests passed. All 20 browser cases passed across WebKit and Chromium (18 existing cases in the full run; two new theme cases passed after fixing an ambiguous test selector). Production offline reload checks passed in both engines. The purple Traditional Chinese mobile Settings screenshot was visually inspected. No new live API crawl or physical iPhone test was performed for this update.

## N8P inbound ETA correction — 21 September 2026

Live data reproduced valid Citybus ETAs being discarded because inbound route-stop sequences 1–18 differed from ETA sequences 12–29. All 18 inbound stops returned three ETAs during the audit. The Citybus adapter now uses stop identity for unique visits, while retaining direction filtering and strict sequence matching for repeated/unknown visits. KMB and NLB selection are unchanged. Existing cached routes and bookmarks work with this correction; no route refresh or data deletion is required.

Regression coverage includes the two observed N8P sequence examples, wrong direction/route/stop/company rejection, repeated visits, incomplete stop lists, ordinary outbound sequences and null-ETA remarks. Browser coverage exercises inbound route details, bookmarking and reload. See `API-RESEARCH.md` and `citybus-n8p-audit.json` for evidence and the remaining upstream outbound-list anomaly. This was a targeted N8P audit, not an exhaustive all-route data review.

N8P correction verification: production build, lint, formatting, 27 unit tests and all 22 browser tests passed (mobile WebKit and desktop Chromium). Persistence schema and offline caching were unchanged.

## Keypad theme correction — 21 September 2026

Completed each palette with light/dark border and secondary-text colours, explicit surfaces and theme-derived shadows. The keypad mixes its background from `--line` and `--bg`; previously `--line` and action-key `--muted` inherited the original green palette even when blue or another theme was selected. All five themes now supply these tokens.

Verification: blue keypad screenshots and computed background/border/action colours checked in mobile WebKit in both light and dark appearance. Production build, lint, formatting, 27 unit tests and 22 existing browser tests passed.

## Home Screen app update correction — 21 September 2026

Previously the generated registration script registered the offline worker, but the app had no foreground update checks, update UI or controller-change handling to refresh the running page. Safari loading a new page did not refresh an already running installed app. Replaced the generated registration with a production-only lifecycle hook: startup/foreground/reconnection/hourly checks, manual Settings check, bilingual update notice and user-triggered activation/reload. Existing localStorage and IndexedDB data remain untouched. Deployment/header requirements and one-time upgrade instructions for older installed clients are in README. The external hosting configuration and physical iPhone behavior have not been inspected.

Verification: build, lint, formatting, 27 unit tests and 22 browser tests passed. Production update activation/reload and saved preference preservation passed in Chromium and WebKit; production offline reload/bookmarks/search passed in both engines. Physical installed-iPhone verification remains manual.

## Route results visible while typing — 21 September 2026

Reworked mobile Routes to keep search controls above a scrollable matching-route list and a compact keypad below it.
Letters scroll alongside the numbers, similar to the supplied reference. The selected theme, operator filters, keypad
show/hide and bottom navigation remain available. The large decorative page heading is visually hidden on mobile Routes
to leave room for matches; it remains accessible. Desktop and route-detail scrolling retain their previous layout.
Results reset to the top when query or operator changes.

Verified build, lint, formatting and 27 unit tests. All 22 existing browser cases passed; the two new geometry cases
passed after correcting grid stretching, covering full-row visibility while typing at 440×956 and 320×568, keypad
show/hide expansion, and opening route details. Mobile WebKit screenshot inspected. On short phone viewports the brand
header is hidden to preserve results space; navigation remains available. Physical iPhone testing remains manual.

## Joint-route aggregation — 21 September 2026

Implemented automatic TD joint-route membership, cached independently and refreshed weekly/on demand. Removed the
earlier manual registry and one-off evidence JSON. Joint journeys now use one search result under either operator
filter, one itinerary including partner-only stops, and chronologically combined arrivals with source labels. Existing
bookmarks retain their IDs and gain combined arrivals when matched; new bookmarks exclude derived membership. Settings
includes the TD timestamp and refresh failure state.

Pairing requires official membership plus compatible endpoints or substantial ordered stop overlap. Direction codes and
stop sequences remain operator-specific; unrelated same-number services such as 2X and special KMB variants remain
separate. Partial matching/request failures have bilingual notices. See `JOINT-ROUTES.md` for algorithms, lifecycle and
limitations, including event routes absent from TD, ambiguous stops and delayed geographic matching during the initial
Citybus download.

Verification: production build, ESLint, formatting, 41 unit tests and all 26 browser tests passed. Production offline
checks passed in Chromium and WebKit, now including cached joint membership restoring one merged route. The mobile
joint-route screenshot was inspected. Live checks verified the TD query/CORS and both operators’ 102/106 stop lists;
retained fixtures exercise both directions. This was not an exhaustive live ETA audit. Physical iPhone validation
remains manual.

## Bookmark reordering — 21 September 2026

Added **Saved → Reorder** with a compact list and up/down controls, available when at least two bookmarks exist. Moves
save immediately and survive reload; **Done** returns to ETA cards. Reordering within a group leaves hidden bookmarks
in their existing positions. Group edits now preserve the saved order instead of moving an edited item to the end.
English/Traditional Chinese labels, keyboard controls, 44px touch targets, disabled boundary buttons and announced
positions are included. Existing data and backup format remain compatible; no drag gesture is required or implemented.

Verification: build, lint, 44 unit tests, all 28 browser tests (mobile WebKit and desktop Chromium), and production
offline smoke checks passed. Browser coverage verifies group isolation, saved array order, reload persistence, keyboard
activation and Chinese labels. Physical iPhone and VoiceOver testing remain manual.

## Chronological ETA display — 22 September 2026

Fixed single-operator arrival panels preserving upstream response order. All providers now use shared display sorting
before the three-prediction limit, including route details and bookmarks. The reported 720 order of 13, 2, 7 minutes
now displays 2, 7, 13. Untimed remarks follow timed predictions; equal-time buses retain their remarks. Existing
expiry, direction, service and stop filtering remain unchanged. Regression data reproduces the reported ordering;
no current live rush-hour API audit was performed.

Verification: build, lint, formatting, 47 unit tests and all 30 browser tests passed. The browser regression checks
2, 7, 13 in both route details and saved bookmarks on mobile WebKit and desktop Chromium. Storage and offline behavior
were unchanged; physical iPhone testing remains manual.

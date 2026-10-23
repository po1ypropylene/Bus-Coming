# Development guide

Last updated: 23 October 2026.

## Starting points

Read [setup and deployment](SETUP.md) for commands, HTTPS and iPhone testing; [requirements and status](REQUIREMENTS-AND-STATUS.md) for behavior and limitations; [API research](API-RESEARCH.md) for operator endpoints and normalization. [AGENTS.md](../AGENTS.md) is the repository instruction file for future coding agents.

## Code style and editor setup

The source convention is **four spaces**, not tab characters, with single quotes, no optional semicolons, trailing commas and a 100-column wrapping target. JSX attributes use double quotes. Prettier decides wrapping, JSX spacing and required defensive semicolons. Existing uneven JSX indentation has been normalized to the same convention.

- `.prettierrc.json` is the canonical formatter configuration.
- `eslint.config.js` includes `eslint-plugin-prettier/recommended` last: formatting differences fail lint and conflicting ESLint style rules are disabled by `eslint-config-prettier`.
- `.editorconfig` supplies four-space indentation and tab width, four-space JetBrains continuation indentation, a 100-column target, UTF-8, LF and final newlines. Markdown retains intentional trailing spaces.
- In WebStorm, enable EditorConfig support. Under **Languages & Frameworks → JavaScript → Prettier**, use **Manual Prettier configuration** with this project's `node_modules/prettier`. Enable **Run on save**, **Run on 'Reformat Code' action** and **Prefer Prettier configuration to IDE code style**. Set **Run for files** to `**/*.{js,ts,jsx,tsx,cjs,cts,mjs,mts,json,jsonc,css,scss,less,html,md,mdx,yml,yaml,vue,astro}` so stylesheets and documentation use the same formatter as the CLI. Keep automatic `.prettierignore` detection and leave formatting outside the dependency scope disabled. These local settings live in ignored `.idea/` files.
- Oxlint checks code quality; Prettier owns whitespace and wrapping, with ESLint enforcing Prettier plus the remaining React/core rules. Keep automatic ESLint configuration. WebStorm's **Reindent** uses its native indentation engine; save afterward to apply Prettier's complete layout, especially nested ternaries and JSX. Prefer **Reformat Code** for canonical whole-file formatting. See [WebStorm's Prettier integration](https://www.jetbrains.com/help/webstorm/prettier.html).
- `npm run format` normalizes tracked project text; `npm run format:check` checks it without editing. `npm run lint` checks code quality and JS/TS formatting. Generated assets, build output, test screenshots and dependency files are excluded where appropriate.

## Module ownership

| Folder                     | Responsibility                                    |
| -------------------------- | ------------------------------------------------- |
| `src/app`                  | Context, provider and screen composition          |
| `src/pages`                | Screen-level markup                               |
| `src/components/<feature>` | Reusable UI such as route keypad and theme picker |
| `src/hooks`                | React state, user actions and side effects        |
| `src/services/catalog`     | Operator imports and on-demand route loading      |
| `src/services/api.ts`      | HTTP retries and live arrival adapters            |
| `src/storage`              | Persistent user data and IndexedDB schema         |
| `src/types`, `src/utils`   | Domain contracts and pure transformations         |
| `src/i18n`                 | English and Traditional Chinese UI copy           |
| `src/styles`               | Global, application and theme styles              |
| `src/workers`              | Off-main-thread catalogue import orchestration    |

Keep `App.tsx` as an entry point. Feature logic belongs in the modules above rather than growing the entry component again.

## Persistence and upgrades

`bus-coming-user-v1` in localStorage stores version 1 user data: language, theme and bookmarks. `validateUserData` is the boundary for both stored data and imported backups. New users and old records without `theme` use `DEFAULT_THEME` (`blue`); explicitly saved colours, including green, are preserved. All five known strings are accepted, while supplied unknown/null values are rejected. This default does not require clearing data or changing the version/key. New writes and exports include the normalized theme. If storage writes fail, the current session still updates and the app reports the save failure.

Backups merge bookmarks by ID, with imported entries winning conflicts, and restore imported preferences. An older backup without a theme defaults to blue. Invalid imports do not overwrite existing data. Imports remain limited to 10 MB and 1,000 bookmarks. Keep migration coverage when adding fields.

IndexedDB `bus-coming-v1`, schema version 2, contains `snapshots`, `responses`, `generations`, `routeCatalogs` and `routeDetails`. Complete provider snapshots commit atomically; interrupted downloads resume checkpoints. Do not rename/delete stores or clear data to work around a migration. User bookmarks remain separate from replaceable route data.

## Theme implementation and extension

Settings offers Green, Blue (default), Yellow, Red and Purple through a native radio group with visible labels, selected checkmarks and keyboard focus. Preferences are translated and persist across reloads and backup export/import. Appearance continues to follow the device's light/dark setting.

- `THEMES` and `Theme` in `src/types/transit.ts` define allowed identifiers.
- `src/components/settings/ThemePicker.tsx` renders the choices.
- `src/hooks/useTheme.ts` applies `data-theme` to the root before paint and updates the browser theme-colour metadata when either the palette or system appearance changes.
- `src/styles/themes.css` defines paired light/dark accent, background, foreground and soft surface tokens. Application decoration uses those tokens; operator badges and success/error indicators retain their semantic colours.
- `src/i18n/index.ts` supplies colour labels for both languages.

To add a palette, add its identifier, both translated labels, both complete CSS token sets (including surface, border `--line`, secondary text `--muted` and shadow), and extend migration/browser tests. Check accent-to-surface contrast of at least 4.5:1, keyboard interaction, visible selection, mobile wrapping and dark appearance. Yellow deliberately uses a darker gold accent in light appearance for readable text. The install icon uses the fixed blue brand; initial CSS, HTML metadata and the manifest use the blue palette. The running app's browser chrome follows the selected palette where the browser supports it. `npm run icons` regenerates the PNG install assets from `public/favicon.svg`.

### Glass presentation

`src/styles/glass.css` owns the Safari-oriented control material and shared intensity, tint, rim,
shadow and filter tokens. Content cards, ETA panels and operator badges stay matte. The ambient
backdrop is static and theme-derived. See [glass implementation](GLASS.md) for the rendering boundary,
settings contract, lens implementation, verification and device checklist.

The tab bar uses an empty `.glass` surface beneath the real buttons. Its moving lens refracts only an
inert, inaccessible highlighted copy of the four labels with `filter: url(...)`; never use SVG URLs
in `backdrop-filter`. The operator selector reuses `SelectionLens`. On initial mount the child layout effect may run before
the host ref is attached; use the lens’s direct DOM parent as the initial measurement fallback. Do not nest backdrop filters or
add filters to repeated rows. Reduced effects resolve through `data-glass-effective` and shared tokens.
Glass preferences are optional version-one user-data fields: old backups remain valid, and explicit
preferences round-trip through the existing persistence/export/import path. Do not clear stored data.

## Verification and release workflow

The direct `typescript` dependency is TypeScript 7.0.2; `npx tsc --version` should report `7.0.2`.
Builds and `npm run typecheck` use its native compiler with default parallel checking. Use
`npm run typecheck:watch` alongside Vite for continuous native type checking; Vite alone does not check types.
There is no TypeScript 6 compiler, alias or compatibility package. Commit `package-lock.json` with dependency changes.

TypeScript 7 does not expose the old JavaScript compiler API required by `typescript-eslint`, so linting uses
[Oxlint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) for the previous general and TypeScript rules
listed explicitly in `.oxlintrc.json`. ESLint retains React Hooks (including compiler diagnostics), Fast Refresh,
Prettier, and the `no-octal` / `preserve-caught-error` core rules. Its Babel parser only parses TS/TSX for those checks;
it does not compile the application or replace TypeScript's type checker. The Babel 8 / Lighthouse test toolchain
requires
Node 22.19+ within the 22.x line, or Node 24.11+.

`npm run lint` runs both linters. Keep the TypeScript rule settings in Oxlint when changing lint policy; do not restore
`typescript-eslint` until it supports the native compiler without installing an older TypeScript. `npm test` also runs
`test:toolchain`, which verifies compiler selection, rejects a deliberate type error, and probes TypeScript lint rules,
React Hooks/dependencies, Fast Refresh, caught errors and formatting. The probes use temporary fixtures, never user
data.

Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. Browser tests cover Chromium desktop and 440×956 WebKit mobile. Theme regressions cover all five colours in both appearances, contrast, metadata, reload persistence, export/import and Chinese labels; unit tests cover old-data defaults and invalid preferences.

Run `npm run test:offline` for startup, persistence or PWA changes. Vite development does not register a service worker; test offline behavior against a production build. A production preview uses the last built files, so rebuild it after source changes. Existing installed clients may need to close/reopen to activate a new service worker.

Live API audits/imports are separate, potentially lengthy network checks. Do not run them just to verify colour or formatting changes. The API research and previous live results are dated evidence, not a promise of current counts.

Update requirements/status with what was actually tested. Hardware-only checks still include iPhone installation, safe areas, real GPS permission, VoiceOver and large text. Do not publish/deploy solely because local checks pass unless deployment is part of the request.

## Operator-specific ETA matching

Do not apply KMB's sequence semantics indiscriminately to Citybus. The N8P live audit in `API-RESEARCH.md` demonstrates inbound ETA sequences offset from the route-stop catalogue. `selectCitybusArrivals` matches a unique stop by identity and direction, retaining exact sequence checks for repeated or unknown visits. Keep these regression tests when changing adapters. Never fall back to the opposite direction just because no matching ETA is available. Run `node scripts/audit-citybus-route.mjs ROUTE` to capture a targeted public-data reproduction before changing assumptions.

## App versions

`package.json` → `version` is the single editable source for the app's Semantic Version (`MAJOR.MINOR.PATCH`).
Vite reads it for both `__APP_VERSION__` (the full Settings footer version) and Workbox's `bus-coming-v<version>`
cache identity. Increasing the version changes the generated service worker, so existing clients can detect and
download the new build through the update lifecycle below. Asset changes are also detected through precache hashes;
readiness is based on a successfully installed waiting worker, not a version string alone.

Automatically bump once per completed shipped change set: patch for compatible fixes, minor for compatible features,
major for breaking changes, resetting lower components. Documentation/instruction-only changes, tests alone and
formatting alone do not require a bump. User-specified versions take precedence. Run
`npm version patch --no-git-tag-version` (or `minor` / `major`) to synchronize the package and lockfile metadata.
Never duplicate an app version literal in UI code or change persistence schema versions just to match the app version.
Rebuild after a bump; development servers also need restarting to reload Vite's version constant. Deploy the complete
build only when requested. Existing clients show their running build's version until they apply an update.

## Installed-app update lifecycle

`useAppUpdate` owns production-only native service-worker registration, using `updateViaCache: 'none'`. Vite PWA uses `registerType: 'prompt'` and `injectRegister: false`; do not reintroduce a second generated registration script. Workbox retains precaching and `clientsClaim`, with `SKIP_WAITING` activated only by the user's update button. The app checks at startup, foreground/pageshow/reconnection (one-minute throttle), hourly while active, and on demand in Settings. A downloaded update shows a bilingual reload notice; first installation does not force a reload. Failed/offline checks retain the working cache and display a retryable Settings status.

Update activation never deletes localStorage or IndexedDB. The reload replaces in-memory UI state, so users choose when to apply it. An older deployed client cannot run this new updater until its existing service-worker lifecycle delivers the first new build; see [setup and deployment](SETUP.md#updating-the-installed-iphone-app) for close/reopen bootstrap and hosting cache headers. The same-origin service-worker URL and scope must remain stable.

`node scripts/update-smoke.mjs` serves three simulated version/cache identities of the production shell without modifying `dist`, verifying waiting-worker detection, explicit activation/reload, preference persistence and the current-version check and simulated resume detection. Run this and the offline smoke check for registration changes; Vite dev does not install the worker. Automatic checks cannot execute while iOS suspends or closes the app.

## Mobile route search layout

At widths up to 700px, `.route-search-shell` uses the dynamic viewport height and safe-area padding. Search controls, an
independently scrollable result list, and the custom keypad occupy separate grid rows; the tab bar stays in normal flex
flow below them. Never hide the tab bar when the custom keypad opens; navigation must remain directly usable.
Numbers remain in a 3-column pad, with a separate 2-column scrolling letter list. Hiding the keypad
expands the results. Query/operator changes reset only the results scroll position, so matches stay visible while
typing. Route details leave this constrained shell and use normal page scrolling. Desktop retains its sidebar layout.
Keep keyboard focus, 44px keys and the 320×568 / 440×956 geometry regression when changing this screen.

## Joint routes

Read [JOINT-ROUTES.md](JOINT-ROUTES.md) before changing joint membership, journey/stop matching or ETA aggregation.
`services/joint/` owns the official TD adapter, conservative pairing and combined arrivals. `useJointItinerary` includes
partner-only stops without changing provider IDs or API sequences. Keep raw provider snapshots independent, never
persist derived `jointPartners`, and resolve old bookmarks through their original route ID. There is no manual
membership registry. Keep failures partial and explicit; do not merge by route number or O/I code alone.

## Bookmark ordering

The existing `user.bookmarks` array is the display order; no schema or storage-key change is needed.
`utils/bookmarks.ts` contains immutable move/save helpers. Reordering swaps adjacent visible bookmarks; in a filtered
group it swaps their original array slots so hidden bookmarks never move. `BookmarkOrder` provides a compact ordered
list with translated 44px up/down controls, disabled boundaries and screen-reader position announcements. Each move
uses the normal user-data persistence/error path. Editing a group preserves the bookmark's array position; new stops
append. Export preserves array order. Import into an empty collection restores it; merging into an existing collection
keeps existing positions and appends new IDs in imported order, as before. Do not change this silently.

## ETA display ordering

All arrival panels use `utils/arrivals.ts` through `useArrivals`: retain operator-supplied predictions, sort by absolute
arrival timestamp, then take the first three. Do not discard negative ETAs: an overdue estimate can still describe an
approaching bus. Anything up to one minute away (including zero and negative intervals) displays **Due / 就到**
without a minute suffix. Operator refreshes remove withdrawn predictions; request failures retain the explicit
stale/unavailable state. Untimed remarks follow timed predictions; equal-time buses and their remarks
remain distinct. Never assume operator response order is chronological (rush-hour service variants may be grouped).
Keep provider direction/service/stop filtering in the adapters; display sorting must not broaden those matches.

KMB and Citybus arrival adapters retain the selected-language `dest_en` / `dest_tc` as optional per-departure
`destination`, alongside existing remarks. Compare only the displayed timed departures: when at least two supplied
destinations differ, show each available destination. Identical destinations add no label by default. Tapping the ETA card toggles all supplied departure destinations,
including mixed destinations; refresh and retry remain separate controls. The native toggle button supports keyboard
activation and bilingual expanded-state labels. The override lasts while that panel is mounted; missing destinations
never fall back to the catalogue destination. All departures use equal-width horizontal columns, including mixed destinations
or differing remarks; descriptions wrap beneath their respective countdowns. Preserve all operator remarks, including null-ETA status messages, and joint-provider labels.
Do not infer a bypass itinerary from the route number, clock time or catalogue destination.

Live/scheduled departure labels must come from explicit operator data. Never approximate this status
from stop position, rounded timestamps, empty remarks or changes between refreshes. If no reliable
public source supplies it, leave the departure unclassified. See the Citybus 2X/720 investigation in
`API-RESEARCH.md`; the absence of a status must not be interpreted as live GPS tracking.

## Route direction switching

`utils/routeDirection.ts` chooses the opposite journey from the full `byRoute` index, which includes hidden Citybus
identities for joint services and the early Citybus catalogue. Prefer the same operator, number and service with the
opposite bound. NLB uses separate route IDs with bound O, so require uniquely reversed terminals instead. Never match
another operator by number alone. Only an established joint partner can supply a fallback when the current operator
has no reverse record. Keep the target's derived partners, not the source's: 106 has opposite O/I conventions between
KMB and Citybus. Ambiguous or absent candidates hide the switch; do not fall back to a different KMB service type.

The bilingual direction button sits at the right of the route heading and previews the target destination. On phones it
uses a 44px icon button, retaining the translated destination in its accessible label and tooltip. `openRoute` clears
expanded stop state and scrolls to
the top; route details are keyed by route ID to reset local detail/itinerary state. Citybus details load on demand as
usual. Its early index contains provisional directions; an empty upstream direction displays the existing no-stops
message. Complete catalogues omit empty directions. This feature does not reverse stop arrays or rewrite bookmarks.

## Shared Citybus snapshots — 6 October 2026

See [CITYBUS-SNAPSHOTS.md](CITYBUS-SNAPSHOTS.md) for the optional Cloudflare Static Assets publisher, manifest contract,
weekly GitHub workflow, build-time URL configuration, validation and official-import fallback. The publisher reuses
the Citybus normalizer. Existing IndexedDB schema, user data and ETA adapters remain unchanged.

## UI readability and ETA freshness — 17 October 2026

Use `--nav-clearance` for ordinary pages: navigation height, bottom offset, device safe area and a 16px gap.
The mobile route search shell reserves navigation and keypad space in normal flow; its separate results scroller has
16px end padding instead. The tab surface uses the glass finish and opaque accessibility fallbacks described above. The app header stays compact and
sticky, including on short screens. Only the empty Saved screen uses the large hero; other screens use small titles.

Secondary/caption text is at least 13px, including Chinese, with no extra tracking on Chinese section labels.
`tests/ui-improvements.spec.ts` measures ink, muted, accent and warning tokens against surface, background, soft and
line colours for all ten palette/appearance combinations. It also runs axe on every tab and route details in Chromium
and WebKit. `tests/accessibility.spec.ts` runs Lighthouse accessibility snapshots in Chromium for both locales;
it deliberately skips WebKit because Lighthouse uses Chrome's protocol. These tools are development dependencies only.

`validNextCharacters` follows the existing substring search semantics (including repeated matches) against the current
operator's loaded results. `useRouteSearch` memoises its result. Unavailable letters are omitted; the letter section
is omitted when empty, but its mobile grid column stays reserved so the number and action keys keep the same
positions and sizes as letters disappear or return. Digits use native `disabled`
and `aria-disabled`; clear/backspace remain available. New catalogue entries automatically update available keys.
Mobile keypad rows are 48px (44px on short screens); the labelled keyboard icon toggles visibility beside the input.

`useArrivals` schedules its next poll after each completed request: 15 seconds for a successful, non-partial
result with one or two timed predictions, and 30 seconds for a full card, an empty result, a partial result or failure.
Requests run only when its IntersectionObserver sees the card, the document is visible and focused, and the browser
reports a connection. Focus, visibility, reconnection and re-entry resume checking through the existing 15-second
cache and request deduplication. Manual refresh/retry bypasses the completed-response cache for every matched
operator, while sharing any in-flight request. Automatic callers also join an active refresh before using older cached
data. Completion schedules a single timeout; suspended/offscreen cards resume through visibility/focus/re-entry events,
with a 30-second eligibility check as a fallback for missed events. Existing in-flight HTTP requests can finish after
focus is lost;
new polling requests pause. Results are keyed by route, stop, sequence and language so a previous selection cannot flash
in a new panel. Relative request age/countdowns tick each second while active. Failed, partial, offline or
older-than-90s
results are explicitly stale; old predictions remain visible. The header reflects the latest completed ETA request,
with a neutral waiting state before any result, amber after failure/partial/90s age and grey offline.

ETA cards use content-driven height with compact loading placeholders. Longer operator notes expand the card naturally;
there is no fixed-height reservation or nested ETA scroller. Absolute arrival times use Hong Kong time. Equal-width
columns balance
`Due / 就到` labels with numeric predictions, including when all three buses are due. Mobile countdowns and due labels
scale together with the panel width (18–27px) so predictions remain horizontal; captions stay at 13px. Operator remarks appear under each
affected departure; no GPS or scheduled classification is inferred from an empty remark. Hide untimed operator messages. Error states
have a retry action; offline states preserve known results and explain that a connection is needed.

## Generated output and regression fixtures

Write audit JSON, screenshots and logs to ignored `artifacts/`, `test-results/` or `playwright-report/`, not `docs/`.
These folders are disposable after reviewing a run. `npm run audit:apis` writes `artifacts/api-audit.json`;
`node scripts/audit-citybus-route.mjs N8P` writes `artifacts/citybus-n8p-audit.json`. Both read live public APIs;
run them only when current operator evidence is needed. Keep durable findings and reproduction commands in
[API research](API-RESEARCH.md), and record verification scope in [requirements/status](REQUIREMENTS-AND-STATUS.md).
Replace obsolete status summaries instead of appending a history of every test run; Git retains earlier versions.

The intentionally published README screenshots are an exception: keep `docs/images/iphone17-*.png` under version
control. `scripts/render-readme.mjs` uses the installed macOS Safari app through its built-in WebDriver,
including the device-frame rendering. Chrome/Chromium and Playwright WebKit are not substitutes. If Safari is
unavailable (for example, on Windows), refuse requests to generate new screenshots and explain the requirement.
The app renders at 393×852 CSS pixels, Traditional Chinese and blue, in both appearances. Safari supplies the
native backing scale (2× in the 23 October capture); Sharp normalizes the framed output to 1533×2904 pixels.
The temporary loopback proxy substitutes 62px/34px top/bottom safe areas and the selected appearance in development
stylesheets. An isolated automation session receives dated fixture data and a fixed app clock before startup;
worker clocks and API requests use the same replay to prevent late live-data changes.
No user browsing data is changed. A second Safari tab composes the illustrative phone shell and status bar.
Before every capture, the renderer waits for catalogue loading, fonts and finite animations, then allows
three additional seconds
for transparency and blur to settle. Visually review these effects and check for clipping before publishing.
Captures crop Safari’s composed viewport to preserve its rendered materials. Computed glass styles and raw
screen captures stay under ignored `artifacts/readme/`. This is desktop Safari at mobile dimensions, not
physical iPhone validation or an iOS browser capture.

To regenerate, enable **Safari → Settings → Developer → Allow remote automation** (labelled **Allow remote automation
and external agents** in Safari 27), then run `/usr/bin/safaridriver -p 4444` and
`npm run dev -- --host 127.0.0.1 --port 4174` in separate terminals. Run `node scripts/render-readme.mjs`;
`README_BASE_URL` and `SAFARI_DRIVER_URL` override those local origins. Safari may need restarting after automation
is enabled. Obtain permission before enabling automation and restore its previous setting afterward. The script
fails if Safari cannot create a session; it never falls back to another browser.

It replays `scripts/fixtures/readme-transit.json`, which retains normalized 8P/118 journeys, all their stops, and
unmodified public operator/TD responses with source URLs and capture times. To deliberately refresh the public
examples, run `node scripts/capture-readme-data.mjs` first, then regenerate and visually review all four images.
`scripts/fixtures/readme-variants.json` retains the normalized 8P subset from the public TD timetable,
including source URLs, capture times and Last-Modified headers. Refresh it deliberately with
`node scripts/capture-readme-variants.mjs`. Its four patterns, referenced stops and calendars were captured on
23 October using the app’s parser and catalogue validator. Only cache freshness metadata is aligned to the replay
clock; the timetable fields and source timestamps remain unchanged. This allows the fully loaded variant picker
to render reproducibly alongside the older operator examples.
The renderer fails on uncaptured API requests instead of inventing predictions. Keep README captions focused
on app features. These are documentation captures, not live-service promises or physical iPhone verification.

Keep `tests/fixtures.ts` and `src/services/joint/fixtures/{102,106}.json`: browser tests and joint-route/direction
regressions consume them. The JSON files are dated operator captures, not runtime data or current route guarantees.
Remove a fixture only after checking its test consumers and preserving meaningful coverage. Publisher checkpoints in
`.citybus-checkpoints/` support interrupted downloads and are separate from disposable audit output.

## Catalogue refresh and nearby discovery

Downloads and normalization run in a Web Worker with four concurrent requests per operator and retry/backoff.
Seven-day age checks run at launch, resume, reconnection and hourly while active. Successful request checkpoints
resume interrupted downloads; complete snapshots remain available until replacements commit atomically.
Citybus also publishes its lightweight route index immediately and caches selected route details on demand.
Nearby discovery uses device location only after a user action, never sends coordinates to operators, and shows up to
40 stops within 1 km in distance order. It requires downloaded stop coordinates.

### Horizontal ETA layout

Arrival panels always use three equal-width columns, including departures with different destinations or remarks.
Keep each departure's clock, provider and supplied description beneath its countdown; long descriptions wrap within
that column. Mobile countdowns scale with the panel's inline container width (18–27px), while captions remain 13px.
Do not switch mixed services to vertical rows. Header pixel checks cover the full-width divider, and the mixed-service
browser regression checks horizontal geometry and overflow at 320, 390, 440 and 1280px in both languages.

`upcomingArrivals` selects up to three timed predictions. Untimed operator rows, including repeated Citybus
“KMB Cycle” messages, are not displayed. Keep remarks attached to timed departures, such as “Final Bus”. A response
with only untimed rows uses the normal bilingual no-estimate state. Network, stale and partial-data warnings remain.

## Citybus timetable variants

`services/variants/` imports TD's English GTFS ZIP plus the small Traditional Chinese route/stop
name tables. `fflate` inflates only the required tables inside the catalogue worker; fare tables are
excluded. CSV parsing iterates records, preserving quoted commas/newlines. Stops, service calendars,
holiday exceptions, fixed departures and frequency periods normalize into a separate validated
`td-citybus-variants-v1` entry in the existing IndexedDB `responses` store. There is no database,
bookmark or backup schema change. Refresh follows the existing weekly/forced policy and commits only
a complete valid catalogue; failed refreshes preserve the last saved timetable. Search, operator
snapshots and on-demand Citybus details do not depend on timetable availability. Settings reports
this download independently.

`routeVariantOptions` requires at least two distinct, safely matched stop patterns for the opened
Citybus direction. Identical paths from separate TD records are grouped and their departure periods
combined without mutating the cached catalogue. With zero or one distinct pattern, route details
retain the original operator heading, full itinerary, arrivals and bookmark identities. Render no
variant picker or variant loading/error footnote; timetable download failures remain visible in Settings.

Known joint routes (from TD membership or derived operator partners) also retain their original
combined itinerary and arrivals. Do not overlay a CTB-only timetable on a joint journey: this can
remove partner-only stops and turn previously usable visits into unmatched timetable rows. Joint
variant selection remains unavailable until it can preserve those combined journeys. This is a
capability guard, not a route-number exception for 102.

`useRouteVariants` selects among the remaining Citybus alternatives. It checks
scheduled origin departures in the next 60 minutes, chooses the earliest when several qualify, and
otherwise uses the next departure within its 14-day lookahead. With no eligible departure it retains
the operator stop list. Calendars use Hong Kong time, weekday rules, holiday exceptions and GTFS
service-day times after 24:00. Frequency end times are exclusive. Blank intermediate times are never
interpolated. A saved/nearby stop restricts the automatic candidates to patterns that can be safely
mapped to that stop. Selection recomputes every 30 seconds and on visibility changes. A manual pattern
or the operator stop list stays selected until the route detail screen closes; Automatic restores the
schedule rule. If a refresh removes a manually selected pattern, the picker falls back explicitly
to the operator stop list. Other operators retain their existing service identities and behavior.

TD direction and stop IDs are not operator API identifiers. Pair stops only within the selected
Citybus route family using close, unambiguous physical/name matches and ordered direction evidence
(at least three matched visits). Repeated operator visits remain unmatched, including when the same stop has a unique visit in the
opposite direction. Ordered neighbours reject isolated opposite-direction or out-of-order matches. A circular TD pattern can
contain both directions and is displayed as a complete loop, with each mapped visit retaining its
operator direction and original sequence. Ambiguous visits remain visible with bilingual names but
cannot request ETAs or be saved. The 720 circular Wing Wo Street turn is one such case. Never pass a TD
ID or sequence to an operator ETA endpoint. Safely mapped stops save the original operator route,
stop and sequence, so existing backups/bookmarks remain valid. Live ETA filtering and joint-provider
matching remain unchanged: a timetable selection does not prove that a shared-stop arrival belongs
to that variant.

The dated real 720 fixture in `services/variants/fixtures/720.json` covers morning circular,
Wing Wo terminating, normal directions and the Queensway/Lockhart Road return variant. Keep it separate
from constructed UI fixtures. Browser tests use a shared context fixture to block background live TD
downloads; individual tests can supply explicit timetable fixtures. Production offline tests separately
exercise the service worker. Physical iPhone rendering, memory use and suspended-app behavior still
need device verification.
